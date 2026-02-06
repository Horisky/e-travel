import json
import os
import re
from typing import Any, Dict, List

import httpx
from pydantic import ValidationError

from .schemas import PlanRequest, PlanResponse
from .prompts import (
    SYSTEM_GUARD,
    USER_TEMPLATE,
    PLANNER_SYSTEM,
    PLANNER_USER,
    BUDGET_SYSTEM,
    BUDGET_USER,
    RISK_SYSTEM,
    RISK_USER,
    INTEGRATOR_SYSTEM,
    INTEGRATOR_USER,
)


def generate_plan_with_llm(req: PlanRequest) -> PlanResponse:
    provider = os.getenv("LLM_PROVIDER", "openai").strip().lower()
    if provider not in {"openai", "github", "vectorengine"}:
        raise RuntimeError(f"Unsupported LLM_PROVIDER: {provider}")

    api_key = os.getenv("LLM_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("LLM_API_KEY not set")

    if provider == "github":
        api_base = os.getenv("LLM_API_BASE", "https://models.github.ai/inference").strip()
        model = os.getenv("LLM_MODEL", "openai/gpt-4.1").strip()
    else:
        default_base = "https://api.vectorengine.ai/v1" if provider == "vectorengine" else "https://api.openai.com/v1"
        api_base = os.getenv("LLM_API_BASE", default_base).strip()
        model = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()

    response_format = os.getenv("LLM_RESPONSE_FORMAT", "json_object").strip()
    timeout_seconds = int(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
    max_retries = int(os.getenv("LLM_MAX_RETRIES", "2"))
    audit_enabled = os.getenv("AGENT_AUDIT_LOG", "false").lower() == "true"
    budget_risk_enabled = os.getenv("ENABLE_BUDGET_RISK", "false").lower() == "true"

    budget = req.budget_text or _budget_range(req)

    # 1) Planner
    planner_prompt = PLANNER_USER.format(
        origin=req.origin or "???",
        destination=req.destination or "???",
        start_date=req.start_date,
        days=req.days,
        travelers=req.travelers,
        budget=budget,
        preferences="?".join(req.preferences) or "?",
        pace=req.pace,
        constraints="?".join(req.constraints) or "?",
    )

    plan_skeleton = _run_agent_with_retry(
        system_prompt=PLANNER_SYSTEM,
        user_prompt=planner_prompt,
        api_base=api_base,
        api_key=api_key,
        model=model,
        response_format=response_format,
        timeout_seconds=timeout_seconds,
        provider=provider,
        max_retries=max_retries,
    )

    if audit_enabled:
        print("[planner_output]", json.dumps(plan_skeleton, ensure_ascii=False))#增加输出用来审计以下同理

    if budget_risk_enabled:
        # 2) Budget
        budget_prompt = BUDGET_USER.format(
            plan_skeleton=json.dumps(plan_skeleton, ensure_ascii=False),
            budget=budget,
            travelers=req.travelers,
        )
        budget_info = _run_agent_with_retry(
            system_prompt=BUDGET_SYSTEM,
            user_prompt=budget_prompt,
            api_base=api_base,
            api_key=api_key,
            model=model,
            response_format=response_format,
            timeout_seconds=timeout_seconds,
            provider=provider,
            max_retries=max_retries,
        )
        if audit_enabled:
            print("[budget_output]", json.dumps(budget_info, ensure_ascii=False))

        # 3) Risk
        risk_prompt = RISK_USER.format(
            plan_skeleton=json.dumps(plan_skeleton, ensure_ascii=False),
        )
        risk_info = _run_agent_with_retry(
            system_prompt=RISK_SYSTEM,
            user_prompt=risk_prompt,
            api_base=api_base,
            api_key=api_key,
            model=model,
            response_format=response_format,
            timeout_seconds=timeout_seconds,
            provider=provider,
            max_retries=max_retries,
        )
        if audit_enabled:
            print("[risk_output]", json.dumps(risk_info, ensure_ascii=False))
    else:
        # 2) Budget/Risk disabled to reduce token usage
        budget_info = {"budget_breakdown": {}, "alternatives": []}
        risk_info = {"risks": [], "fixes": []}

    # 4) Integrator (with retries + schema validation)
    schema = _format_schema()
    last_error = None

    integrator_messages = []

    for _ in range(max_retries):
        integrator_prompt = INTEGRATOR_USER.format(
            plan_skeleton=json.dumps(plan_skeleton, ensure_ascii=False),
            budget_info=json.dumps(budget_info, ensure_ascii=False),
            risk_info=json.dumps(risk_info, ensure_ascii=False),
            schema=schema,
        )

        if integrator_messages:
            # 如果之前失败，追加修正提示
            integrator_prompt = integrator_messages[-1]

        final_content = _call_agent(
            INTEGRATOR_SYSTEM,
            integrator_prompt,
            api_base,
            api_key,
            model,
            response_format,
            timeout_seconds,
            provider,
        )
        try:
            data = _extract_json_object(final_content)
            return PlanResponse.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = exc
            integrator_messages.append(
                "Previous output failed validation:\n"
                f"{exc}\n"
                "Return ONLY valid JSON that matches the schema."
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

def _maybe_log_usage(data: Dict[str, Any]) -> None:
    enabled = os.getenv("LLM_USAGE_LOG", "false").lower() == "true"
    if not enabled:
        return
    usage = data.get("usage")
    if usage is None:
        return
    print("[llm_usage]", usage)


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
        _maybe_log_usage(data)

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
        _maybe_log_usage(data)

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

#统一封装“调用 LLM”的逻辑
def _call_agent(
    system_prompt: str,
    user_prompt: str,
    api_base: str,
    api_key: str,
    model: str,
    response_format: str,
    timeout_seconds: int,
    provider: str,
) -> str:
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    if provider == "github":
        return _call_github_models(
            api_base=api_base,
            api_key=api_key,
            model=model,
            messages=messages,
            timeout_seconds=timeout_seconds,
        )
    return _call_openai(
        api_base=api_base,
        api_key=api_key,
        model=model,
        messages=messages,
        response_format=response_format,
        timeout_seconds=timeout_seconds,
    )

#把模型返回的内容解析成 JSON 对象
def _parse_json_or_raise(content: str) -> Dict[str, Any]:
    data = _extract_json_object(content)
    if not isinstance(data, dict):
        raise RuntimeError("Agent output is not a JSON object")
    return data

#把最终 PlanResponse 的 JSON Schema 生成成字符串严格Json schema约束
def _format_schema() -> str:
    return json.dumps(PlanResponse.model_json_schema(), ensure_ascii=True)

def _run_agent_with_retry(
    system_prompt: str,
    user_prompt: str,
    api_base: str,
    api_key: str,
    model: str,
    response_format: str,
    timeout_seconds: int,
    provider: str,
    max_retries: int,
) -> Dict[str, Any]:
    last_error = None
    prompt = user_prompt
    for _ in range(max_retries):
        content = _call_agent(
            system_prompt,
            prompt,
            api_base,
            api_key,
            model,
            response_format,
            timeout_seconds,
            provider,
        )
        try:
            return _parse_json_or_raise(content)
        except Exception as exc:
            last_error = exc
            prompt = (
                "Previous output was invalid JSON.\n"
                f"{exc}\n"
                "Return ONLY valid JSON."
            )
    raise RuntimeError(f"Agent output invalid: {last_error}")
