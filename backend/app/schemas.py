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


class RegisterRequest(ApiModel):
    name: str
    email: str
    password: str
    role: Role = Role.solo
    organization_name: str | None = None
    room_key: str | None = None


class OnboardingAiSummaryRequest(ApiModel):
    role: str | None = None
    role_label: str | None = None
    industry: str | None = None
    industry_label: str | None = None
    team_size: str | None = None
    goal: str | None = None
    goal_label: str | None = None
    experience: str | None = None
    experience_label: str | None = None
    custom_goal: str | None = None
    language: str = "en"


class OnboardingAiSummary(ApiModel):
    role_line: str
    goal_line: str
    target_line: str
    mode_line: str = ""
    recommended_skills: list[str] = Field(default_factory=list)
    starter_scenario_title: str | None = None


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
    language: str = "en"


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
    content: str = Field(..., alias="message")


class SimulationMessageRequest(ApiModel):
    scenario_id: str
    transcript: list[TranscriptMessage] = Field(default_factory=list)
    user_message: str
    language: str = "en"


class SimulationMessageResponse(ApiModel):
    message: TranscriptMessage
    transcript: list[TranscriptMessage]
    persona_message: str | None = None
    should_end: bool = False


class SimulationSessionCreate(ApiModel):
    scenario_id: str
    user_id: str | None = None


class SimulationSession(ApiModel):
    id: str
    scenario_id: str
    user_id: str | None = None
    scenario: Scenario
    transcript: list[TranscriptMessage]


class SimulationSessionMessageRequest(ApiModel):
    user_message: str


class SimulationSessionCreated(ApiModel):
    session: SimulationSession
    detail: dict


class SimulationSessionMessaged(ApiModel):
    detail: dict


class AttemptEvaluateRequest(ApiModel):
    scenario_id: str
    transcript: list[TranscriptMessage]
    assignment_id: str | None = None
    user_id: str | None = None
    language: str = "en"


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


class DashboardTotals(ApiModel):
    attempts: int = 0
    assignments: int = 0
    employees: int = 0


class AdminDashboard(ApiModel):
    organization_id: str
    organization_name: str | None = None
    scenarios: list[AdminDashboardScenario]
    weak_skills: list[str]
    completion_rate: float = 0.0
    average_score: float | None = None
    totals: DashboardTotals = Field(default_factory=DashboardTotals)


class CorporateDocument(ApiModel):
    id: str
    organization_id: str
    filename: str
    mime_type: str
    extracted_text: str
    status: str = "ready"
    created_by: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CorporateKnowledgeGenerateRequest(ApiModel):
    document_ids: list[str] = Field(default_factory=list)
    source_prompt: str = ""
    language: str = "ru"


class CorporateKnowledgePatch(ApiModel):
    source_prompt: str | None = None
    company_brief: str | None = None
    rules_brief: str | None = None
    client_types: str | None = None
    task_goal: str | None = None
    scoring_rules: str | None = None
    enabled_settings: dict[str, bool] | None = None
    status: str | None = None


class CorporateKnowledgeBase(ApiModel):
    id: str
    organization_id: str
    source_prompt: str = ""
    company_brief: str = ""
    rules_brief: str = ""
    client_types: str = ""
    task_goal: str = ""
    scoring_rules: str = ""
    enabled_settings: dict[str, bool] = Field(default_factory=dict)
    status: str = "draft"
    created_by: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CorporateTaskDraftGenerateRequest(ApiModel):
    knowledge_base_id: str | None = None
    count: int = 3
    language: str = "ru"


class CorporateTaskDraft(ApiModel):
    id: str
    organization_id: str
    knowledge_base_id: str
    title: str
    client_type: str
    skill: str
    difficulty: str = "medium"
    status: str = "draft"
    generated_payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CorporateTaskDraftAssignRequest(ApiModel):
    task_draft_ids: list[str]
    employee_ids: list[str]
    due_date: date | None = None
    required_score: int = 80
    mode: str = "same"


class CorporateTaskDraftAssignResponse(ApiModel):
    assignments: list[Assignment]


class CorporatePrizePatch(ApiModel):
    first_place: str
    second_place: str
    third_place: str


class CorporatePrizes(ApiModel):
    organization_id: str
    first_place: str = ""
    second_place: str = ""
    third_place: str = ""
    updated_by: str | None = None
    updated_at: datetime | None = None


class CorporateReviewSkill(ApiModel):
    label: str
    value: int


class CorporateReviewEmployee(ApiModel):
    id: str
    name: str
    role: str
    result: int
    solved: str
    improved: str
    trained: str
    file_accuracy: int
    usefulness: int
    character: str
    file_behavior: str
    strengths: list[str]
    skills: list[CorporateReviewSkill]


class CorporateReviewTotals(ApiModel):
    documents: int = 0
    assignments: int = 0
    employees: int = 0
    attempts: int = 0
    average_growth: int = 0


class CorporateReviewDashboard(ApiModel):
    organization_id: str
    totals: CorporateReviewTotals
    employees: list[CorporateReviewEmployee]


# ── Solo / CommTrainer schemas ────────────────────────────────────────────────

class Industry(ApiModel):
    id: str
    name: str
    icon: str
    roles: list[str]


class SoloScenario(ApiModel):
    id: str
    industry: str
    skill: str
    title: str
    goal: str
    difficulty: int
    duration_min: int
    xp_reward: int
    coin_reward: int
    ai_persona: str
    patient_type: str | None = None
    emoji: str | None = None
    script: list[dict] = Field(default_factory=list)
    feedback: dict[str, list[str]] = Field(default_factory=dict)


class DailySuggestion(ApiModel):
    id: str
    industry: str
    skill: str
    title: str
    description: str
    price: int = 0
    emoji: str = "⭐"
    difficulty: int = 2
    duration_min: int = 5
    patient_type: str | None = None


class SoloQuest(ApiModel):
    id: str
    text: str
    reward: int
    type: str
    target_skill: str | None = None


class UserProgress(ApiModel):
    user_id: str
    name: str = ""
    primary_industry: str = "medicine"
    role: str = ""
    goal: str = ""
    additional_industries: list[str] = Field(default_factory=list)
    streak: int = 0
    xp: int = 0
    coins: int = 0
    notifications: int = 0
    mode: str = "keyboard"
    quest_done_date: str = ""
    focus_done_date: str = ""
    purchased_suggestion_ids: list[str] = Field(default_factory=list)
    completed: dict[str, Any] = Field(default_factory=dict)
    updated_at: datetime | None = None


class UserProgressUpdate(ApiModel):
    name: str | None = None
    primary_industry: str | None = None
    role: str | None = None
    goal: str | None = None
    additional_industries: list[str] | None = None
    streak: int | None = None
    xp: int | None = None
    coins: int | None = None
    notifications: int | None = None
    mode: str | None = None
    quest_done_date: str | None = None
    focus_done_date: str | None = None
    purchased_suggestion_ids: list[str] | None = None
    completed: dict[str, Any] | None = None


class SoloAttemptCreate(ApiModel):
    scenario_id: str
    rating: int
    xp_gained: int
    coins_gained: int
    transcript: list[dict] = Field(default_factory=list)


class SoloAttempt(ApiModel):
    id: str
    user_id: str
    scenario_id: str
    rating: int
    xp_gained: int
    coins_gained: int
    transcript: list[dict] = Field(default_factory=list)
    created_at: datetime | None = None


class GeneratePlanRequest(ApiModel):
    industry: str
    role: str
    goal: str = ""
    experience: str = "beginner"
    language: str = "en"
