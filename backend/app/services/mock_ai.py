from statistics import mean

from ..schemas import TranscriptMessage


DEFAULT_SKILLS = [
    "knowledge accuracy",
    "objection handling",
    "confidence",
    "structure",
    "policy adherence",
]


def generate_scenario(material: dict, goal: str, skills: list[str], difficulty: str) -> dict:
    evaluation_skills = skills or DEFAULT_SKILLS
    title = material.get("title") or "Training scenario"

    return {
        "title": f"{title}: customer roleplay",
        "goal": goal,
        "difficulty": difficulty,
        "persona": "Skeptical enterprise customer",
        "opening_message": "I don't see why we need this. We already have a process that works.",
        "evaluation_skills": evaluation_skills,
        "rubric": {
            "accuracy": "Did the employee use correct facts from the training material?",
            "objectionHandling": "Did they respond clearly to resistance?",
            "confidence": "Did they sound confident and structured?",
        },
    }


def continue_roleplay(scenario: dict, transcript: list[TranscriptMessage], user_message: str) -> TranscriptMessage:
    turn_count = len(transcript)
    persona = scenario.get("persona", "Customer")

    if "price" in user_message.lower() or "cost" in user_message.lower():
        content = "Cost is exactly my concern. How would you justify this to my leadership team?"
    elif turn_count < 2:
        content = "That sounds interesting, but what makes this better than what we already use?"
    else:
        content = "I need a clearer reason to change. Can you connect this to a concrete business outcome?"

    return TranscriptMessage(role="persona", content=f"{persona}: {content}")


def evaluate_attempt(scenario: dict, transcript: list[TranscriptMessage]) -> dict:
    user_messages = [message.content for message in transcript if message.role == "user"]
    total_words = sum(len(message.split()) for message in user_messages)
    skills = scenario.get("evaluation_skills") or DEFAULT_SKILLS
    base_score = min(5, max(1, 2 + total_words // 18 + len(user_messages)))
    skill_scores = {
        skill: min(5, max(1, base_score + ((index % 3) - 1)))
        for index, skill in enumerate(skills)
    }

    return {
        "score": round((mean(skill_scores.values()) / 5) * 100),
        "skill_scores": skill_scores,
        "feedback": {
            "summary": "Good first pass. Keep answers specific and connect claims to the material.",
            "strengths": ["Clear intent", "Responsive to the customer concern"],
            "improvements": ["Use more exact facts", "Close with a concrete next step"],
        },
    }
