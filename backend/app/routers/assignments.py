from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import require_roles
from ..repositories import Repository, get_repository
from ..schemas import Assignment, AssignmentCreate, Profile, Role

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.post("", response_model=Assignment)
def create_assignment(
    payload: AssignmentCreate,
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
) -> dict:
    scenario = repository.get_scenario(payload.scenario_id, current_user.organization_id)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found.")

    return repository.create_assignment(
        {
            "organization_id": current_user.organization_id,
            "scenario_id": payload.scenario_id,
            "due_date": payload.due_date.isoformat() if payload.due_date else None,
            "required_score": payload.required_score,
        },
        payload.employee_ids,
    )
