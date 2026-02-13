import os
from typing import Any, Dict, List

import httpx

from . import db
from .tools import get_weather_context


def _to_pgvector(values: List[float]) -> str:
    return "[" + ",".join(str(v) for v in values) + "]"


async def _embed_text(text: str) -> List[float]:
    api_key = os.getenv("LLM_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("LLM_API_KEY not set")

    provider = os.getenv("LLM_PROVIDER", "openai").strip().lower()
    if provider == "github":
        api_base = os.getenv("LLM_API_BASE", "https://models.github.ai/inference").strip()
        model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small").strip()
    else:
        api_base = os.getenv("LLM_API_BASE", "https://api.openai.com/v1").strip()
        model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small").strip()

    url = f"{api_base.rstrip('/')}/embeddings"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload: Dict[str, Any] = {
        "model": model,
        "input": text,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    return data["data"][0]["embedding"]


async def retrieve_context(query: str, top_k: int = 4) -> List[Dict[str, Any]]:
    pool = await db.get_pool()
    if pool is None:
        return []

    embedding = await _embed_text(query)
    vector_str = _to_pgvector(embedding)

    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select id, title, source, content
                from knowledge_docs
                order by embedding <=> %s::vector
                limit %s
                """,
                (vector_str, top_k),
            )
            rows = cur.fetchall() or []
            if not rows:
                cur.execute(
                    """
                    select id, title, source, content
                    from knowledge_docs
                    order by created_at desc
                    limit %s
                    """,
                    (top_k,),
                )
                rows = cur.fetchall() or []

    return [
        {
            "id": str(r[0]),
            "title": r[1],
            "source": r[2],
            "content": r[3],
        }
        for r in rows
    ]


async def retrieve_user_memory_context(user_id: str, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
    if not user_id:
        return []
    embedding = await _embed_text(query)
    return await db.load_user_memory_by_vector(user_id, embedding, limit=top_k)


async def save_user_memory_from_plan(user_id: str, query: Dict[str, Any], result: Dict[str, Any]) -> None:
    if not user_id:
        return

    route = f"{query.get('origin') or '出发地'} -> {query.get('destination') or '目的地'}"
    warnings = result.get("warnings") or []
    daily_plan = result.get("daily_plan") or []

    summary_lines = [
        f"路线: {route}",
        f"天数: {query.get('days')}",
        f"偏好: {', '.join(query.get('preferences') or [])}",
        f"提醒: {'; '.join(warnings[:3]) if warnings else '无'}",
    ]

    if daily_plan:
        first_day = daily_plan[0]
        summary_lines.append(
            f"首日安排: 上午{first_day.get('morning', {}).get('title', '')}, "
            f"下午{first_day.get('afternoon', {}).get('title', '')}, "
            f"晚上{first_day.get('evening', {}).get('title', '')}"
        )

    content = "\n".join(summary_lines)
    embedding = await _embed_text(content)

    await db.save_user_memory_doc(
        user_id=user_id,
        title=f"历史偏好记忆: {route}",
        source="user_search_history",
        content=content,
        embedding=embedding,
    )


async def retrieve_weather_context(destination: str | None, start_date: str | None, days: int | None) -> str:
    return await get_weather_context(destination, start_date, days)
