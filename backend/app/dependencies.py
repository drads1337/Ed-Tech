from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from .repositories import Repository, get_repository
from .schemas import Profile, Role
from .supabase_client import get_supabase_client


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")
    return authorization.split(" ", 1)[1].strip()


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    repository: Repository = Depends(get_repository),
) -> Profile:
    token = _extract_bearer_token(authorization)
    try:
        auth_user = get_supabase_client().auth.get_user(token)
        user_id = auth_user.user.id
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.") from exc

    profile = repository.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User profile is missing.")

    return Profile.model_validate(profile)


def require_roles(*roles: Role):
    def dependency(current_user: Profile = Depends(get_current_user)) -> Profile:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role.")
        return current_user

    return dependency
