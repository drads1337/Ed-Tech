from statistics import mean

from ..schemas import TranscriptMessage


SUPPORTED_LANGUAGES = {"en", "ru", "uz"}

LOCALIZED_PROMPTS = {
    "en": {
        "default_skills": [
            "knowledge accuracy",
            "objection handling",
            "confidence",
            "structure",
            "policy adherence",
        ],
        "title_suffix": "customer roleplay",
        "persona": "Skeptical enterprise customer",
        "opening_message": "I don't see why we need this. We already have a process that works.",
        "rubric": {
            "accuracy": "Did the employee use correct facts from the training material?",
            "objectionHandling": "Did they respond clearly to resistance?",
            "confidence": "Did they sound confident and structured?",
        },
        "cost_reply": "Cost is exactly my concern. How would you justify this to my leadership team?",
        "early_reply": "That sounds interesting, but what makes this better than what we already use?",
        "later_reply": "I need a clearer reason to change. Can you connect this to a concrete business outcome?",
        "feedback": {
            "summary": "Good first pass. Keep answers specific and connect claims to the material.",
            "strengths": ["Clear intent", "Responsive to the customer concern"],
            "improvements": ["Use more exact facts", "Close with a concrete next step"],
        },
    },
    "ru": {
        "default_skills": [
            "точность знаний",
            "работа с возражениями",
            "уверенность",
            "структура ответа",
            "соблюдение правил",
        ],
        "title_suffix": "ролевая игра с клиентом",
        "persona": "Сомневающийся корпоративный клиент",
        "opening_message": "Я не понимаю, зачем нам это нужно. У нас уже есть рабочий процесс.",
        "rubric": {
            "accuracy": "Использовал ли сотрудник точные факты из обучающего материала?",
            "objectionHandling": "Ответил ли он понятно на сопротивление клиента?",
            "confidence": "Звучал ли ответ уверенно и структурировано?",
        },
        "cost_reply": "Стоимость как раз меня и беспокоит. Как вы обоснуете это для моего руководства?",
        "early_reply": "Звучит интересно, но чем это лучше того, что мы уже используем?",
        "later_reply": "Мне нужна более понятная причина для изменений. Свяжите это с конкретным бизнес-результатом.",
        "feedback": {
            "summary": "Хорошая первая попытка. Делайте ответы конкретнее и связывайте утверждения с материалом.",
            "strengths": ["Понятное намерение", "Ответ учитывает сомнение клиента"],
            "improvements": ["Используйте больше точных фактов", "Завершайте конкретным следующим шагом"],
        },
    },
    "uz": {
        "default_skills": [
            "bilim aniqligi",
            "e'tirozlar bilan ishlash",
            "ishonch",
            "javob tuzilmasi",
            "qoidalarga rioya qilish",
        ],
        "title_suffix": "mijoz bilan rolli mashq",
        "persona": "Shubhali korporativ mijoz",
        "opening_message": "Bu bizga nima uchun kerakligini tushunmayapman. Bizda allaqachon ishlaydigan jarayon bor.",
        "rubric": {
            "accuracy": "Xodim o'quv materialidagi aniq faktlardan foydalandimi?",
            "objectionHandling": "Mijoz e'tiroziga aniq javob berdimi?",
            "confidence": "Javob ishonchli va tartibli eshitildimi?",
        },
        "cost_reply": "Narx aynan meni xavotirga solmoqda. Buni rahbariyatga qanday asoslab berasiz?",
        "early_reply": "Qiziqarli eshitilyapti, lekin bu hozir ishlatayotgan yechimimizdan nimasi bilan yaxshiroq?",
        "later_reply": "O'zgarish uchun aniqroq sabab kerak. Buni konkret biznes natijasi bilan bog'lab bera olasizmi?",
        "feedback": {
            "summary": "Yaxshi birinchi urinish. Javoblarni aniqroq qiling va fikrlarni materialdagi faktlarga bog'lang.",
            "strengths": ["Niyat aniq", "Mijoz xavotiriga javob berildi"],
            "improvements": ["Aniq faktlardan ko'proq foydalaning", "Aniq keyingi qadam bilan yakunlang"],
        },
    },
}

DEFAULT_SKILLS = LOCALIZED_PROMPTS["en"]["default_skills"]


def normalize_language(language: str | None) -> str:
    normalized = (language or "en").lower()
    return normalized if normalized in SUPPORTED_LANGUAGES else "en"


def _copy_feedback(language: str) -> dict:
    feedback = LOCALIZED_PROMPTS[language]["feedback"]
    return {
        "summary": feedback["summary"],
        "strengths": list(feedback["strengths"]),
        "improvements": list(feedback["improvements"]),
    }


def generate_scenario(material: dict, goal: str, skills: list[str], difficulty: str, language: str = "en") -> dict:
    language = normalize_language(language)
    prompts = LOCALIZED_PROMPTS[language]
    evaluation_skills = skills or prompts["default_skills"]
    title = material.get("title") or "Training scenario"

    return {
        "title": f"{title}: {prompts['title_suffix']}",
        "goal": goal,
        "difficulty": difficulty,
        "persona": prompts["persona"],
        "opening_message": prompts["opening_message"],
        "evaluation_skills": evaluation_skills,
        "rubric": dict(prompts["rubric"]),
    }


def continue_roleplay(
    scenario: dict,
    transcript: list[TranscriptMessage],
    user_message: str,
    language: str = "en",
) -> TranscriptMessage:
    language = normalize_language(language)
    prompts = LOCALIZED_PROMPTS[language]
    turn_count = len(transcript)
    persona = scenario.get("persona") or prompts["persona"]

    if "price" in user_message.lower() or "cost" in user_message.lower():
        content = prompts["cost_reply"]
    elif turn_count < 2:
        content = prompts["early_reply"]
    else:
        content = prompts["later_reply"]

    return TranscriptMessage(role="persona", content=f"{persona}: {content}")


def evaluate_attempt(scenario: dict, transcript: list[TranscriptMessage], language: str = "en") -> dict:
    language = normalize_language(language)
    user_messages = [message.content for message in transcript if message.role == "user"]
    total_words = sum(len(message.split()) for message in user_messages)
    skills = scenario.get("evaluation_skills") or LOCALIZED_PROMPTS[language]["default_skills"]
    base_score = min(5, max(1, 2 + total_words // 18 + len(user_messages)))
    skill_scores = {
        skill: min(5, max(1, base_score + ((index % 3) - 1)))
        for index, skill in enumerate(skills)
    }

    return {
        "score": round((mean(skill_scores.values()) / 5) * 100),
        "skill_scores": skill_scores,
        "feedback": _copy_feedback(language),
    }
