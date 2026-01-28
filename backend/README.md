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

GitHub Models example:
- `LLM_PROVIDER=github`
- `LLM_API_KEY=<your GitHub PAT>`
- `LLM_API_BASE=https://models.github.ai/inference`
- `LLM_MODEL=openai/gpt-4.1`

## Notes

- LLM integration is stubbed; replace `generate_plan()` with your provider call.
- DB tables are in `schema.sql`.
