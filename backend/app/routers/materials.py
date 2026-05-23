from fastapi import APIRouter, Depends, HTTPException, status

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


@router.get("/{material_id}/chunks")
def get_material_chunks(
    material_id: str,
    current_user: Profile = Depends(require_roles(Role.admin, Role.solo)),
    repository: Repository = Depends(get_repository),
) -> dict:
    material = repository.get_material(material_id, current_user.organization_id)
    if not material:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found.")

    content = material.get("content", "")
    chunks = [
        {"id": f"{material_id}:{index + 1}", "content": chunk.strip()}
        for index, chunk in enumerate(content.split("\n\n"))
        if chunk.strip()
    ]
    return {"chunks": chunks}
