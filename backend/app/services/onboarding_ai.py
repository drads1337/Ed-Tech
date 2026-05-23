import json
from typing import Any

import httpx

from ..config import Settings
from ..schemas import OnboardingAiSummary, OnboardingAiSummaryRequest

SUPPORTED_LANGUAGES = {"en", "ru", "uz"}
LANGUAGE_NAMES = {
    "en": "English",
    "ru": "Russian",
    "uz": "Uzbek Latin",
}

LINE_PATTERNS = {
    "en": {
        "roleLine": '"You are a {roleLabel} in {industryLabel}."',
        "goalLine": '"Your goal is \\"{goalLabel}\\"."',
        "targetLine": '"To reach that result, focus on {short focus}."',
        "modeLine": '"Training mode — \\"{experienceLabel}\\"."',
    },
    "ru": {
        "roleLine": '"Вы — {roleLabel} в сфере «{industryLabel}»."',
        "goalLine": '"Ваша цель — «{goalLabel}»."',
        "targetLine": '"Чтобы выйти на результат, фокус: {short focus}."',
        "modeLine": '"Режим тренировок — «{experienceLabel}»."',
    },
    "uz": {
        "roleLine": '"Siz — «{industryLabel}» sohasida {roleLabel}."',
        "goalLine": '"Maqsadingiz — «{goalLabel}»."',
        "targetLine": '"Natijaga chiqish uchun fokus: {short focus}."',
        "modeLine": '"Mashg\'ulot rejimi — «{experienceLabel}»."',
    },
}

MOCK_DATA_STYLE_GUIDE = """
You personalize onboarding for an AI roleplay training product.

The summary card must mirror the app's existing local mock summary style, not a generic coach response.
Use these exact line patterns in the requested language:
- roleLine pattern: {role_line_pattern}
- goalLine pattern: {goal_line_pattern}
- targetLine pattern: {target_line_pattern}
- modeLine pattern: {mode_line_pattern}

Language:
- Write every user-facing value in {language_name}.
- For Uzbek, use Latin script only.
- Do not mix languages.

Output rules:
- Return only valid JSON.
- Do not include markdown.
- Do not include explanations.
- Do not add extra keys.
- Use exactly these keys: roleLine, goalLine, targetLine, modeLine, recommendedSkills, starterScenarioTitle.

Content rules:
- roleLine, goalLine, targetLine, and modeLine must each be one short sentence.
- recommendedSkills must contain 3 short dashboard labels.
- Only starterScenarioTitle should use mock scenario title style, like "Calm pricing objection" or "New product launch objection drill".
- starterScenarioTitle must be concise, practical, and not a generic course name.
- Match the user's role, industry, goal, experience level, and custom goal when provided.
""".strip()


def normalize_language(language: str | None) -> str:
    normalized = (language or "en").lower()
    return normalized if normalized in SUPPORTED_LANGUAGES else "en"


def _has_cyrillic(value: str) -> bool:
    return any("\u0400" <= char <= "\u04ff" for char in value)


def build_fallback_onboarding_summary(payload: OnboardingAiSummaryRequest) -> OnboardingAiSummary:
    language = normalize_language(payload.language)
    role = payload.role_label or payload.role or "specialist"
    industry = payload.industry_label or payload.industry or "your field"
    goal = payload.custom_goal or payload.goal_label or payload.goal or "build stronger communication skills"
    experience = payload.experience_label or payload.experience or "guided"

    if language == "ru":
        return OnboardingAiSummary(
            role_line=f"Вы — {role} в сфере «{industry}».",
            goal_line=f"Ваша цель — «{goal}».",
            target_line="Чтобы выйти на результат, фокус: понятная структура, уверенная подача и реалистичная ролевая практика.",
            mode_line=f"Режим тренировок — «{experience}».",
            recommended_skills=["уверенность", "структура ответа", "работа с возражениями"],
            starter_scenario_title="Спокойный ответ на возражение клиента",
        )

    if language == "uz":
        return OnboardingAiSummary(
            role_line=f"Siz — «{industry}» sohasida {role}.",
            goal_line=f"Maqsadingiz — «{goal}».",
            target_line="Natijaga chiqish uchun fokus: aniq tuzilma, ishonchli nutq va real rolli mashqlar.",
            mode_line=f"Mashg'ulot rejimi — «{experience}».",
            recommended_skills=["ishonch", "javob tuzilmasi", "e'tirozlar bilan ishlash"],
            starter_scenario_title="Mijoz e'tiroziga xotirjam javob",
        )

    return OnboardingAiSummary(
        role_line=f"You are a {role} in {industry}.",
        goal_line=f"Your goal is \"{goal}\".",
        target_line="To reach that result, focus on clear structure, confident delivery, and realistic roleplay practice.",
        mode_line=f"Training mode — \"{experience}\".",
        recommended_skills=["confidence", "structure", "objection handling"],
        starter_scenario_title="Calm customer objection",
    )


def _summary_matches_language(summary: OnboardingAiSummary, language: str) -> bool:
    if language == "ru":
        return True

    text_values = [
        summary.role_line,
        summary.goal_line,
        summary.target_line,
        summary.mode_line,
        summary.starter_scenario_title,
        *summary.recommended_skills,
    ]
    return not any(_has_cyrillic(value or "") for value in text_values)


def _parse_summary_json(content: str, fallback: OnboardingAiSummary, language: str) -> OnboardingAiSummary:
    try:
        raw: dict[str, Any] = json.loads(content)
        summary = OnboardingAiSummary.model_validate(raw)
        return summary if _summary_matches_language(summary, language) else fallback
    except Exception:
        return fallback


def _openrouter_chat_completions_url(settings: Settings) -> str:
    return f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"


def generate_onboarding_summary(payload: OnboardingAiSummaryRequest, settings: Settings) -> OnboardingAiSummary:
    language = normalize_language(payload.language)
    fallback = build_fallback_onboarding_summary(payload)
    if not settings.openrouter_api_key:
        return fallback

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "X-Title": settings.openrouter_app_name,
    }
    if settings.openrouter_app_url:
        # OpenRouter uses HTTP-Referer to identify the calling app; this is not the API URL.
        headers["HTTP-Referer"] = settings.openrouter_app_url

    request_body = {
        "model": settings.openrouter_model,
        "messages": [
            {
                "role": "system",
                "content": MOCK_DATA_STYLE_GUIDE.format(
                    language_name=LANGUAGE_NAMES[language],
                    role_line_pattern=LINE_PATTERNS[language]["roleLine"],
                    goal_line_pattern=LINE_PATTERNS[language]["goalLine"],
                    target_line_pattern=LINE_PATTERNS[language]["targetLine"],
                    mode_line_pattern=LINE_PATTERNS[language]["modeLine"],
                ),
            },
            {
                "role": "user",
                "content": json.dumps(payload.model_dump(by_alias=True), ensure_ascii=False),
            },
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.5,
        "max_tokens": 450,
    }

    try:
        response = httpx.post(_openrouter_chat_completions_url(settings), headers=headers, json=request_body, timeout=20)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return _parse_summary_json(content, fallback, language)
    except Exception:
        return fallback
