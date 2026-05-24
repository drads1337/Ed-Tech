"""Live simulation endpoints — no auth required (demo phase)."""
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import get_settings
from ..services.live_sim import build_system_prompt, get_ai_response, synthesize_speech

router = APIRouter(prefix="/api/live-sim", tags=["live-sim"])


class StartRequest(BaseModel):
    title: str
    goal: str
    ai_persona: str
    patient_type: str = "neutral"
    language: str = "en"


class ChatRequest(BaseModel):
    system_prompt: str
    transcript: list[dict] = []
    user_message: str
    language: str = "en"


class LiveSimResponse(BaseModel):
    message: str
    audio_base64: str | None = None
    emotion: str
    system_prompt: str = ""


@router.post("/start", response_model=LiveSimResponse)
def start_simulation(payload: StartRequest) -> LiveSimResponse:
    settings = get_settings()
    system_prompt = build_system_prompt(
        payload.title, payload.goal, payload.ai_persona,
        payload.patient_type, payload.language,
    )
    opening, emotion = get_ai_response(
        system_prompt,
        [],
        "Start the conversation. Introduce yourself or your situation briefly in 1-2 sentences.",
        settings,
    )
    audio = synthesize_speech(opening, payload.language, settings)
    return LiveSimResponse(
        message=opening, audio_base64=audio, emotion=emotion, system_prompt=system_prompt
    )


@router.post("/chat", response_model=LiveSimResponse)
def chat(payload: ChatRequest) -> LiveSimResponse:
    settings = get_settings()
    message, emotion = get_ai_response(
        payload.system_prompt, payload.transcript, payload.user_message, settings
    )
    audio = synthesize_speech(message, payload.language, settings)
    return LiveSimResponse(
        message=message, audio_base64=audio, emotion=emotion, system_prompt=payload.system_prompt
    )


@router.get("/config")
def get_live_sim_config() -> dict:
    """Return Deepgram API key for frontend STT."""
    settings = get_settings()
    return {"deepgramApiKey": settings.deepgram_api_key or ""}
