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

## Multi-Agent Flow

This backend uses a multi-agent LLM pipeline:
1. Planner Agent creates a trip skeleton.
2. Budget Agent estimates costs and alternatives.
3. Risk Agent checks conflicts and feasibility.
4. Integrator Agent merges outputs and validates against the JSON schema.

This improves controllability, explainability, and output stability compared to a single-call model.
