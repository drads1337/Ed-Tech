from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import require_roles
from ..repositories import Repository, get_repository
from ..schemas import Profile, Role, SimulationMessageRequest, SimulationMessageResponse, TranscriptMessage
from ..services.mock_ai import continue_roleplay

router = APIRouter(prefix="/api/simulation", tags=["simulation"])


@router.post("/message", response_model=SimulationMessageResponse)
def send_simulation_message(
    payload: SimulationMessageRequest,
    current_user: Profile = Depends(require_roles(Role.employee, Role.solo)),
    repository: Repository = Depends(get_repository),
) -> SimulationMessageResponse:
    scenario = repository.get_scenario(payload.scenario_id, current_user.organization_id)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found.")

    user_message = TranscriptMessage(role="user", content=payload.user_message)
    next_message = continue_roleplay(scenario, payload.transcript, payload.user_message)
    return SimulationMessageResponse(
        message=next_message,
        transcript=[*payload.transcript, user_message, next_message],
    )
