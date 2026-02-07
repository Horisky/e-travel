import os
from pathlib import Path
from typing import Any, Dict, List

import httpx
from dotenv import load_dotenv

# Load .env before importing db module, because db reads env on import.
load_dotenv()

from app import db


def embed_text(text: str) -> List[float]:
    api_key = os.getenv("LLM_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("LLM_API_KEY not set")

    provider = os.getenv("LLM_PROVIDER", "openai").strip().lower()
    if provider == "github":
        api_base = os.getenv("LLM_API_BASE", "https://models.github.ai/inference").strip()
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

    with httpx.Client(timeout=30) as client:
        resp = client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    return data["data"][0]["embedding"]


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150) -> List[str]:
    clean = " ".join(text.split())
    if not clean:
        return []
    chunks: List[str] = []
    start = 0
    while start < len(clean):
        end = min(start + chunk_size, len(clean))
        chunks.append(clean[start:end])
        if end >= len(clean):
            break
        start = max(0, end - overlap)
    return chunks


def upsert_doc(title: str, source: str, content: str) -> None:
    pool = db.get_pool()
    if pool is None:
        raise RuntimeError("DATABASE_URL not set")
    vector = embed_text(content)
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into knowledge_docs (title, source, content, embedding)
                values (%s, %s, %s, %s::vector)
                """,
                (title, source, content, vector),
            )


def main() -> None:
    base = Path("knowledge")
    if not base.exists():
        raise RuntimeError("knowledge folder not found at backend/knowledge")

    files = sorted(base.glob("*.txt"))
    if not files:
        raise RuntimeError("no .txt files found in backend/knowledge")

    total = 0
    for file in files:
        text = file.read_text(encoding="utf-8")
        chunks = chunk_text(text)
        for i, chunk in enumerate(chunks, start=1):
            title = f"{file.stem} - chunk {i}"
            source = str(file)
            upsert_doc(title, source, chunk)
            total += 1
        print(f"[ingest] {file.name}: {len(chunks)} chunks")
    print(f"[ingest] done, inserted {total} chunks")


if __name__ == "__main__":
    main()
