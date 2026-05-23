from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas import OnboardingAiSummaryRequest
from app.services.onboarding_ai import generate_onboarding_summary


class FakeOpenRouterResponse:
    def __init__(self, content: str):
        self._content = content

    def raise_for_status(self):
        return None

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


def test_missing_openrouter_key_returns_fallback():
    summary = generate_onboarding_summary(
        OnboardingAiSummaryRequest(role="sales", industry="software", goal_label="Handle objections"),
        Settings(openrouter_api_key=None),
    )

    assert summary.role_line
    assert summary.goal_line
    assert summary.recommended_skills


def test_missing_openrouter_key_returns_localized_fallback():
    russian = generate_onboarding_summary(
        OnboardingAiSummaryRequest(
            role="sales",
            role_label="Продажи",
            industry="business",
            industry_label="Бизнес",
            goal_label="Успокоить клиента",
            experience_label="Новичок",
            language="ru",
        ),
        Settings(openrouter_api_key=None),
    )
    uzbek = generate_onboarding_summary(
        OnboardingAiSummaryRequest(role="sales", industry="business", goal_label="Mijozni tinchlantirish", language="uz"),
        Settings(openrouter_api_key=None),
    )

    assert russian.role_line == "Вы — Продажи в сфере «Бизнес»."
    assert russian.goal_line == "Ваша цель — «Успокоить клиента»."
    assert russian.mode_line == "Режим тренировок — «Новичок»."
    assert russian.starter_scenario_title == "Спокойный ответ на возражение клиента"
    assert uzbek.role_line.startswith("Siz")
    assert uzbek.starter_scenario_title == "Mijoz e'tiroziga xotirjam javob"


def test_openrouter_service_parses_valid_json(monkeypatch):
    captured = {}

    def fake_post(*args, **kwargs):
        captured["url"] = args[0]
        return FakeOpenRouterResponse(
            """
            {
              "roleLine": "You are setting up a sales path.",
              "goalLine": "Your goal is objection handling.",
              "targetLine": "Focus on accuracy and confidence.",
              "modeLine": "Start with short sessions.",
              "recommendedSkills": ["accuracy", "confidence"],
              "starterScenarioTitle": "Enterprise objection warm-up"
            }
            """
        )

    monkeypatch.setattr("app.services.onboarding_ai.httpx.post", fake_post)
    summary = generate_onboarding_summary(
        OnboardingAiSummaryRequest(role="sales", industry="software"),
        Settings(openrouter_api_key="test-key"),
    )

    assert summary.role_line == "You are setting up a sales path."
    assert summary.starter_scenario_title == "Enterprise objection warm-up"
    assert captured["url"] == "https://openrouter.ai/api/v1/chat/completions"


def test_openrouter_service_falls_back_on_malformed_json(monkeypatch):
    def fake_post(*args, **kwargs):
        return FakeOpenRouterResponse("not json")

    monkeypatch.setattr("app.services.onboarding_ai.httpx.post", fake_post)
    summary = generate_onboarding_summary(
        OnboardingAiSummaryRequest(role="support", industry="saas"),
        Settings(openrouter_api_key="test-key"),
    )

    assert summary.role_line
    assert summary.starter_scenario_title == "Calm customer objection"


def test_openrouter_prompt_includes_requested_language(monkeypatch):
    captured = {}

    def fake_post(*args, **kwargs):
        captured["body"] = kwargs["json"]
        return FakeOpenRouterResponse(
            """
            {
              "roleLine": "Вы настраиваете тренировочный путь.",
              "goalLine": "Ваша цель — успокоить клиента.",
              "targetLine": "Фокус на структуре и уверенности.",
              "modeLine": "Начните с коротких сессий.",
              "recommendedSkills": ["структура", "уверенность"],
              "starterScenarioTitle": "Разминка с клиентом"
            }
            """
        )

    monkeypatch.setattr("app.services.onboarding_ai.httpx.post", fake_post)
    summary = generate_onboarding_summary(
        OnboardingAiSummaryRequest(role="sales", industry="business", language="ru"),
        Settings(openrouter_api_key="test-key"),
    )

    assert "Russian" in captured["body"]["messages"][0]["content"]
    assert "existing local mock summary style" in captured["body"]["messages"][0]["content"]
    assert 'roleLine pattern: "Вы — {roleLabel} в сфере «{industryLabel}»."' in captured["body"]["messages"][0]["content"]
    assert 'goalLine pattern: "Ваша цель — «{goalLabel}»."' in captured["body"]["messages"][0]["content"]
    assert 'targetLine pattern: "Чтобы выйти на результат, фокус: {short focus}."' in captured["body"]["messages"][0]["content"]
    assert 'modeLine pattern: "Режим тренировок — «{experienceLabel}»."' in captured["body"]["messages"][0]["content"]
    assert "Return only valid JSON" in captured["body"]["messages"][0]["content"]
    assert "Do not add extra keys" in captured["body"]["messages"][0]["content"]
    assert "Only starterScenarioTitle should use mock scenario title style" in captured["body"]["messages"][0]["content"]
    assert summary.role_line.startswith("Вы")


