"""Live simulation: LLM character roleplay + Deepgram TTS."""
import base64
import json
import re
import struct

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
- After that, on a new line write exactly: MOTION: <idle|listening|thinking|talking|gesture>[,<idle|listening|thinking|talking|gesture>]
- Use MOTION to match the reply. You may combine 2-3 modes when natural, for example talking,gesture or thinking,talking.
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
TTS_VOICE = "onyx"  # OpenAI voice: alloy | echo | fable | onyx | nova | shimmer
ALLOWED_EMOTIONS = {"neutral", "happy", "angry", "sad"}
ALLOWED_MOTIONS = {"idle", "listening", "thinking", "talking", "gesture"}

BRIEF_SYSTEM_PROMPT = """You are an expert communication coach.

Evaluate the trainee's live roleplay dialogue. Use the full transcript and scenario context.
The transcript contains assistant/AI character turns and trainee user turns from STT.
Use assistant/AI turns as context, but score only the trainee's user turns.
Use emotion_log and motion_log to understand the character state and whether the live avatar states matched the conversation.
Return ONLY valid JSON with this exact shape:
{
  "score": 1-100,
  "rating": 1-3,
  "goal_achieved": true/false,
  "summary": "short summary",
  "positives": ["3 concrete strengths"],
  "negatives": ["3 concrete improvements"],
  "next_steps": ["2 short next practice actions"]
}
Write all text fields in {language_name}.
Do not include markdown.
""".strip()


def build_system_prompt(title: str, goal: str, ai_persona: str, patient_type: str, language: str) -> str:
    return SIM_SYSTEM_PROMPT.format(
        ai_persona=ai_persona,
        title=title,
        goal=goal,
        emotion_desc=EMOTION_DESCS.get(patient_type, EMOTION_DESCS["neutral"]),
        language_name=LANGUAGE_NAMES.get(language, "English"),
    )


def _parse_motions(raw: str | None, fallback: list[str] | None = None) -> list[str]:
    motions: list[str] = []
    for item in (raw or "").split(","):
        motion = item.strip().lower()
        if motion in ALLOWED_MOTIONS and motion not in motions:
            motions.append(motion)
    return motions[:3] or fallback or ["talking"]


def _parse_llm_response(content: str) -> tuple[str, str, list[str]]:
    """Split the model output into (message, emotion, motions)."""
    match = re.search(r"EMOTION:\s*(neutral|happy|angry|sad)", content, re.IGNORECASE)
    motion_match = re.search(r"MOTION:\s*([a-z,\s]+)", content, re.IGNORECASE)
    emotion = match.group(1).lower() if match else "neutral"
    if emotion not in ALLOWED_EMOTIONS:
        emotion = "neutral"
    cut_points = [m.start() for m in (match, motion_match) if m]
    text = content[: min(cut_points)].strip() if cut_points else content.strip()
    motions = _parse_motions(motion_match.group(1) if motion_match else None)
    return text, emotion, motions


def get_ai_response(
    system_prompt: str,
    transcript: list[dict],
    user_message: str,
    settings: Settings,
) -> tuple[str, str, list[str]]:
    """Call OpenRouter and return (reply_text, emotion, motions)."""
    if not settings.openrouter_api_key:
        return "I understand. Please continue.", "neutral", ["talking", "listening"]

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
        return "I see. Please go on.", "neutral", ["talking"]


def _fallback_brief(title: str, goal: str, transcript: list[dict]) -> dict:
    user_messages = [
        (turn.get("text") or turn.get("content") or turn.get("message") or "")
        for turn in transcript
        if turn.get("role") == "user"
    ]
    has_user_input = any(message.strip() for message in user_messages)
    return {
        "score": 62 if has_user_input else 35,
        "rating": 2 if has_user_input else 1,
        "goal_achieved": bool(has_user_input),
        "summary": (
            f"Диалог по сценарию «{title or 'Live simulation'}» завершён. "
            f"Цель: {goal or 'тренировка коммуникации'}. "
            f"{'Цель частично достигнута.' if has_user_input else 'Цель не достигнута: не было содержательного ответа пользователя.'}"
        ),
        "positives": [
            "Вы довели тренировку до завершения.",
            "В диалоге был сохранён профессиональный контекст.",
            "Ответы можно использовать как основу для дальнейшей практики.",
        ],
        "negatives": [
            "Добавьте больше явной эмпатии в начале ответа.",
            "Формулируйте следующий шаг конкретнее: действие, срок, ответственный.",
            "Подкрепляйте позицию фактами и ограничениями, чтобы не звучать голословно.",
        ],
        "next_steps": [
            "Повторите сценарий и начните с признания эмоции клиента.",
            "Закрывайте каждый ответ понятным следующим шагом.",
        ],
    }


def _clean_brief_payload(raw: dict, fallback: dict) -> dict:
    def list_of_strings(value, fallback_value, limit):
        if not isinstance(value, list):
            return fallback_value
        cleaned = [str(item).strip() for item in value if str(item).strip()]
        return (cleaned or fallback_value)[:limit]

    score = raw.get("score", fallback["score"])
    rating = raw.get("rating", fallback["rating"])
    try:
        score = max(1, min(100, int(score)))
    except (TypeError, ValueError):
        score = fallback["score"]
    try:
        rating = max(1, min(3, int(rating)))
    except (TypeError, ValueError):
        rating = fallback["rating"]

    return {
        "score": score,
        "rating": rating,
        "goal_achieved": bool(raw.get("goal_achieved", fallback.get("goal_achieved", score >= 60))),
        "summary": str(raw.get("summary") or fallback["summary"]).strip(),
        "positives": list_of_strings(raw.get("positives"), fallback["positives"], 4),
        "negatives": list_of_strings(raw.get("negatives"), fallback["negatives"], 4),
        "next_steps": list_of_strings(raw.get("next_steps"), fallback["next_steps"], 3),
    }


