import contextvars
import json
import os
import re
from typing import Any, Dict, List

import httpx
from pydantic import ValidationError

from .settings import Settings, get_settings
from .schemas import PlanRequest, PlanResponse
from .retrieval import (
    retrieve_context,
    retrieve_user_memory_context,
    retrieve_weather_context,
)
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
from .dual_rate_memory import DualRateMemory

_usage_collector: contextvars.ContextVar[List[int] | None] = contextvars.ContextVar(
    "usage_collector",
    default=None,
)


async def generate_plan_with_llm(req: PlanRequest, user_id: str | None = None, settings: Settings | None = None) -> PlanResponse:
    settings = settings or get_settings()

    provider = settings.llm_provider.strip().lower()
    if provider not in {"openai", "github", "vectorengine"}:
        raise RuntimeError(f"Unsupported LLM_PROVIDER: {provider}")

    api_key = settings.llm_api_key.strip()
    if not api_key:
        raise RuntimeError("LLM_API_KEY not set")

    api_base = settings.llm_api_base
    model = settings.llm_model

    response_format = settings.llm_response_format
    timeout_seconds = settings.llm_timeout_seconds
    max_retries = settings.llm_max_retries
    audit_enabled = settings.agent_audit_log
    budget_risk_enabled = settings.enable_budget_risk
    rag_enabled = settings.rag_enabled
    rag_top_k = settings.rag_top_k
    rag_use_kb = settings.rag_use_kb
    rag_use_memory = settings.rag_use_memory
    rag_use_weather = settings.rag_use_weather
    mcp_enabled = settings.mcp_enabled
    dual_rate_enabled = settings.dual_rate_enabled

    budget = req.budget_text or _budget_range(req)
    language = "Chinese"
    if req.language:
        lowered = req.language.lower()
        if lowered.startswith("en"):
            language = "English"
        elif lowered.startswith("zh"):
            language = "Chinese"
    collect_usage = audit_enabled
    usage_token = _usage_collector.set([]) if collect_usage else None
    rag_context = ""
    memory_context = ""
    weather_context = ""
    rag_kb_hits = 0
    rag_memory_hits = 0
    rag_weather_status = "disabled"
    rag_weather_source = "disabled"
    if rag_enabled:
        try:
            query_text = " ".join(
                [
                    req.origin or "",
                    req.destination or "",
                    req.budget_text or "",
                    " ".join(req.preferences or []),
                    " ".join(req.constraints or []),
                ]
            ).strip()
            if query_text:
                if rag_use_kb:
                    chunks = await retrieve_context(query_text, top_k=rag_top_k)
                    rag_context = _format_rag_context(chunks)
                    rag_kb_hits = len(chunks)
                    if audit_enabled:
                        print("[rag_kb_hits]", rag_kb_hits)
                if rag_use_memory and user_id:
                    memory_chunks = await retrieve_user_memory_context(user_id, query_text, top_k=rag_top_k)
                    memory_context = _format_rag_context(memory_chunks)
                    rag_memory_hits = len(memory_chunks)
                    if audit_enabled:
                        print("[rag_memory_hits]", rag_memory_hits)
                        memory_chars = sum(len(c.get("content") or "") for c in memory_chunks)
                        print("[rag_memory_chars]", memory_chars)
                if rag_use_weather:
                    rag_weather_source = "mcp-first" if mcp_enabled else "open-meteo"
                    weather_context = await retrieve_weather_context(req.destination, req.start_date, req.days)
                    rag_weather_status = "available" if weather_context else "empty"
                    if audit_enabled:
                        print("[rag_weather]", rag_weather_status)
                if audit_enabled:
                    print("[rag_enabled]", "true")
                    print(
                        "[rag_audit]",
                        f"kb_hits={rag_kb_hits} memory_hits={rag_memory_hits} "
                        f"weather={rag_weather_status} source={rag_weather_source}",
                    )
        except Exception as exc:
            rag_weather_status = "error"
            if audit_enabled:
                print("[rag_error]", str(exc))
                print(
                    "[rag_audit]",
                    f"kb_hits={rag_kb_hits} memory_hits={rag_memory_hits} "
                    f"weather={rag_weather_status} source={rag_weather_source}",
                )
    elif audit_enabled:
        print("[rag_enabled]", "false")
        print("[rag_audit]", "kb_hits=0 memory_hits=0 weather=disabled source=disabled")

    async def _summarize_for_dual_rate(text: str, max_tokens: int) -> str:
        prompt = (
            "Summarize the input into structured bullet points. "
            "Only include facts explicitly present. "
            "Do not invent new goals, tools, or steps. "
            f"Keep it under ~{max_tokens} tokens.\n\n"
            f"{text}"
        )
        return await _call_agent(
            SYSTEM_GUARD,
            prompt,
            api_base,
            api_key,
            model,
            response_format,
            timeout_seconds,
            provider,
        )

    if dual_rate_enabled and (rag_context or memory_context):
        memory = DualRateMemory(
            fast_tokens=settings.dual_rate_fast_tokens,
            slow_tokens=settings.dual_rate_slow_tokens,
            slow_every=settings.dual_rate_slow_every,
            slow_importance=settings.dual_rate_slow_importance,
            recent_keep=settings.dual_rate_recent_keep,
        )
        merged = "\n\n".join([c for c in [rag_context, memory_context] if c])
        await memory.update(merged, _summarize_for_dual_rate)
        dual_rate_context = memory.context()
        rag_context = ""
        memory_context = dual_rate_context
        if audit_enabled:
            print("[dual_rate]", f"chars_in={len(merged)} chars_out={len(dual_rate_context)}")

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
    if rag_context or memory_context or weather_context:
        sections: List[str] = []
        if rag_context:
            sections.append(
                "Retrieved knowledge base context (use this as priority factual reference):\n"
                f"{rag_context}"
            )
        if memory_context:
            sections.append(
                "Retrieved user memory context (personal preference/history reference):\n"
                f"{memory_context}"
            )
        if weather_context:
            sections.append(f"Realtime weather context:\n{weather_context}")
        planner_prompt += (
            "\n\n"
            + "\n\n".join(sections)
            + "\n"
            "If context is insufficient, state uncertainty instead of fabricating facts."
        )

    plan_skeleton = await _run_agent_with_retry(
        system_prompt=PLANNER_SYSTEM.format(language=language),
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
        budget_info = await _run_agent_with_retry(
            system_prompt=BUDGET_SYSTEM.format(language=language),
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
        risk_info = await _run_agent_with_retry(
            system_prompt=RISK_SYSTEM.format(language=language),
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
            language=language,
        )

        if integrator_messages:
            # 如果之前失败，追加修正提示
            integrator_prompt = integrator_messages[-1]

        final_content = await _call_agent(
            INTEGRATOR_SYSTEM.format(language=language),
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
            result = PlanResponse.model_validate(data)
            if collect_usage:
                _log_usage_summary()
            if usage_token is not None:
                _usage_collector.reset(usage_token)
            return result
        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = exc
            integrator_messages.append(
                "Previous output failed validation:\n"
                f"{exc}\n"
                "Return ONLY valid JSON that matches the schema."
            )
    if collect_usage:
        _log_usage_summary()
    if usage_token is not None:
        _usage_collector.reset(usage_token)
    raise RuntimeError(f"LLM output invalid: {last_error}")



def _build_user_prompt(req: PlanRequest) -> str:
    budget = req.budget_text or _budget_range(req)
    schema = json.dumps(PlanResponse.model_json_schema(), ensure_ascii=True)
    language = "Chinese"
    if req.language:
        lowered = req.language.lower()
        if lowered.startswith("en"):
            language = "English"
        elif lowered.startswith("zh"):
            language = "Chinese"
    return USER_TEMPLATE.format(
        language=language,
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


def _log_usage_summary() -> None:
    collector = _usage_collector.get()
    if not collector:
        return
    total = sum(collector)
    avg = total / len(collector)
    print("[llm_avg_tokens]", f"calls={len(collector)} total_tokens={total} avg_total_tokens={avg:.1f}")

def _maybe_log_usage(data: Dict[str, Any]) -> None:
    enabled = os.getenv("LLM_USAGE_LOG", "false").lower() == "true"
    if not enabled:
        return
    usage = data.get("usage")
    if usage is None:
        return
    print("[llm_usage]", usage)
    collector = _usage_collector.get()
    if collector is not None:
        total_tokens = usage.get("total_tokens")
        if isinstance(total_tokens, int):
            collector.append(total_tokens)


async def _call_openai(
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

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        _maybe_log_usage(data)

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected LLM response: {data}") from exc


async def _call_github_models(
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

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        resp = await client.post(url, headers=headers, json=payload)
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
async def _call_agent(
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
        return await _call_github_models(
            api_base=api_base,
            api_key=api_key,
            model=model,
            messages=messages,
            timeout_seconds=timeout_seconds,
        )
    return await _call_openai(
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


def _format_rag_context(chunks: List[Dict[str, Any]]) -> str:
    if not chunks:
        return ""
    lines: List[str] = []
    for i, chunk in enumerate(chunks, start=1):
        title = chunk.get("title") or "Untitled"
        source = chunk.get("source") or "unknown"
        content = (chunk.get("content") or "").strip()
        lines.append(f"[{i}] {title} (source: {source})")
        lines.append(content[:1200])
    return "\n".join(lines)

async def _run_agent_with_retry(
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
        content = await _call_agent(
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
