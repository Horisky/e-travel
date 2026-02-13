import os
from functools import lru_cache
from pydantic import BaseModel


def _env_bool(key: str, default: str = "false") -> bool:
    return os.getenv(key, default).strip().lower() == "true"


class Settings(BaseModel):
    # Email / CORS
    resend_api_key: str
    email_from: str
    cors_origins: list[str]
    send_code_in_response: bool

    # LLM
    llm_provider: str
    llm_api_key: str
    llm_api_base: str
    llm_model: str
    llm_response_format: str
    llm_timeout_seconds: int
    llm_max_retries: int

    # Feature flags
    agent_audit_log: bool
    enable_budget_risk: bool
    rag_enabled: bool
    rag_top_k: int
    rag_use_kb: bool
    rag_use_memory: bool
    rag_use_weather: bool
    mcp_enabled: bool


@lru_cache
def get_settings() -> Settings:
    cors_env = os.getenv("CORS_ORIGINS", "").strip()
    extra_origins = [o.strip() for o in cors_env.split(",") if o.strip()]

    llm_provider = os.getenv("LLM_PROVIDER", "openai").strip().lower()
    if llm_provider == "github":
        llm_api_base = os.getenv("LLM_API_BASE", "https://models.github.ai/inference").strip()
        llm_model = os.getenv("LLM_MODEL", "openai/gpt-4.1").strip()
    else:
        default_base = ("https://api.vectorengine.ai/v1" if llm_provider == "vectorengine" else "https://api.openai.com/v1")
        llm_api_base = os.getenv("LLM_API_BASE", default_base).strip()
        llm_model = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()

    return Settings(
        resend_api_key=os.getenv("RESEND_API_KEY", "").strip(),
        email_from=os.getenv("EMAIL_FROM", "E-Travel <no-reply@yourdomain.com>").strip(),
        cors_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://e-travel-murex.vercel.app",
            "https://e-travel-s5rj.vercel.app",
            *extra_origins,
        ],
        send_code_in_response=_env_bool("SEND_CODE_IN_RESPONSE", "true"),
        llm_provider=llm_provider,
        llm_api_key=os.getenv("LLM_API_KEY", "").strip(),
        llm_api_base=llm_api_base,
        llm_model=llm_model,
        llm_response_format=os.getenv("LLM_RESPONSE_FORMAT", "json_object").strip(),
        llm_timeout_seconds=int(os.getenv("LLM_TIMEOUT_SECONDS", "60")),
        llm_max_retries=int(os.getenv("LLM_MAX_RETRIES", "2")),
        agent_audit_log=_env_bool("AGENT_AUDIT_LOG", "false"),
        enable_budget_risk=_env_bool("ENABLE_BUDGET_RISK", "false"),
        rag_enabled=_env_bool("RAG_ENABLED", "false"),
        rag_top_k=int(os.getenv("RAG_TOP_K", "4")),
        rag_use_kb=_env_bool("RAG_USE_KB", "true"),
        rag_use_memory=_env_bool("RAG_USE_MEMORY", "true"),
        rag_use_weather=_env_bool("RAG_USE_WEATHER", "true"),
        mcp_enabled=_env_bool("MCP_ENABLED", "false"),
    )
