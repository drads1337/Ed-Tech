from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import assignments, attempts, dashboards, materials, scenarios, simulation


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
    app.include_router(scenarios.router)
    app.include_router(assignments.router)
    app.include_router(dashboards.router)
    app.include_router(simulation.router)
    app.include_router(attempts.router)

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
