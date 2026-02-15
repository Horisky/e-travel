import os
import asyncio
import sys
import secrets
from datetime import datetime, timedelta, timezone

import jwt
import httpx
from dotenv import load_dotenv

load_dotenv()

# Psycopg async on Windows requires Selector event loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .schemas import (
    PlanRequest,
    PlanResponse,
    AuthRegisterRequest,
    AuthLoginRequest,
    AuthCodeRequest,
    AuthCodeVerifyRequest,
    ResetPasswordRequest,
    ResetPasswordConfirmRequest,
    PreferencesRequest,
)
from .llm import generate_plan_with_llm
from .retrieval import save_user_memory_from_plan
from . import db
from .settings import get_settings

app = FastAPI(title='Travel Planner API')

settings = get_settings()

class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        started = datetime.now(timezone.utc)
        response = await call_next(request)
        duration_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "-")
        print(f"[request] {client_ip} {request.method} {request.url.path} {response.status_code} {duration_ms}ms")
        return response


app.add_middleware(RequestLogMiddleware)


async def send_email(to_email: str, subject: str, text: str) -> None:
    if not settings.resend_api_key:
        raise RuntimeError("RESEND_API_KEY not set")
    if not settings.email_from:
        raise RuntimeError("EMAIL_FROM not set")
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.email_from, "to": [to_email], "subject": subject, "text": text},
        )
    if resp.status_code >= 400:
        raise RuntimeError(f"Resend error: {resp.status_code} {resp.text}")


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_token(user: dict) -> str:
    if not db.JWT_SECRET:
        raise RuntimeError("JWT_SECRET not set")
    exp = datetime.now(timezone.utc) + timedelta(minutes=db.JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user["id"]), "email": user["email"], "exp": exp}
    return jwt.encode(payload, db.JWT_SECRET, algorithm="HS256")


def get_optional_user(authorization: str | None) -> dict | None:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    token = parts[1]
    try:
        payload = jwt.decode(token, db.JWT_SECRET, algorithms=["HS256"])
        return {"id": payload.get("sub"), "email": payload.get("email")}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def optional_user_dep(authorization: str | None = Header(default=None)) -> dict | None:
    return get_optional_user(authorization)#从 Header 取 Authorization 并解析成 user 或 None


def current_user_dep(user: dict | None = Depends(optional_user_dep)) -> dict:
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")#强制必须登录，否则 401
    return user


@app.get('/health')
async def health():
    return {'status': 'ok'}


@app.post('/api/auth/register')
async def register(req: AuthRegisterRequest):
    if not await db.verify_code(req.email, req.code, "register"):
        raise HTTPException(status_code=401, detail="Invalid code")
    if await db.get_user_by_email(req.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    await db.create_user(req.email, req.password)
    user = await db.get_user_by_email(req.email)
    token = create_token(user)
    return {"token": token, "email": user["email"]}


@app.post('/api/auth/register/request')
async def register_code_request(req: AuthCodeRequest):
    if await db.get_user_by_email(req.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    code = f"{secrets.randbelow(1000000):06d}"
    await db.store_code(req.email, code, "register")
    send_code = settings.send_code_in_response
    if not send_code:
        try:
            await send_email(req.email, "E-Travel 注册验证码", f"你的注册验证码是：{code}\n10 分钟内有效。")
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to send email")
    return {"message": "code sent", **({"code": code} if send_code else {})}


@app.post('/api/auth/login')
async def login(req: AuthLoginRequest):
    user = await db.get_user_by_email(req.email)
    if not user or not db.verify_password(req.password, user["password_salt"], user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user)
    return {"token": token, "email": user["email"]}


@app.post('/api/auth/login-code/request')
async def login_code_request(req: AuthCodeRequest):
    user = await db.get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    code = f"{secrets.randbelow(1000000):06d}"
    await db.store_code(req.email, code, "login")
    send_code = settings.send_code_in_response
    if not send_code:
        try:
            await send_email(req.email, "E-Travel 登录验证码", f"你的登录验证码是：{code}\n10 分钟内有效。")
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to send email")
    return {"message": "code sent", **({"code": code} if send_code else {})}


@app.post('/api/auth/login-code/verify')
async def login_code_verify(req: AuthCodeVerifyRequest):
    if not await db.verify_code(req.email, req.code, "login"):
        raise HTTPException(status_code=401, detail="Invalid code")
    user = await db.get_user_by_email(req.email)
    token = create_token(user)
    return {"token": token, "email": user["email"]}


@app.post('/api/auth/reset-password/request')
async def reset_password_request(req: ResetPasswordRequest):
    user = await db.get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    code = f"{secrets.randbelow(1000000):06d}"
    await db.store_code(req.email, code, "reset")
    send_code = settings.send_code_in_response
    if not send_code:
        try:
            await send_email(req.email, "E-Travel 重置密码验证码", f"你的重置验证码是：{code}\n10 分钟内有效。")
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to send email")
    return {"message": "code sent", **({"code": code} if send_code else {})}


@app.post('/api/auth/reset-password/confirm')
async def reset_password_confirm(req: ResetPasswordConfirmRequest):
    if not await db.verify_code(req.email, req.code, "reset"):
        raise HTTPException(status_code=401, detail="Invalid code")
    await db.update_password(req.email, req.new_password)
    return {"message": "password updated"}


@app.get('/api/me/preferences')
async def get_preferences(user: dict = Depends(current_user_dep)):
    prefs = await db.load_preferences(user["id"]) or {}
    return prefs


@app.get('/api/me/search-history')
async def get_search_history(user: dict = Depends(current_user_dep)):
    return await db.load_search_history(user["id"])


@app.put('/api/me/preferences')
async def update_preferences(req: PreferencesRequest, user: dict = Depends(current_user_dep)):
    prefs = req.model_dump()
    await db.save_preferences(user["id"], prefs)
    return {"status": "ok"}



@app.post('/api/plan', response_model=PlanResponse)
async def plan(req: PlanRequest, user: dict | None = Depends(optional_user_dep)):
    try:
        result = await generate_plan_with_llm(req, user_id=(str(user["id"]) if user else None))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if user:
        prefs = {
            "origin": req.origin,
            "destination": req.destination,
            "travelers": req.travelers,
            "budget_min": req.budget_min,
            "budget_max": req.budget_max,
            "budget_text": req.budget_text,
            "preferences": req.preferences,
            "pace": req.pace,
            "constraints": req.constraints,
        }
        await db.save_preferences(user["id"], prefs)
        await db.save_plan(user["id"], result.model_dump())
        await db.save_search_history(user["id"], req.model_dump(), result.model_dump())
        await save_user_memory_from_plan(str(user["id"]), req.model_dump(), result.model_dump())

    return result
