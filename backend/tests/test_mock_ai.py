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


def test_roleplay_and_evaluation_are_deterministic():
    scenario = generate_scenario({"title": "FAQ"}, "Practice", [], "easy")
    transcript = [TranscriptMessage(role="user", content="This saves time and improves rollout quality.")]

    message = continue_roleplay(scenario, transcript, "The price is fair.")
    evaluation = evaluate_attempt(scenario, [*transcript, message])

    assert message.role == "persona"
    assert "Cost" in message.content
    assert 0 <= evaluation["score"] <= 100
    assert evaluation["skill_scores"]
