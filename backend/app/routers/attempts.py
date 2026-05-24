from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import require_roles
from ..repositories import Repository, get_repository
from ..schemas import Attempt, AttemptEvaluateRequest, Profile, Role
from ..services.mock_ai import evaluate_attempt

router = APIRouter(prefix="/api/attempts", tags=["attempts"])


@router.post("/evaluate", response_model=Attempt)
def evaluate_training_attempt(
    payload: AttemptEvaluateRequest,
    current_user: Profile = Depends(require_roles(Role.admin, Role.employee, Role.solo)),
    repository: Repository = Depends(get_repository),
) -> dict:
    scenario = repository.get_scenario(payload.scenario_id, current_user.organization_id)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found.")

    evaluation = evaluate_attempt(scenario, payload.transcript, payload.language)
    return repository.create_attempt(
        {
            "user_id": current_user.id,
            "scenario_id": payload.scenario_id,
            "assignment_id": payload.assignment_id,
            "transcript": [message.model_dump() for message in payload.transcript],
            "score": evaluation["score"],
            "skill_scores": evaluation["skill_scores"],
            "feedback": evaluation["feedback"],
        }
    )
