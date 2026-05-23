from fastapi.testclient import TestClient

from conftest import ADMIN_ID, EMPLOYEE_ID


def act_as(client: TestClient, user_id: str) -> TestClient:
    client.app.state.test_auth["user_id"] = user_id
    return client


def test_full_demo_loop(client: TestClient):
    material_response = act_as(client, ADMIN_ID).post(
        "/api/materials",
        json={
            "title": "Launch FAQ",
            "type": "text",
            "content": "The product improves onboarding and reduces support escalations.",
        },
    )
    assert material_response.status_code == 200
    material = material_response.json()

    scenario_response = act_as(client, ADMIN_ID).post(
        "/api/scenarios/generate",
        json={
            "materialId": material["id"],
            "goal": "Handle launch objections",
            "skills": ["accuracy", "objection handling", "confidence"],
            "difficulty": "medium",
        },
    )
    assert scenario_response.status_code == 200
    scenario = scenario_response.json()

    assignment_response = act_as(client, ADMIN_ID).post(
        "/api/assignments",
        json={
            "scenarioId": scenario["id"],
            "employeeIds": ["00000000-0000-0000-0000-000000000011"],
            "requiredScore": 80,
        },
    )
    assert assignment_response.status_code == 200
    assignment = assignment_response.json()

    employee_dashboard = act_as(client, EMPLOYEE_ID).get("/api/employee/dashboard")
    assert employee_dashboard.status_code == 200
    assert employee_dashboard.json()["assignments"][0]["status"] == "assigned"

    message_response = act_as(client, EMPLOYEE_ID).post(
        "/api/simulation/message",
        json={
            "scenarioId": scenario["id"],
            "transcript": [],
            "userMessage": "This helps your team reduce support escalations after launch.",
        },
    )
    assert message_response.status_code == 200
    transcript = message_response.json()["transcript"]

    attempt_response = act_as(client, EMPLOYEE_ID).post(
        "/api/attempts/evaluate",
        json={
            "scenarioId": scenario["id"],
            "assignmentId": assignment["id"],
            "transcript": transcript,
        },
    )
    assert attempt_response.status_code == 200
    assert attempt_response.json()["score"] > 0

    admin_dashboard = act_as(client, ADMIN_ID).get("/api/admin/dashboard")
    assert admin_dashboard.status_code == 200
    dashboard = admin_dashboard.json()
    assert dashboard["scenarios"][0]["completionRate"] == 1
    assert dashboard["scenarios"][0]["averageScore"] is not None


def test_employee_cannot_create_assignment(client: TestClient):
    response = act_as(client, EMPLOYEE_ID).post(
        "/api/assignments",
        json={
            "scenarioId": "missing",
            "employeeIds": ["00000000-0000-0000-0000-000000000011"],
            "requiredScore": 80,
        },
    )

    assert response.status_code == 403
