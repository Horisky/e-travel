from typing import List, Optional
from pydantic import BaseModel, Field

class PlanRequest(BaseModel):
    origin: Optional[str] = Field(default=None, description='???')
    destination: Optional[str] = Field(default=None, description='?????????')
    start_date: str = Field(description='?????YYYY-MM-DD')
    days: int = Field(ge=1, le=30, description='??')
    travelers: int = Field(default=1, ge=1, le=20, description='??')
    budget_min: Optional[float] = Field(default=None, ge=0, description='????')
    budget_max: Optional[float] = Field(default=None, ge=0, description='????')
    budget_text: Optional[str] = Field(default=None, description='????')
    preferences: List[str] = Field(default_factory=list, description='??')
    pace: str = Field(default='??', description='??')
    constraints: List[str] = Field(default_factory=list, description='??')

class Destination(BaseModel):
    name: str
    reasons: List[str]
    budget_range: str
    transport: str
    best_season: str

class ActivityBlock(BaseModel):
    title: str
    transport: str
    duration_hours: float
    cost_range: str
    alternatives: List[str] = Field(default_factory=list)

class DayPlan(BaseModel):
    day: int
    morning: ActivityBlock
    afternoon: ActivityBlock
    evening: ActivityBlock

class BudgetBreakdown(BaseModel):
    transport: str
    lodging: str
    food: str
    tickets: str
    local_transport: str

class PlanResponse(BaseModel):
    top_destinations: List[Destination]
    daily_plan: List[DayPlan]
    budget_breakdown: BudgetBreakdown
    warnings: List[str] = Field(default_factory=list)

class AuthRegisterRequest(BaseModel):
    email: str
    password: str
    code: str

class AuthLoginRequest(BaseModel):
    email: str
    password: str

class AuthCodeRequest(BaseModel):
    email: str

class AuthCodeVerifyRequest(BaseModel):
    email: str
    code: str

class ResetPasswordRequest(BaseModel):
    email: str

class ResetPasswordConfirmRequest(BaseModel):
    email: str
    code: str
    new_password: str

class PreferencesRequest(BaseModel):
    origin: Optional[str] = None
    destination: Optional[str] = None
    travelers: Optional[int] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    budget_text: Optional[str] = None
    preferences: List[str] = Field(default_factory=list)
    pace: Optional[str] = None
    constraints: List[str] = Field(default_factory=list)
