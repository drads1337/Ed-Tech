from datetime import date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Role(str, Enum):
    solo = "solo"
    admin = "admin"
    employee = "employee"


class Profile(ApiModel):
    id: str
    email: str
    name: str
    role: Role
    organization_id: str
    xp: int = 0
    streak: int = 0


class MaterialCreate(ApiModel):
    title: str
    type: str = "text"
    content: str


class TrainingMaterial(ApiModel):
    id: str
    organization_id: str
    title: str
    type: str
    content: str
    created_at: datetime | None = None


class ScenarioGenerateRequest(ApiModel):
    material_id: str
    goal: str = "Practice handling customer objections"
    skills: list[str] = Field(default_factory=list)
    difficulty: str = "medium"


class Scenario(ApiModel):
    id: str
    organization_id: str
    material_id: str
    title: str
    goal: str
    difficulty: str
    persona: str
    opening_message: str
    evaluation_skills: list[str]
    rubric: dict[str, str]
    created_at: datetime | None = None


class AssignmentCreate(ApiModel):
    scenario_id: str
    employee_ids: list[str]
    due_date: date | None = None
    required_score: int = 80


class Assignment(ApiModel):
    id: str
    scenario_id: str
    organization_id: str
    due_date: date | None = None
    required_score: int
    employee_ids: list[str] = Field(default_factory=list)
    created_at: datetime | None = None


class TranscriptMessage(ApiModel):
    role: str
    content: str


class SimulationMessageRequest(ApiModel):
    scenario_id: str
    transcript: list[TranscriptMessage] = Field(default_factory=list)
    user_message: str


class SimulationMessageResponse(ApiModel):
    message: TranscriptMessage
    transcript: list[TranscriptMessage]


class AttemptEvaluateRequest(ApiModel):
    scenario_id: str
    transcript: list[TranscriptMessage]
    assignment_id: str | None = None


class Attempt(ApiModel):
    id: str
    user_id: str
    scenario_id: str
    assignment_id: str | None = None
    transcript: list[TranscriptMessage]
    score: int
    skill_scores: dict[str, int]
    feedback: dict[str, Any]
    created_at: datetime | None = None


class EmployeeDashboardItem(ApiModel):
    assignment_id: str
    scenario: Scenario
    due_date: date | None = None
    required_score: int
    latest_attempt: Attempt | None = None
    status: str


class EmployeeDashboard(ApiModel):
    user: Profile
    assignments: list[EmployeeDashboardItem]


class AdminDashboardEmployee(ApiModel):
    user_id: str
    name: str
    email: str
    completed: bool
    latest_score: int | None = None


class AdminDashboardScenario(ApiModel):
    scenario_id: str
    title: str
    assigned_employees: list[AdminDashboardEmployee]
    completion_rate: float
    average_score: float | None = None


class AdminDashboard(ApiModel):
    organization_id: str
    scenarios: list[AdminDashboardScenario]
    weak_skills: list[str]
