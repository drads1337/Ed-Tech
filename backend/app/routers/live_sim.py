"""Live simulation endpoints — no auth required (demo phase)."""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..config import get_settings
from ..services.live_sim import build_system_prompt, evaluate_live_brief, get_ai_response, synthesize_speech

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


class BriefRequest(BaseModel):
    title: str = ""
    goal: str = ""
    transcript: list[dict] = []
    emotion_log: list[dict] = []
    motion_log: list[dict] = []
    language: str = "ru"


class LiveSimResponse(BaseModel):
    message: str
    audio_base64: str | None = None
    audio_mime: str = "audio/mpeg"
    emotion: str
    motions: list[str] = Field(default_factory=lambda: ["talking"])
    system_prompt: str = ""


class LiveBriefResponse(BaseModel):
    score: int
    rating: int
    goal_achieved: bool
    summary: str
    positives: list[str]
    negatives: list[str]
    next_steps: list[str] = Field(default_factory=list)


@router.post("/start", response_model=LiveSimResponse)
def start_simulation(payload: StartRequest) -> LiveSimResponse:
    settings = get_settings()
    system_prompt = build_system_prompt(
        payload.title, payload.goal, payload.ai_persona,
        payload.patient_type, payload.language,
    )
    opening, emotion, motions = get_ai_response(
        system_prompt,
        [],
        "Start the conversation. Introduce yourself or your situation briefly in 1-2 sentences.",
        settings,
    )
    audio, mime = synthesize_speech(opening, payload.language, settings)
    return LiveSimResponse(
        message=opening, audio_base64=audio, audio_mime=mime or "audio/mpeg",
        emotion=emotion, motions=motions, system_prompt=system_prompt,
    )


@router.post("/chat", response_model=LiveSimResponse)
def chat(payload: ChatRequest) -> LiveSimResponse:
    settings = get_settings()
    message, emotion, motions = get_ai_response(
        payload.system_prompt, payload.transcript, payload.user_message, settings
    )
    audio, mime = synthesize_speech(message, payload.language, settings)
    return LiveSimResponse(
        message=message, audio_base64=audio, audio_mime=mime or "audio/mpeg",
        emotion=emotion, motions=motions, system_prompt=payload.system_prompt,
    )


@router.post("/brief", response_model=LiveBriefResponse)
def brief(payload: BriefRequest) -> LiveBriefResponse:
    settings = get_settings()
    result = evaluate_live_brief(
        payload.title,
        payload.goal,
        payload.transcript,
        payload.emotion_log,
        payload.motion_log,
        payload.language,
        settings,
    )
    return LiveBriefResponse(**result)


@router.get("/config")
def get_live_sim_config() -> dict:
    """Return Deepgram API key for frontend STT."""
    settings = get_settings()
    return {"deepgramApiKey": settings.deepgram_api_key or ""}
