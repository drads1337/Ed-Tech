from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

# from ..dependencies import require_roles
from ..repositories import DEMO_ADMIN_ID, DEMO_ORG_ID, Repository, get_repository
from ..schemas import (
    Profile,
    Role,
    SimulationMessageRequest,
    SimulationMessageResponse,
    SimulationSession,
    SimulationSessionCreate,
    SimulationSessionCreated,
    SimulationSessionMessageRequest,
    SimulationSessionMessaged,
    TranscriptMessage,
)
from ..services.mock_ai import continue_roleplay

router = APIRouter(prefix="/api/simulation", tags=["simulation"])

_DEMO_USER = Profile(
    id=DEMO_ADMIN_ID,
    email="admin@demo.com",
    name="Demo Admin",
    role=Role.admin,
    organization_id=DEMO_ORG_ID,
)


@router.post("/message", response_model=SimulationMessageResponse)
def send_simulation_message(
    payload: SimulationMessageRequest,
    # current_user: Profile = Depends(require_roles(Role.admin, Role.employee, Role.solo)),
    repository: Repository = Depends(get_repository),
) -> SimulationMessageResponse:
    current_user = _DEMO_USER
    scenario = repository.get_scenario(payload.scenario_id, current_user.organization_id)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found.")

    user_message = TranscriptMessage(role="user", content=payload.user_message)
    next_message = continue_roleplay(scenario, payload.transcript, payload.user_message)
    return SimulationMessageResponse(
        message=next_message,
        transcript=[*payload.transcript, user_message, next_message],
        persona_message=next_message.content,
        should_end=False,
    )


@router.post("/sessions")
def create_simulation_session(
    payload: SimulationSessionCreate,
    # current_user: Profile = Depends(require_roles(Role.admin, Role.solo)),
    repository: Repository = Depends(get_repository),
) -> dict:
    current_user = _DEMO_USER
    scenario = repository.get_scenario(payload.scenario_id, current_user.organization_id)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found.")

    opening = TranscriptMessage(role="persona", content=scenario["opening_message"])
    session = repository.create_session(
        {
            "scenario_id": payload.scenario_id,
            "user_id": payload.user_id or current_user.id,
            "transcript": [opening.model_dump(by_alias=True)],
        }
    )
    session["scenario"] = scenario
    return {
        "session": {"id": session["id"]},
        "detail": {
            "session": {"id": session["id"]},
            "transcript": session["transcript"],
        },
    }


@router.post("/sessions/{session_id}/message")
def send_session_message(
    session_id: str,
    payload: SimulationSessionMessageRequest,
    # current_user: Profile = Depends(require_roles(Role.admin, Role.solo)),
    repository: Repository = Depends(get_repository),
) -> dict:
    current_user = _DEMO_USER
    session = repository.get_session(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    scenario = repository.get_scenario(session["scenario_id"], current_user.organization_id)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found.")

    transcript = session["transcript"]
    prev_messages = [TranscriptMessage(**m) for m in transcript]

    user_message = TranscriptMessage(role="user", content=payload.user_message)
    next_message = continue_roleplay(scenario, prev_messages, payload.user_message)

    updated = [*transcript, user_message.model_dump(by_alias=True), next_message.model_dump(by_alias=True)]
    repository.update_session_transcript(session_id, updated)

    return {
        "detail": {
            "session": {"id": session_id},
            "transcript": updated,
        },
    }
