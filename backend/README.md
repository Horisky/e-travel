# Travel Planner (Backend)

FastAPI backend for a Chinese travel itinerary planner that returns day-by-day plans.

## Quick start

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API:
- `GET /health`
- `POST /api/plan`

## Env

Copy `.env.example` to `.env` and fill in values as needed.

Key vars:
- `LLM_PROVIDER=openai`
- `LLM_API_KEY=...`
- `LLM_MODEL=gpt-4o-mini`
- `LLM_RESPONSE_FORMAT=json_object` (or `json_schema` for stricter schema, OpenAI only)
- `LLM_MAX_RETRIES=2`
- `AGENT_AUDIT_LOG=false` (set to `true` to print planner/budget/risk intermediate outputs)

GitHub Models example:
- `LLM_PROVIDER=github`
- `LLM_API_KEY=<your GitHub PAT>`
- `LLM_API_BASE=https://models.github.ai/inference`
- `LLM_MODEL=openai/gpt-4.1`

## Notes

- LLM integration is stubbed; replace `generate_plan()` with your provider call.
- DB tables are in `schema.sql`.

## RAG (Optional)

1. Create `backend/knowledge/` and add `.txt` files.
2. Ensure DB has `knowledge_docs` table and `vector` extension.
3. Set env:
   - `RAG_ENABLED=true`
   - `RAG_TOP_K=4`
   - `RAG_USE_KB=true`
   - `RAG_USE_MEMORY=true`
   - `RAG_USE_WEATHER=true`
   - `EMBEDDING_MODEL=text-embedding-3-small`
   - `MCP_ENABLED=false` (set `true` to enable MCP weather tool first)
   - `MCP_WEATHER_URL=` (your MCP weather endpoint)
   - `MCP_TOKEN=` (optional bearer token for MCP endpoint)
4. Ingest documents:

```powershell
cd backend
python -m scripts.ingest_knowledge
```

Note:
- `RAG_USE_KB` retrieves from common knowledge base (`knowledge_docs`).
- `RAG_USE_MEMORY` retrieves from per-user memory vectors (`user_memory_docs`).
- `RAG_USE_WEATHER` injects realtime weather context from Open-Meteo.

## Multi-Agent Flow

This backend uses a multi-agent LLM pipeline:
1. Planner Agent creates a trip skeleton.
2. Budget Agent estimates costs and alternatives.
3. Risk Agent checks conflicts and feasibility.
4. Integrator Agent merges outputs and validates against the JSON schema.

This improves controllability, explainability, and output stability compared to a single-call model.

## MCP Weather Tool (Optional)

Run local MCP weather service:

```powershell
cd backend
uvicorn mcp_weather_server:app --host 127.0.0.1 --port 9001 --reload
```

Then set backend `.env`:

```env
MCP_ENABLED=true
MCP_WEATHER_URL=http://127.0.0.1:9001/weather
MCP_TOKEN=
```

If you set `MCP_TOKEN=xxx` for the MCP service process, set the same value in backend `.env`.
