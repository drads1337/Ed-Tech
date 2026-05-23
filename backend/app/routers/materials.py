from fastapi import APIRouter, Depends

from ..dependencies import require_roles
from ..repositories import Repository, get_repository
from ..schemas import MaterialCreate, Profile, Role, TrainingMaterial

router = APIRouter(prefix="/api/materials", tags=["materials"])


@router.post("", response_model=TrainingMaterial)
def create_material(
    payload: MaterialCreate,
    current_user: Profile = Depends(require_roles(Role.admin, Role.solo)),
    repository: Repository = Depends(get_repository),
) -> dict:
    return repository.create_material(
        {
            "organization_id": current_user.organization_id,
            "title": payload.title,
            "type": payload.type,
            "content": payload.content,
        }
    )
