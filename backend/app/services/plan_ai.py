"""Generate a personalised 12-14 case learning plan for a solo user via OpenRouter."""
import json
from typing import Any

import httpx

from ..config import Settings

PLAN_SYSTEM_PROMPT = """
You are a curriculum designer for an AI roleplay communication trainer.

Given a user's professional profile, generate a personalised learning plan of exactly 12 case studies.
Cases must progress from easiest (difficulty 1) to hardest (difficulty 3), with at least 4 cases at each difficulty tier.

Each case is a realistic roleplay scenario the user would encounter in their actual job.
Tailor every case to the user's industry, role, and goal — avoid generic examples.
Make client personas vivid and specific (name an emotion, a context, a pressure).

Output rules:
- Return only valid JSON — an array of exactly 12 objects.
- No markdown, no explanations, no extra keys.
- Each object must have exactly these keys:
  id, title, goal, skill, difficulty, durationMin, xpReward, coinReward,
  aiPersona, patientType, emoji, script, feedback

Field rules:
- id: snake_case unique string, e.g. "gen_bus_sales_01"
- title: short vivid title (max 6 words)
- goal: one-sentence goal for the learner
- skill: one communication skill being trained (e.g. "Objection handling")
- difficulty: integer 1, 2, or 3
- durationMin: integer 4–7
- xpReward: difficulty * 8  (so 8, 16, or 24)
- coinReward: difficulty * 4  (so 4, 8, or 12)
- aiPersona: 1-sentence vivid client description
- patientType: one of "neutral", "angry", "sad", "vip", "good"
- emoji: one relevant emoji
- script: array of 6 turns alternating "ai" and "user":
    ai turn: { "role": "ai", "text": "...", "delay": <ms 900-1800> }
    user turn: { "role": "user", "expected": ["keyword1","keyword2","keyword3"], "hint": "...", "quickReplies": ["reply1","reply2"] }
- feedback: { "good": ["3 short praise points"], "improve": ["2 short growth points"] }

Write all text in the language specified in the request (ru/en/uz).
""".strip()


def _openrouter_url(settings: Settings) -> str:
    return f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"


def _fallback_plan(industry: str, role: str, language: str) -> list[dict]:
    """Return a minimal 12-case placeholder when AI is unavailable."""
    skills_by_lang = {
        "ru": ["Установление контакта", "Работа с возражениями", "Деэскалация",
               "Активное слушание", "Ясные инструкции", "Эмпатия",
               "Кризисная коммуникация", "Нейтральный тон", "Переговоры",
               "Обратная связь", "Стрессоустойчивость", "Закрытие разговора"],
        "en": ["Building rapport", "Objection handling", "De-escalation",
               "Active listening", "Clear instructions", "Empathy",
               "Crisis communication", "Neutral tone", "Negotiation",
               "Giving feedback", "Stress resilience", "Closing the conversation"],
        "uz": ["Aloqa o'rnatish", "E'tirozlar bilan ishlash", "De-eskalatsiya",
               "Faol tinglash", "Aniq ko'rsatmalar", "Empatiya",
               "Inqiroz kommunikatsiyasi", "Neytral ohang", "Muzokaralar",
               "Fikr-mulohaza", "Stressga chidamlilik", "Suhbatni yakunlash"],
    }
    patient_types = ["neutral", "angry", "neutral", "sad", "good",
                     "angry", "vip", "neutral", "angry", "good", "angry", "vip"]
    difficulties = [1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3]
    lang = language if language in skills_by_lang else "en"
    skills = skills_by_lang[lang]
    cases = []
    for i in range(12):
        d = difficulties[i]
        cases.append({
            "id": f"gen_{industry}_{i+1:02d}",
            "title": f"Case {i+1}",
            "goal": f"Practice {skills[i]}",
            "skill": skills[i],
            "difficulty": d,
            "durationMin": 4 + (d - 1),
            "xpReward": d * 8,
            "coinReward": d * 4,
            "aiPersona": f"Typical {role} client",
            "patientType": patient_types[i],
            "emoji": "💼",
            "script": [
                {"role": "ai", "text": "Hello, I need your help.", "delay": 1200},
                {"role": "user", "expected": ["help", "understand"], "hint": "Acknowledge and ask clarifying questions.", "quickReplies": ["Of course, let me understand your situation.", "Tell me more about what you need."]},
                {"role": "ai", "text": "The issue is more complicated than I expected.", "delay": 1400},
                {"role": "user", "expected": ["clarify", "details", "specific"], "hint": "Ask for specific details.", "quickReplies": ["Could you give me a specific example?", "Let's break this down step by step."]},
                {"role": "ai", "text": "I appreciate your patience.", "delay": 1100},
                {"role": "user", "expected": ["solution", "next step", "plan"], "hint": "Offer a clear next step.", "quickReplies": ["Here's what we can do next.", "Let me suggest a concrete solution."]},
            ],
            "feedback": {
                "good": ["Good opening", "Clear structure", "Professional tone"],
                "improve": ["Ask more clarifying questions", "Offer alternatives"],
            },
        })
    return cases


def generate_learning_plan(
    industry: str,
    role: str,
    goal: str,
    experience: str,
    language: str,
    settings: Settings,
) -> list[dict]:
    fallback = _fallback_plan(industry, role, language)
    if not settings.openrouter_api_key:
        return fallback

    user_msg = json.dumps({
        "industry": industry,
        "role": role,
        "goal": goal,
        "experience": experience,
        "language": language,
    }, ensure_ascii=False)

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "X-Title": settings.openrouter_app_name,
    }
    if settings.openrouter_app_url:
        headers["HTTP-Referer"] = settings.openrouter_app_url

    body = {
        "model": settings.openrouter_model,
        "messages": [
            {"role": "system", "content": PLAN_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.7,
        "max_tokens": 6000,
    }

    try:
        resp = httpx.post(_openrouter_url(settings), headers=headers, json=body, timeout=60)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        # Strip unescaped control characters that some models emit inside JSON strings
        import re
        content = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', ' ', content)
        parsed: Any = json.loads(content)
        # Model may return: [...] | {"cases":[...]} | {"cases":{"k":{...},...}}
        if isinstance(parsed, list):
            cases = parsed
        else:
            raw = parsed.get("cases") or parsed.get("plan") or list(parsed.values())[0]
            cases = list(raw.values()) if isinstance(raw, dict) else raw
        if isinstance(cases, list) and len(cases) >= 8:
            return cases[:14]
    except Exception:
        pass

    return fallback
