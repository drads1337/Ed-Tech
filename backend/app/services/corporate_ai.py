import io
import json
from typing import Any

import httpx
from docx import Document
from pypdf import PdfReader

from ..config import Settings


DEFAULT_ENABLED_SETTINGS = {
    "companyRules": True,
    "aiPolicy": True,
    "clientTypes": True,
    "scoring": True,
}


def extract_document_text(filename: str, content_type: str, data: bytes) -> str:
    name = filename.lower()
    mime = (content_type or "").lower()

    if name.endswith(".txt") or mime.startswith("text/"):
        return data.decode("utf-8", errors="replace").strip()

    if name.endswith(".pdf") or mime == "application/pdf":
        reader = PdfReader(io.BytesIO(data))
        text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
        return text.strip()

    if name.endswith(".docx") or mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        document = Document(io.BytesIO(data))
        text = "\n\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())
        return text.strip()

    raise ValueError("Unsupported file type. Upload TXT, PDF, or DOCX.")


def _openrouter_url(settings: Settings) -> str:
    return f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"


def _document_context(documents: list[dict], limit: int = 12000) -> str:
    parts = []
    for document in documents:
        text = (document.get("extracted_text") or "").strip()
        if text:
            parts.append(f"Document: {document.get('filename', 'untitled')}\n{text}")
    return "\n\n---\n\n".join(parts)[:limit]


def fallback_knowledge(source_prompt: str, documents: list[dict], language: str = "ru") -> dict:
    context = _document_context(documents, 1600)
    first_line = context.splitlines()[1] if len(context.splitlines()) > 1 else ""
    company_brief = (
        "Компания обучает сотрудников отвечать клиентам по утвержденным материалам и стандартам."
        if language == "ru"
        else "The company trains employees to answer customers using approved materials and standards."
    )
    if first_line:
        company_brief = f"{company_brief} Ключевой контекст: {first_line[:220]}"

    return {
        "source_prompt": source_prompt,
        "company_brief": company_brief,
        "rules_brief": "Отвечать по документам, не обещать неподтвержденное, объяснять ограничения и фиксировать следующий шаг.",
        "client_types": "B2B enterprise, VIP-клиент, новый клиент, раздраженный клиент после проблемы сервиса.",
        "task_goal": "Создать реалистичные задания на точность по файлам, спокойный тон, работу с возражениями и соблюдение правил.",
        "scoring_rules": "Оценивать решение задачи, точность по документам, тон, структуру ответа, работу с возражениями и следующий шаг.",
        "enabled_settings": DEFAULT_ENABLED_SETTINGS,
        "status": "ready",
    }


def generate_knowledge(source_prompt: str, documents: list[dict], language: str, settings: Settings) -> dict:
    fallback = fallback_knowledge(source_prompt, documents, language)
    if not settings.openrouter_api_key:
        return fallback

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
            {
                "role": "system",
                "content": (
                    "Create a corporate training knowledge-base preview from uploaded company documents. "
                    "Return only JSON with keys: companyBrief, rulesBrief, clientTypes, taskGoal, scoringRules. "
                    "Use concise admin-facing text in the requested language."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "language": language,
                        "sourcePrompt": source_prompt,
                        "documents": _document_context(documents),
                    },
                    ensure_ascii=False,
                ),
            },
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.4,
        "max_tokens": 900,
    }

    try:
        response = httpx.post(_openrouter_url(settings), headers=headers, json=body, timeout=30)
        response.raise_for_status()
        raw: dict[str, Any] = json.loads(response.json()["choices"][0]["message"]["content"])
        return {
            **fallback,
            "company_brief": raw.get("companyBrief") or fallback["company_brief"],
            "rules_brief": raw.get("rulesBrief") or fallback["rules_brief"],
            "client_types": raw.get("clientTypes") or fallback["client_types"],
            "task_goal": raw.get("taskGoal") or fallback["task_goal"],
            "scoring_rules": raw.get("scoringRules") or fallback["scoring_rules"],
        }
    except Exception:
        return fallback


def fallback_task_drafts(knowledge: dict, count: int = 3) -> list[dict]:
    seeds = [
        ("Клиент просит нарушить регламент", "VIP / сложный", "Следование правилам", "hard"),
        ("Enterprise-клиент сомневается в ИИ", "B2B enterprise", "Аргументация ценности", "medium"),
        ("Объяснить пользу без лишних обещаний", "Новый клиент", "Простое объяснение", "easy"),
    ]
    drafts = []
    for index, (title, client_type, skill, difficulty) in enumerate(seeds[: max(1, min(count, 6))]):
        drafts.append(
            {
                "title": title,
                "client_type": client_type,
                "skill": skill,
                "difficulty": difficulty,
                "status": "ready",
                "generated_payload": {
                    "goal": knowledge.get("task_goal") or title,
                    "persona": client_type,
                    "openingMessage": "Мне нужно понять, почему я должен принять ваше предложение именно сейчас.",
                    "evaluationSkills": ["точность по файлам", "тон", "структура", skill],
                    "rubric": {
                        "accuracy": "Использует ли сотрудник утвержденные материалы?",
                        "tone": "Сохраняет ли сотрудник спокойный профессиональный тон?",
                        "nextStep": "Фиксирует ли понятный следующий шаг?",
                    },
                },
            }
        )
    return drafts


def generate_task_drafts(knowledge: dict, count: int, language: str, settings: Settings) -> list[dict]:
    fallback = fallback_task_drafts(knowledge, count)
    if not settings.openrouter_api_key:
        return fallback

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
            {
                "role": "system",
                "content": (
                    "Generate corporate roleplay task drafts. Return only JSON: "
                    "{\"tasks\":[{\"title\":\"\",\"clientType\":\"\",\"skill\":\"\",\"difficulty\":\"easy|medium|hard\","
                    "\"openingMessage\":\"\",\"evaluationSkills\":[\"\"],\"rubric\":{}}]}. "
                    "Use the requested language."
                ),
            },
            {"role": "user", "content": json.dumps({"language": language, "count": count, "knowledge": knowledge}, ensure_ascii=False)},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.6,
        "max_tokens": 1800,
    }
    try:
        response = httpx.post(_openrouter_url(settings), headers=headers, json=body, timeout=40)
        response.raise_for_status()
        raw = json.loads(response.json()["choices"][0]["message"]["content"])
        tasks = raw.get("tasks") or []
        drafts = []
        for task in tasks[: max(1, min(count, 6))]:
            drafts.append(
                {
                    "title": task["title"],
                    "client_type": task.get("clientType", ""),
                    "skill": task.get("skill", ""),
                    "difficulty": task.get("difficulty", "medium"),
                    "status": "ready",
                    "generated_payload": {
                        "goal": knowledge.get("task_goal") or task["title"],
                        "persona": task.get("clientType", ""),
                        "openingMessage": task.get("openingMessage", ""),
                        "evaluationSkills": task.get("evaluationSkills") or [task.get("skill", "communication")],
                        "rubric": task.get("rubric") or {},
                    },
                }
            )
        return drafts or fallback
    except Exception:
        return fallback
