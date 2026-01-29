import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

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
from . import db

app = FastAPI(title='Travel Planner API')
load_dotenv()

cors_env = os.getenv("CORS_ORIGINS", "").strip()
extra_origins = [o.strip() for o in cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://e-travel-murex.vercel.app",
        "https://e-travel-s5rj.vercel.app",
        *extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_token(user: dict) -> str:
    if not db.JWT_SECRET:
        raise RuntimeError("JWT_SECRET not set")
    exp = datetime.now(timezone.utc) + timedelta(minutes=db.JWT_EXPIRE_MINUTES)
    payload = {"sub": user["id"], "email": user["email"], "exp": exp}
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


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/api/auth/register')
def register(req: AuthRegisterRequest):
    if db.get_user_by_email(req.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    db.create_user(req.email, req.password)
    user = db.get_user_by_email(req.email)
    token = create_token(user)
    return {"token": token, "email": user["email"]}


@app.post('/api/auth/login')
def login(req: AuthLoginRequest):
    user = db.get_user_by_email(req.email)
    if not user or not db.verify_password(req.password, user["password_salt"], user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user)
    return {"token": token, "email": user["email"]}


@app.post('/api/auth/login-code/request')
def login_code_request(req: AuthCodeRequest):
    user = db.get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    code = f"{secrets.randbelow(1000000):06d}"
    db.store_code(req.email, code, "login")
    send_code = os.getenv("SEND_CODE_IN_RESPONSE", "true").lower() == "true"
    return {"message": "code sent", **({"code": code} if send_code else {})}


@app.post('/api/auth/login-code/verify')
def login_code_verify(req: AuthCodeVerifyRequest):
    if not db.verify_code(req.email, req.code, "login"):
        raise HTTPException(status_code=401, detail="Invalid code")
    user = db.get_user_by_email(req.email)
    token = create_token(user)
    return {"token": token, "email": user["email"]}


@app.post('/api/auth/reset-password/request')
def reset_password_request(req: ResetPasswordRequest):
    user = db.get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    code = f"{secrets.randbelow(1000000):06d}"
    db.store_code(req.email, code, "reset")
    send_code = os.getenv("SEND_CODE_IN_RESPONSE", "true").lower() == "true"
    return {"message": "code sent", **({"code": code} if send_code else {})}


@app.post('/api/auth/reset-password/confirm')
def reset_password_confirm(req: ResetPasswordConfirmRequest):
    if not db.verify_code(req.email, req.code, "reset"):
        raise HTTPException(status_code=401, detail="Invalid code")
    db.update_password(req.email, req.new_password)
    return {"message": "password updated"}


@app.get('/api/me/preferences')
def get_preferences(authorization: str | None = Header(default=None)):
    user = get_optional_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    prefs = db.load_preferences(user["id"]) or {}
    return prefs


@app.put('/api/me/preferences')
def update_preferences(req: PreferencesRequest, authorization: str | None = Header(default=None)):
    user = get_optional_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    prefs = req.model_dump()
    db.save_preferences(user["id"], prefs)
    return {"status": "ok"}


@app.post('/api/plan', response_model=PlanResponse)
def plan(req: PlanRequest, authorization: str | None = Header(default=None)):
    user = get_optional_user(authorization)
    try:
        result = generate_plan_with_llm(req)
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
        db.save_preferences(user["id"], prefs)
        db.save_plan(user["id"], result.model_dump())

    return result
