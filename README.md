# 🌍 E-Travel — AI-Powered Travel Planner

E-Travel is a full-stack web app that generates personalized travel itineraries with LLMs. It includes a landing intro, login/register, preference memory, and structured day-by-day plans. Because of free render, waiting 2-5 mins for first open, V1.0:[https://app.aivault.asia/]
E-Travel 是一个全栈旅行规划应用，基于大模型生成个性化行程，包含首页介绍、登录/注册、偏好记忆与结构化日程。由于使用免费render部署，平台会自动休眠，须等待2-5分钟方可正常使用,目前已发布V1.0版本：[https://app.aivault.asia/]

---

## ✨ Features | 功能亮点

- LLM-driven itinerary generation (Top 3 destinations + daily plans)
  基于 LLM 生成 Top 3 推荐目的地 + 逐日行程
- Multi-agent pipeline (Planner / Budget / Risk / Integrator)
  多 Agent 链路编排（规划 / 预算 / 风险 / 聚合）
- RAG (knowledge base + user memory + weather tools)
  三层 RAG（知识库 + 用户记忆 + 天气工具）
- MCP weather tool (MCP-first, fallback to Open-Meteo)
  MCP 天气工具（优先 MCP，失败回退 Open-Meteo）
- Login/register with email code verification
  邮箱登录/注册 + 验证码校验
- Preference memory (saved per user)
  用户偏好记忆（保存到数据库）
- Frontend/backed separation (Next.js + FastAPI)
  前后端分离（Next.js + FastAPI）
- Deploy-ready (Vercel + Render)
  可部署（Vercel + Render）

---

## 🏗 Architecture | 架构

```
Browser (Next.js)
      ↓ HTTP
FastAPI Backend
      ↓
LLM Provider (OpenAI / GitHub Models / VectorEngine)
      ↓
Postgres + MCP Weather
```

---

## 🧩 Tech Stack | 技术栈

**Backend | 后端**
- Python 3 + FastAPI
- Pydantic v2, httpx
- PostgreSQL (Render) + pgvector
- JWT auth + email code verification

**Frontend | 前端**
- Next.js 14 (App Router)
- React 18 + Vanilla CSS

**Deployment | 部署**
- Frontend: Vercel
- Backend: Render
- Database: Render Postgres
- MCP Weather: Render (separate service)

---

## 🚀 Local Development | 本地开发

### 1) Clone
```
git clone https://github.com/Horisky/e-travel.git
cd e-travel
```

### 2) Backend
```
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:
```
LLM_PROVIDER=openai
LLM_API_KEY=your_key
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your_long_random_string
JWT_EXPIRE_MINUTES=43200

# Email (optional)
RESEND_API_KEY=your_resend_key
EMAIL_FROM=E-Travel <onboarding@resend.dev>
SEND_CODE_IN_RESPONSE=true
```

Run backend (Windows):
```
uvicorn asgi:app --reload
```

### 3) Frontend
```
cd frontend
npm install
```

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
```

Run frontend:
```
npm run dev
```

---

## 🔐 Auth Flow | 登录与注册

### Register | 注册
1) `POST /api/auth/register/request` 发送验证码
2) `POST /api/auth/register` 提交 email + password + code

### Login | 登录
- 密码登录: `POST /api/auth/login`
- 验证码登录: `POST /api/auth/login-code/request` → `POST /api/auth/login-code/verify`

### Reset Password | 重置密码
- `POST /api/auth/reset-password/request`
- `POST /api/auth/reset-password/confirm`

---

## 📡 API Endpoints | 接口

- `GET /health`
- `POST /api/plan`
- `GET /api/me/preferences`
- `PUT /api/me/preferences`

---

## 🌱 Environment Variables | 环境变量

| Variable | Description |
| --- | --- |
| LLM_PROVIDER | openai / github / vectorengine |
| LLM_API_KEY | LLM API key |
| LLM_API_BASE | API base URL |
| LLM_MODEL | Model name |
| DATABASE_URL | Postgres connection string |
| JWT_SECRET | JWT signing key |
| JWT_EXPIRE_MINUTES | JWT expiry minutes |
| RESEND_API_KEY | Resend API key (optional) |
| EMAIL_FROM | Sender email (optional) |
| SEND_CODE_IN_RESPONSE | true = return code in response (dev) |
| NEXT_PUBLIC_API_BASE | Frontend → backend base URL |
| RAG_ENABLED | Enable RAG |
| RAG_USE_KB | Knowledge base retrieval |
| RAG_USE_MEMORY | User memory retrieval |
| RAG_USE_WEATHER | Weather context retrieval |
| MCP_ENABLED | MCP-first weather |
| MCP_WEATHER_URL | MCP weather endpoint |
| MCP_TOKEN | MCP bearer token |

> ⚠️ Never commit real secrets to GitHub.

---

## 🧭 Notes | 说明

- If you set `SEND_CODE_IN_RESPONSE=true`, the backend will return the code directly instead of sending email (dev mode).
- For production email, verify your own domain in Resend.
- Windows: use `uvicorn asgi:app --reload` to avoid psycopg async event loop issues.
- MCP is optional; the backend falls back to Open‑Meteo when MCP is unavailable.

---

## 📄 License
MIT
