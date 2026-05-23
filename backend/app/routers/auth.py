from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import get_current_user
from ..repositories import Repository, get_repository
from ..schemas import Profile, RegisterRequest, Role
from ..supabase_client import get_supabase_client

DEMO_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001"

router = APIRouter(prefix="/api", tags=["auth"])


@router.get("/me", response_model=Profile)
def get_me(current_user: Profile = Depends(get_current_user)) -> Profile:
    return current_user


@router.post("/auth/register", response_model=Profile)
def register_user(
    payload: RegisterRequest,
    repository: Repository = Depends(get_repository),
) -> dict:
    organization_id = DEMO_ORGANIZATION_ID
    if payload.role == Role.admin:
        organization = repository.create_organization(payload.organization_name or "New Organization")
        organization_id = organization["id"]
    elif payload.role == Role.employee and not payload.room_key:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Room key is required.")

    try:
        created_user = get_supabase_client().auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {"name": payload.name},
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return repository.upsert_profile(
        {
            "id": created_user.user.id,
            "organization_id": organization_id,
            "email": payload.email,
            "name": payload.name,
            "role": payload.role.value,
            "xp": 0,
            "streak": 0,
        }
    )
