from app.schemas import TranscriptMessage
from app.services.mock_ai import continue_roleplay, evaluate_attempt, generate_scenario


def test_generate_scenario_returns_frontend_contract():
    scenario = generate_scenario(
        {"title": "New product FAQ"},
        "Handle objections",
        ["accuracy", "confidence"],
        "medium",
    )

    assert scenario["title"] == "New product FAQ: customer roleplay"
    assert scenario["persona"]
    assert scenario["opening_message"]
    assert scenario["evaluation_skills"] == ["accuracy", "confidence"]
    assert "accuracy" in scenario["rubric"]


def test_generate_scenario_localizes_default_prompts():
    english = generate_scenario({"title": "FAQ"}, "Practice", [], "easy", "en")
    russian = generate_scenario({"title": "FAQ"}, "Practice", [], "easy", "ru")
    uzbek = generate_scenario({"title": "FAQ"}, "Practice", [], "easy", "uz")

    assert english["persona"] == "Skeptical enterprise customer"
    assert russian["persona"] == "Сомневающийся корпоративный клиент"
    assert uzbek["persona"] == "Shubhali korporativ mijoz"
    assert russian["evaluation_skills"][0] == "точность знаний"
    assert uzbek["evaluation_skills"][0] == "bilim aniqligi"


def test_roleplay_and_evaluation_are_deterministic():
    scenario = generate_scenario({"title": "FAQ"}, "Practice", [], "easy")
    transcript = [TranscriptMessage(role="user", content="This saves time and improves rollout quality.")]

    message = continue_roleplay(scenario, transcript, "The price is fair.")
    evaluation = evaluate_attempt(scenario, [*transcript, message])

    assert message.role == "persona"
    assert "Cost" in message.content
    assert 0 <= evaluation["score"] <= 100
    assert evaluation["skill_scores"]


def test_roleplay_and_evaluation_are_localized():
    scenario = generate_scenario({"title": "FAQ"}, "Practice", [], "easy", "uz")
    transcript = [TranscriptMessage(role="user", content="Bu vaqtni tejaydi.")]

    message = continue_roleplay(scenario, transcript, "Narx yaxshi.", "uz")
    evaluation = evaluate_attempt(scenario, [*transcript, message], "uz")

    assert "Shubhali korporativ mijoz" in message.content
    assert "Qiziqarli" in message.content
    assert evaluation["feedback"]["summary"].startswith("Yaxshi")