def evaluate_live_brief(
    title: str,
    goal: str,
    transcript: list[dict],
    emotion_log: list[dict],
    motion_log: list[dict],
    language: str,
    settings: Settings,
) -> dict:
    """Ask the LLM to evaluate the full live dialogue and return a brief."""
    fallback = _fallback_brief(title, goal, transcript)
    if not settings.openrouter_api_key:
        return fallback

    language_name = LANGUAGE_NAMES.get(language, "Russian")
    compact_transcript = [
        {
            "role": turn.get("role", "user"),
            "text": turn.get("text") or turn.get("content") or turn.get("message") or "",
        }
        for turn in transcript
    ]
    content = json.dumps(
        {
            "scenario_title": title,
            "scenario_goal": goal,
            "transcript": compact_transcript,
            "emotion_log": emotion_log,
            "motion_log": motion_log,
        },
        ensure_ascii=False,
    )

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "X-Title": settings.openrouter_app_name,
    }
    if settings.openrouter_app_url:
        headers["HTTP-Referer"] = settings.openrouter_app_url

    try:
        resp = httpx.post(
            f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json={
                "model": settings.openrouter_model,
                "messages": [
                    {"role": "system", "content": BRIEF_SYSTEM_PROMPT.format(language_name=language_name)},
                    {"role": "user", "content": content},
                ],
                "temperature": 0.35,
                "max_tokens": 500,
            },
            timeout=35,
        )
        resp.raise_for_status()
        raw_content = resp.json()["choices"][0]["message"]["content"].strip()
        if raw_content.startswith("```"):
            raw_content = re.sub(r"^```(?:json)?|```$", "", raw_content, flags=re.IGNORECASE).strip()
        return _clean_brief_payload(json.loads(raw_content), fallback)
    except Exception:
        return fallback


def _pcm_to_wav(pcm_data: bytes, sample_rate: int = 24000, channels: int = 1, bit_depth: int = 16) -> bytes:
    """Wrap raw PCM bytes in a WAV container so browsers can decode it."""
    data_size = len(pcm_data)
    byte_rate = sample_rate * channels * bit_depth // 8
    block_align = channels * bit_depth // 8
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, channels, sample_rate,
        byte_rate, block_align, bit_depth,
        b"data", data_size,
    )
    return header + pcm_data


def synthesize_speech(text: str, _language: str, settings: Settings) -> tuple[str, str] | tuple[None, None]:
    """Call OpenRouter TTS. Returns (base64_audio, mime_type) or (None, None)."""
    if not settings.openrouter_api_key:
        return None, None

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
        content_type = resp.headers.get("content-type", "audio/mp3")
        audio_bytes = resp.content
        if content_type.startswith("audio/pcm"):
            # Extract sample rate from content-type if present (e.g. audio/pcm;rate=24000)
            rate = 24000
            for part in content_type.split(";"):
                part = part.strip()
                if part.startswith("rate="):
                    try:
                        rate = int(part.split("=", 1)[1])
                    except ValueError:
                        pass
            audio_bytes = _pcm_to_wav(audio_bytes, sample_rate=rate)
            mime = "audio/wav"
        else:
            mime = "audio/mpeg"
        return base64.b64encode(audio_bytes).decode(), mime
    except Exception:
        return None, None


STT_MODEL = "openai/whisper-1"

# ISO 639-1 codes accepted by Whisper for the three app interface languages
_WHISPER_LANG: dict[str, str] = {"en": "en", "ru": "ru", "uz": "uz"}


def transcribe_audio(audio_bytes: bytes, filename: str, content_type: str, language: str, settings: Settings) -> str:
    """Transcribe via OpenRouter Whisper API (JSON + base64 audio)."""
    if not settings.openrouter_api_key:
        return ""

    if "mp4" in content_type or filename.endswith(".mp4"):
        fmt = "mp4"
    elif "ogg" in content_type or filename.endswith(".ogg"):
        fmt = "ogg"
    elif "wav" in content_type or filename.endswith(".wav"):
        fmt = "wav"
    else:
        fmt = "webm"

    # Always tell Whisper which language to expect — improves accuracy and avoids
    # misdetection when the user speaks Russian or Uzbek in short utterances.
    lang_code = _WHISPER_LANG.get(language or "", "en")

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "X-Title": settings.openrouter_app_name,
    }
    if settings.openrouter_app_url:
        headers["HTTP-Referer"] = settings.openrouter_app_url

    body = {
        "model": STT_MODEL,
        "language": lang_code,
        "input_audio": {
            "data": base64.b64encode(audio_bytes).decode(),
            "format": fmt,
        },
    }

    try:
        resp = httpx.post(
            f"{settings.openrouter_base_url.rstrip('/')}/audio/transcriptions",
            headers=headers,
            json=body,
            timeout=20,
        )
        resp.raise_for_status()
        return resp.json().get("text", "").strip()
    except Exception:
        return ""
