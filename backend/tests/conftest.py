import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.dependencies import get_current_user
from app.main import create_app
from app.repositories import InMemoryRepository, get_repository
from app.schemas import Profile, Role


ORG_ID = "00000000-0000-0000-0000-000000000001"
ADMIN_ID = "00000000-0000-0000-0000-000000000010"
EMPLOYEE_ID = "00000000-0000-0000-0000-000000000011"


@pytest.fixture
def repository() -> InMemoryRepository:
    repo = InMemoryRepository()
    repo.organizations[ORG_ID] = {"id": ORG_ID, "name": "Demo Organization"}
    repo.profiles[ADMIN_ID] = {
        "id": ADMIN_ID,
        "email": "admin@demo.com",
        "name": "Demo Admin",
        "role": "admin",
        "organization_id": ORG_ID,
        "xp": 0,
        "streak": 0,
    }
    repo.profiles[EMPLOYEE_ID] = {
        "id": EMPLOYEE_ID,
        "email": "employee1@demo.com",
        "name": "Alina Karimova",
        "role": "employee",
        "organization_id": ORG_ID,
        "xp": 0,
        "streak": 0,
    }
    return repo


@pytest.fixture
def client(repository: InMemoryRepository):
    app = create_app()
    state = {"user_id": ADMIN_ID}

    def override_repository():
        return repository

    def override_current_user():
        return Profile.model_validate(repository.profiles[state["user_id"]])

    app.dependency_overrides[get_repository] = override_repository
    app.dependency_overrides[get_current_user] = override_current_user
    app.state.test_auth = state

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def as_employee(client: TestClient):
    client.app.state.test_auth["user_id"] = EMPLOYEE_ID
    return client


@pytest.fixture
def as_admin(client: TestClient):
    client.app.state.test_auth["user_id"] = ADMIN_ID
    return client
