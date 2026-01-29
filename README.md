# 🌍 E-Travel — AI-Powered Travel Planner

E-Travel is a full-stack web application that generates **personalized travel itineraries** using large language models (LLMs). Users provide basic travel preferences, and the system returns a structured, human-readable travel plan.  
E-Travel 是一个全栈应用，使用大语言模型生成**个性化旅行行程**。用户输入出行偏好后，系统会输出结构化、可阅读的旅行计划。

This project demonstrates a **production-style LLM application**, including frontend–backend separation, API design, model abstraction, and cloud deployment.  
本项目展示了**生产级 LLM 应用**的完整流程：前后端分离、API 设计、模型抽象与云端部署。

---

## ✨ Features | 功能亮点

* 🧠 **LLM-driven itinerary generation** based on user preferences  
  🧠 基于用户偏好的 **LLM 行程生成**
* 🔁 **Pluggable model provider** (OpenAI / GitHub Models)  
  🔁 可插拔模型提供方（OpenAI / GitHub Models）
* 🚀 **FastAPI backend** with clean REST APIs  
  🚀 FastAPI 后端 + 清晰 REST API
* ⚛️ **Next.js 14 frontend** using App Router  
  ⚛️ Next.js 14 前端（App Router）
* 🌐 **Fully deployed** (Vercel + Render)  
  🌐 完整部署（Vercel + Render）
* 🔐 **Environment-variable based configuration**  
  🔐 环境变量配置

---

## 🏗️ Architecture Overview | 架构概览

```
Browser (Next.js 14)
        ↓ HTTP
FastAPI Backend (Python)
        ↓
LLM Provider (OpenAI / GitHub Models)
```

* Frontend and backend are **fully decoupled**  
  前后端 **完全解耦**
* Backend exposes REST endpoints consumed by the frontend  
  后端提供 REST API 供前端调用
* LLM access is abstracted to allow easy switching between providers  
  模型调用已抽象，便于切换提供方

---

## 🧩 Tech Stack | 技术栈

### Backend | 后端

* **Language**: Python 3  
  **语言**：Python 3
* **Framework**: FastAPI  
  **框架**：FastAPI
* **ASGI Server**: Uvicorn  
  **ASGI 服务**：Uvicorn
* **Data Validation**: Pydantic v2  
  **数据校验**：Pydantic v2
* **HTTP Client**: httpx  
  **HTTP 客户端**：httpx
* **Environment Management**: python-dotenv  
  **环境变量**：python-dotenv
* **API Style**: REST (`/health`, `/api/plan`)  
  **API 风格**：REST（`/health`, `/api/plan`）
* **CORS**: Enabled for frontend access  
  **CORS**：已开启

### Frontend | 前端

* **Framework**: Next.js 14 (App Router)  
  **框架**：Next.js 14（App Router）
* **UI**: React 18 + Vanilla CSS  
  **UI**：React 18 + 原生 CSS
* **Form-based SPA** with dynamic result rendering  
  **单页表单应用** + 动态结果渲染
* **Environment Variable**: `NEXT_PUBLIC_API_BASE`  
  **环境变量**：`NEXT_PUBLIC_API_BASE`

### Deployment | 部署

* **Frontend**: Vercel  
  **前端**：Vercel
* **Backend**: Render (Web Service)  
  **后端**：Render（Web Service）
* **Source Control**: GitHub  
  **代码托管**：GitHub
* **Secrets Management**: Vercel / Render environment variables  
  **密钥管理**：Vercel / Render 环境变量

---

## 📡 API Endpoints | API 接口

### `GET /health`

Health check endpoint.  
健康检查接口。

**Response / 响应**:

```json
{ "status": "ok" }
```

---

### `POST /api/plan`

Generate a travel plan based on user input.  
根据用户输入生成旅行计划。

**Request Body (example) / 请求示例**:

```json
{
  "origin": "Shanghai",
  "start_date": "2026-02-10",
  "days": 3,
  "travelers": 2,
  "budget_min": 3000,
  "budget_max": 6000,
  "preferences": ["food", "sea"],
  "pace": "适中",
  "constraints": ["不自驾", "尽量直飞"]
}
```

**Response (example) / 返回示例**:

```json
{
  "top_destinations": [],
  "daily_plan": [],
  "budget_breakdown": {},
  "warnings": []
}
```

---

## ⚙️ Local Development | 本地开发

### 1️⃣ Clone the repository | 克隆仓库

```bash
git clone https://github.com/Horisky/e-travel.git
cd e-travel
```

---

### 2️⃣ Backend setup | 后端启动

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate
pip install -r requirements.txt
```

Create a `.env` file:  
创建 `.env`：

```env
LLM_PROVIDER=openai  # or github
LLM_API_KEY=your_api_key_here
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Run the server / 启动服务：

```bash
uvicorn app.main:app --reload
```

---

### 3️⃣ Frontend setup | 前端启动

```bash
cd frontend
npm install
```

Create `.env.local`:  
创建 `.env.local`：

```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

Run the frontend / 启动前端：

```bash
npm run dev
```

---

## 🔐 Environment Variables | 环境变量

| Variable | Description |
| --- | --- |
| `LLM_PROVIDER` | `openai` or `github` |
| `LLM_API_KEY` | API key for OpenAI / GitHub Models |
| `LLM_API_BASE` | API base URL |
| `LLM_MODEL` | Model name |
| `NEXT_PUBLIC_API_BASE` | Backend base URL |

> ⚠️ Never commit real API keys to GitHub.  
> ⚠️ 不要把真实 API Key 提交到 GitHub。

---

## 🌟 Project Highlights | 项目亮点

* Clean separation of concerns (UI / API / LLM)  
  清晰的职责分离（UI / API / LLM）
* Real-world deployment workflow  
  实际可上线的部署流程
* Structured business output  
  结构化业务输出
* Easily extensible to other AI-powered tasks  
  易扩展到其他 AI 场景

---

## 📈 Possible Improvements | 可扩展方向

* User accounts & saved itineraries  
  用户账户与历史行程
* Streaming responses from LLM  
  LLM 流式输出
* Token usage & cost monitoring  
  成本与用量统计
* Prompt versioning and evaluation  
  Prompt 版本管理与评估

---

## 📄 License | 许可证

MIT License

---

## 🙌 Acknowledgements | 致谢

* FastAPI
* Next.js
* OpenAI / GitHub Models

---

If you find this project useful, feel free to ⭐️ the repository!  
如果你觉得有帮助，欢迎点 ⭐️ 支持！
