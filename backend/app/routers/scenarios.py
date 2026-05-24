from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import require_roles
from ..repositories import Repository, get_repository
from ..schemas import Profile, Role, Scenario, ScenarioGenerateRequest
from ..services.mock_ai import generate_scenario

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.post("/generate", response_model=Scenario)
def generate_training_scenario(
    payload: ScenarioGenerateRequest,
    current_user: Profile = Depends(require_roles(Role.admin, Role.solo)),
    repository: Repository = Depends(get_repository),
) -> dict:
    material = repository.get_material(payload.material_id, current_user.organization_id)
    if not material:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found.")

    generated = generate_scenario(material, payload.goal, payload.skills, payload.difficulty, payload.language)
    return repository.create_scenario(
        {
            "organization_id": current_user.organization_id,
            "material_id": payload.material_id,
            **generated,
        }
    )
