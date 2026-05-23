from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import assignments, attempts, auth, dashboards, materials, scenarios, simulation
from .services.mock_ai import DEFAULT_SKILLS


FIRST_DAY_SCENARIO_CONTRACT = {
    "title": "Handling objections for new product launch",
    "persona": "Skeptical enterprise customer",
    "openingMessage": "I don't see why we need this product. We already have a solution.",
    "evaluationSkills": DEFAULT_SKILLS,
    "rubric": {
        "accuracy": "Did the employee use correct product facts?",
        "objectionHandling": "Did they handle resistance clearly?",
        "confidence": "Did they sound confident?",
    },
}

DEMO_USERS = [
    {
        "id": "00000000-0000-0000-0000-000000000010",
        "email": "admin@demo.com",
        "name": "Demo Admin",
        "role": "admin",
    },
    {
        "id": "00000000-0000-0000-0000-000000000011",
        "email": "employee1@demo.com",
        "name": "Employee One",
        "role": "employee",
    },
]


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Ed-Tech Training API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(materials.router)
    app.include_router(auth.router)
    app.include_router(scenarios.router)
    app.include_router(assignments.router)
    app.include_router(dashboards.router)
    app.include_router(simulation.router)
    app.include_router(attempts.router)

    @app.get("/api/health")
    def health() -> dict:
        return {"ok": True, "status": "ok"}

    @app.get("/api/ai/status")
    def ai_status() -> dict:
        return {"provider": "deterministic", "model": "mock-ai", "fallback": "deterministic"}

    @app.get("/api/contracts/scenario")
    def scenario_contract() -> dict:
        return FIRST_DAY_SCENARIO_CONTRACT

    @app.get("/api/demo-users")
    def demo_users() -> dict:
        return {"users": DEMO_USERS}

    return app


app = create_app()
