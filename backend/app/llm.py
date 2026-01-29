import json
import os
import re
from typing import Any, Dict, List

import httpx
from pydantic import ValidationError

from .prompts import SYSTEM_GUARD, USER_TEMPLATE
from .schemas import PlanRequest, PlanResponse


def generate_plan_with_llm(req: PlanRequest) -> PlanResponse:
    provider = os.getenv("LLM_PROVIDER", "openai").strip().lower()
    if provider not in {"openai", "github"}:
        raise RuntimeError(f"Unsupported LLM_PROVIDER: {provider}")

    api_key = os.getenv("LLM_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("LLM_API_KEY not set")

    if provider == "github":
        api_base = os.getenv("LLM_API_BASE", "https://models.github.ai/inference").strip()
        model = os.getenv("LLM_MODEL", "openai/gpt-4.1").strip()
    else:
        api_base = os.getenv("LLM_API_BASE", "https://api.openai.com/v1").strip()
        model = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()

    response_format = os.getenv("LLM_RESPONSE_FORMAT", "json_object").strip()
    timeout_seconds = int(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
    max_retries = int(os.getenv("LLM_MAX_RETRIES", "2"))

    messages = [
        {"role": "system", "content": SYSTEM_GUARD},
        {"role": "user", "content": _build_user_prompt(req)},
    ]

    last_error = None
    for _ in range(max_retries):
        if provider == "github":
            content = _call_github_models(
                api_base=api_base,
                api_key=api_key,
                model=model,
                messages=messages,
                timeout_seconds=timeout_seconds,
            )
        else:
            content = _call_openai(
                api_base=api_base,
                api_key=api_key,
                model=model,
                messages=messages,
                response_format=response_format,
                timeout_seconds=timeout_seconds,
            )
        try:
            data = _extract_json_object(content)
            return PlanResponse.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = exc
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "Previous output failed validation:\\n"
                        f"{exc}\\n"
                        "Return ONLY valid JSON that matches the schema."
                    ),
                }
            )

    raise RuntimeError(f"LLM output invalid: {last_error}")


def _build_user_prompt(req: PlanRequest) -> str:
    budget = req.budget_text or _budget_range(req)
    schema = json.dumps(PlanResponse.model_json_schema(), ensure_ascii=True)
    return USER_TEMPLATE.format(
        origin=req.origin or "???",
        destination=req.destination or "???",
        start_date=req.start_date,
        days=req.days,
        travelers=req.travelers,
        budget=budget,
        preferences="?".join(req.preferences) or "?",
        pace=req.pace,
        constraints="?".join(req.constraints) or "?",
        schema=schema,
    )


def _budget_range(req: PlanRequest) -> str:
    if req.budget_min is not None and req.budget_max is not None:
        return f"{req.budget_min}-{req.budget_max}"
    if req.budget_min is not None:
        return f">= {req.budget_min}"
    if req.budget_max is not None:
        return f"<= {req.budget_max}"
    return "???"


def _call_openai(
    api_base: str,
    api_key: str,
    model: str,
    messages: List[Dict[str, Any]],
    response_format: str,
    timeout_seconds: int,
) -> str:
    url = f"{api_base.rstrip('/')}/chat/completions"
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
    }

    if response_format == "json_schema":
        payload["response_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": "travel_plan",
                "schema": PlanResponse.model_json_schema(),
                "strict": True,
            },
        }
    else:
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=timeout_seconds) as client:
        resp = client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected LLM response: {data}") from exc


def _call_github_models(
    api_base: str,
    api_key: str,
    model: str,
    messages: List[Dict[str, Any]],
    timeout_seconds: int,
) -> str:
    url = f"{api_base.rstrip('/')}/chat/completions"
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
    }
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {api_key}",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=timeout_seconds) as client:
        resp = client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected LLM response: {data}") from exc


def _extract_json_object(content: str) -> Dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    code_fence = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", content, re.IGNORECASE)
    if code_fence:
        return json.loads(code_fence.group(1))

    obj_match = re.search(r"\{[\s\S]*\}", content)
    if obj_match:
        return json.loads(obj_match.group(0))

    raise json.JSONDecodeError("No JSON object found", content, 0)
