from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..dependencies import get_current_user
from ..repositories import Repository, get_repository
from ..config import get_settings
from ..schemas import (
    DailySuggestion,
    GeneratePlanRequest,
    Industry,
    Profile,
    SoloAttempt,
    SoloAttemptCreate,
    SoloQuest,
    SoloScenario,
    UserProgress,
    UserProgressUpdate,
)
from ..services.plan_ai import generate_learning_plan

router = APIRouter(prefix="/api/solo", tags=["solo"])


@router.get("/industries", response_model=list[Industry])
def list_industries(repository: Repository = Depends(get_repository)) -> list[dict]:
    return repository.list_industries()


@router.get("/scenarios", response_model=list[SoloScenario])
def list_scenarios(
    industry_ids: str | None = Query(default=None, description="Comma-separated industry IDs"),
    repository: Repository = Depends(get_repository),
) -> list[dict]:
    ids = [i.strip() for i in industry_ids.split(",")] if industry_ids else None
    return repository.list_solo_scenarios(ids)


@router.get("/scenarios/{scenario_id}", response_model=SoloScenario)
def get_scenario(
    scenario_id: str,
    repository: Repository = Depends(get_repository),
) -> dict:
    scenario = repository.get_solo_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")
    return scenario


@router.get("/daily-suggestions", response_model=list[DailySuggestion])
def daily_suggestions(
    industry_ids: str | None = Query(default=None, description="Comma-separated industry IDs"),
    repository: Repository = Depends(get_repository),
) -> list[dict]:
    ids = [i.strip() for i in industry_ids.split(",")] if industry_ids else None
    return repository.list_daily_suggestions(ids)


@router.get("/quest/daily", response_model=SoloQuest)
def daily_quest(repository: Repository = Depends(get_repository)) -> dict:
    quest = repository.get_daily_quest()
    if not quest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No quest available")
    return quest


@router.get("/progress", response_model=UserProgress)
def get_progress(
    current_user: Profile = Depends(get_current_user),
    repository: Repository = Depends(get_repository),
) -> dict:
    progress = repository.get_user_progress(current_user.id)
    if not progress:
        # Return empty progress seeded from profile
        return {
            "user_id": current_user.id,
            "name": current_user.name,
            "primary_industry": "medicine",
            "role": "",
            "goal": "",
            "additional_industries": [],
            "streak": current_user.streak,
            "xp": current_user.xp,
            "coins": 0,
            "notifications": 0,
            "mode": "keyboard",
            "quest_done_date": "",
            "focus_done_date": "",
            "purchased_suggestion_ids": [],
            "completed": {},
        }
    return progress


@router.post("/progress", response_model=UserProgress)
def upsert_progress(
    payload: UserProgressUpdate,
    current_user: Profile = Depends(get_current_user),
    repository: Repository = Depends(get_repository),
) -> dict:
    data = {k: v for k, v in payload.model_dump(by_alias=False).items() if v is not None}
    result = repository.upsert_user_progress(current_user.id, data)
    # Mirror xp/streak back to the main profile row
    profile_patch: dict = {}
    if "xp" in data:
        profile_patch["xp"] = data["xp"]
    if "streak" in data:
        profile_patch["streak"] = data["streak"]
    if profile_patch:
        profile_patch["id"] = current_user.id
        profile_patch.setdefault("email", current_user.email)
        profile_patch.setdefault("name", current_user.name)
        profile_patch.setdefault("role", current_user.role.value)
        profile_patch.setdefault("organization_id", current_user.organization_id)
        try:
            repository.upsert_profile(profile_patch)
        except Exception:
            pass
    return result


@router.post("/attempts", response_model=SoloAttempt, status_code=status.HTTP_201_CREATED)
def create_attempt(
    payload: SoloAttemptCreate,
    current_user: Profile = Depends(get_current_user),
    repository: Repository = Depends(get_repository),
) -> dict:
    scenario = repository.get_solo_scenario(payload.scenario_id)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")
    data = payload.model_dump(by_alias=False)
    data["user_id"] = current_user.id
    return repository.create_solo_attempt(data)


@router.post("/generate-plan")
def generate_plan(payload: GeneratePlanRequest) -> list[dict]:
    settings = get_settings()
    return generate_learning_plan(
        industry=payload.industry,
        role=payload.role,
        goal=payload.goal,
        experience=payload.experience,
        language=payload.language,
        settings=settings,
    )