def test_openrouter_prompt_uses_uzbek_patterns(monkeypatch):
    captured = {}

    def fake_post(*args, **kwargs):
        captured["body"] = kwargs["json"]
        return FakeOpenRouterResponse(
            """
            {
              "roleLine": "Siz — «Tibbiyot» sohasida Shifokor.",
              "goalLine": "Maqsadingiz — «Mijozni tinchlantirish».",
              "targetLine": "Natijaga chiqish uchun fokus: xotirjam ohang.",
              "modeLine": "Mashg'ulot rejimi — «Boshlovchi».",
              "recommendedSkills": ["xotirjamlik", "aniqlik"],
              "starterScenarioTitle": "Bemor xavotirini kamaytirish"
            }
            """
        )

    monkeypatch.setattr("app.services.onboarding_ai.httpx.post", fake_post)
    summary = generate_onboarding_summary(
        OnboardingAiSummaryRequest(role="doctor", industry="medicine", language="uz"),
        Settings(openrouter_api_key="test-key"),
    )

    prompt = captured["body"]["messages"][0]["content"]
    assert "Uzbek Latin" in prompt
    assert 'roleLine pattern: "Siz — «{industryLabel}» sohasida {roleLabel}."' in prompt
    assert 'goalLine pattern: "Maqsadingiz — «{goalLabel}»."' in prompt
    assert 'targetLine pattern: "Natijaga chiqish uchun fokus: {short focus}."' in prompt
    assert 'modeLine pattern: "Mashg\'ulot rejimi — «{experienceLabel}»."' in prompt
    assert summary.role_line.startswith("Siz")


def test_non_russian_summary_rejects_cyrillic_response(monkeypatch):
    def fake_post(*args, **kwargs):
        return FakeOpenRouterResponse(
            """
            {
              "roleLine": "Вы — Shifokor в сфере «Tibbiyot».",
              "goalLine": "Ваша цель — «Mijozni tinchlantirish».",
              "targetLine": "Чтобы выйти на результат, фокус: emotsional tinchlik.",
              "modeLine": "Режим тренировок — «Boshlovchi».",
              "recommendedSkills": ["уверенность", "tinchlik"],
              "starterScenarioTitle": "Mijozning qo'rquvini yumshatish"
            }
            """
        )

    monkeypatch.setattr("app.services.onboarding_ai.httpx.post", fake_post)
    summary = generate_onboarding_summary(
        OnboardingAiSummaryRequest(
            role_label="Shifokor / Hamshira",
            industry_label="Tibbiyot",
            goal_label="Mijozni tinchlantirish",
            experience_label="Boshlovchi",
            language="uz",
        ),
        Settings(openrouter_api_key="test-key"),
    )

    assert summary.role_line == "Siz — «Tibbiyot» sohasida Shifokor / Hamshira."
    assert summary.goal_line == "Maqsadingiz — «Mijozni tinchlantirish»."


def test_onboarding_summary_requires_auth():
    client = TestClient(create_app())
    response = client.post("/api/onboarding/ai-summary", json={"role": "sales"})

    assert response.status_code == 401


def test_onboarding_summary_endpoint_returns_shape(client: TestClient):
    response = client.post(
        "/api/onboarding/ai-summary",
        json={
            "role": "sales",
            "industry": "software",
            "goalLabel": "Handle objections better",
            "experience": "beginner",
            "language": "ru",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["roleLine"]
    assert payload["goalLine"]
    assert isinstance(payload["recommendedSkills"], list)
