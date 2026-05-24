"""Live simulation: LLM character roleplay + Deepgram TTS."""
import base64
import re

import httpx

from ..config import Settings

# ── System prompt ──────────────────────────────────────────────────────────
SIM_SYSTEM_PROMPT = """You are roleplaying as a realistic person in a professional communication training simulation.

Character: {ai_persona}
Scenario: {title}
Your goal in this conversation: {goal}
Your current emotional state: {emotion_desc}
Language: respond ONLY in {language_name}

Rules:
- You are a real person, NOT an AI assistant. Never say you are AI.
- Keep every reply SHORT — 2 to 3 sentences maximum. This is a voice conversation.
- React to how the trainee speaks. Be more cooperative when they are empathetic and professional.
- If they are rude or dismissive, push back naturally as this character would.
- Stay in character throughout.
- After your reply, on a new line write exactly: EMOTION: <neutral|happy|angry|sad>
""".strip()

EMOTION_DESCS = {
    "angry": "frustrated, tense, difficult to please",
    "sad": "withdrawn, quiet, emotionally drained",
    "vip": "important, slightly impatient, expects excellence",
    "good": "friendly, cooperative, open",
    "neutral": "calm, professional, neutral",
}

LANGUAGE_NAMES = {"en": "English", "ru": "Russian", "uz": "Uzbek"}
TTS_MODEL = "openai/gpt-4o-mini-tts-2025-12-15"
TTS_VOICE = "nova"  # OpenAI voice: alloy | echo | fable | onyx | nova | shimmer


def build_system_prompt(title: str, goal: str, ai_persona: str, patient_type: str, language: str) -> str:
    return SIM_SYSTEM_PROMPT.format(
        ai_persona=ai_persona,
        title=title,
        goal=goal,
        emotion_desc=EMOTION_DESCS.get(patient_type, EMOTION_DESCS["neutral"]),
        language_name=LANGUAGE_NAMES.get(language, "English"),
    )


def _parse_llm_response(content: str) -> tuple[str, str]:
    """Split the model output into (message, emotion)."""
    match = re.search(r"EMOTION:\s*(neutral|happy|angry|sad)", content, re.IGNORECASE)
    emotion = match.group(1).lower() if match else "neutral"
    text = content[: match.start()].strip() if match else content.strip()
    return text, emotion


def get_ai_response(
    system_prompt: str,
    transcript: list[dict],
    user_message: str,
    settings: Settings,
) -> tuple[str, str]:
    """Call OpenRouter and return (reply_text, emotion)."""
    if not settings.openrouter_api_key:
        return "I understand. Please continue.", "neutral"

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for turn in transcript:
        role = turn.get("role", "user")
        text = turn.get("text") or turn.get("content") or turn.get("message") or ""
        if role == "ai":
            messages.append({"role": "assistant", "content": text})
        elif role == "user":
            messages.append({"role": "user", "content": text})

    messages.append({"role": "user", "content": user_message})

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "X-Title": settings.openrouter_app_name,
    }
    if settings.openrouter_app_url:
        headers["HTTP-Referer"] = settings.openrouter_app_url

    body = {
        "model": settings.openrouter_model,
        "messages": messages,
        "temperature": 0.85,
        "max_tokens": 150,
    }

    try:
        resp = httpx.post(
            f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json=body,
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return _parse_llm_response(content)
    except Exception:
        return "I see. Please go on.", "neutral"


def synthesize_speech(text: str, _language: str, settings: Settings) -> str | None:
    """Call OpenRouter TTS, return base64-encoded MP3 or None."""
    if not settings.openrouter_api_key:
        return None

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "X-Title": settings.openrouter_app_name,
    }
    if settings.openrouter_app_url:
        headers["HTTP-Referer"] = settings.openrouter_app_url

    try:
        resp = httpx.post(
            f"{settings.openrouter_base_url.rstrip('/')}/audio/speech",
            headers=headers,
            json={"model": TTS_MODEL, "input": text, "voice": TTS_VOICE},
            timeout=20,
        )
        resp.raise_for_status()
        return base64.b64encode(resp.content).decode()
    except Exception:
        return None
