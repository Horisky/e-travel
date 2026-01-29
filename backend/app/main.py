import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import PlanRequest, PlanResponse, Destination, DayPlan, ActivityBlock, BudgetBreakdown
from .llm import generate_plan_with_llm

app = FastAPI(title='Travel Planner API')
load_dotenv()

# Allow local frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://e-travel-murex.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get('/health')
def health():
    return {'status': 'ok'}

@app.post('/api/plan', response_model=PlanResponse)
def plan(req: PlanRequest):
    try:
        return generate_plan_with_llm(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def generate_plan(req: PlanRequest) -> PlanResponse:
    # Minimal stub response for local testing
    dests = [
        Destination(
            name='??',
            reasons=['????', '??????'],
            budget_range='3000-6000 RMB',
            transport='??/??',
            best_season='??'
        ),
        Destination(
            name='??',
            reasons=['????', '???'],
            budget_range='3500-7000 RMB',
            transport='??/??',
            best_season='??'
        ),
        Destination(
            name='??',
            reasons=['????', '?????'],
            budget_range='3000-6500 RMB',
            transport='??/??',
            best_season='??'
        )
    ]

    block = ActivityBlock(
        title='????',
        transport='??/??',
        duration_hours=3.0,
        cost_range='100-300 RMB',
        alternatives=['????A', '????B']
    )

    daily = [DayPlan(day=i + 1, morning=block, afternoon=block, evening=block) for i in range(req.days)]

    budget = BudgetBreakdown(
        transport='30%',
        lodging='35%',
        food='20%',
        tickets='10%',
        local_transport='5%'
    )

    return PlanResponse(
        top_destinations=dests,
        daily_plan=daily,
        budget_breakdown=budget,
        warnings=['???????????????']
    )
