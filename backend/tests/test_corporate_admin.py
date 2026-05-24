from conftest import ADMIN_ID, EMPLOYEE_ID


def act_as(client, user_id: str):
    client.app.state.test_auth["user_id"] = user_id
    return client


def upload_txt(client, name="policy.txt", text="Follow policy. Do not promise unsupported refunds."):
    return client.post(
        "/api/corporate/admin/documents",
        files={"file": (name, text.encode("utf-8"), "text/plain")},
    )


def test_admin_can_upload_text_document_and_list(client):
    response = act_as(client, ADMIN_ID).post(
        "/api/corporate/admin/documents",
        files={"file": ("policy.txt", b"Refunds require manager approval.", "text/plain")},
    )

    assert response.status_code == 200
    document = response.json()
    assert document["filename"] == "policy.txt"
    assert "Refunds" in document["extractedText"]

    list_response = client.get("/api/corporate/admin/documents")
    assert list_response.status_code == 200
    assert list_response.json()[0]["id"] == document["id"]


def test_employee_cannot_access_corporate_admin(client):
    response = act_as(client, EMPLOYEE_ID).get("/api/corporate/admin/documents")
    assert response.status_code == 403


def test_knowledge_generation_and_patch_uses_fallback(client):
    document = upload_txt(client).json()

    response = act_as(client, ADMIN_ID).post(
        "/api/corporate/admin/knowledge/generate",
        json={
            "documentIds": [document["id"]],
            "sourcePrompt": "Create a policy training base.",
            "language": "ru",
        },
    )

    assert response.status_code == 200
    knowledge = response.json()
    assert knowledge["status"] == "ready"
    assert knowledge["companyBrief"]
    assert knowledge["enabledSettings"]["companyRules"] is True

    patch_response = client.patch(
        "/api/corporate/admin/knowledge/current",
        json={"companyBrief": "Updated brief", "enabledSettings": {"companyRules": False}},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["companyBrief"] == "Updated brief"
    assert patch_response.json()["enabledSettings"]["companyRules"] is False


def test_task_drafts_can_be_generated_and_assigned(client):
    document = upload_txt(client).json()
    knowledge = client.post(
        "/api/corporate/admin/knowledge/generate",
        json={"documentIds": [document["id"]], "sourcePrompt": "Make tasks", "language": "ru"},
    ).json()

    drafts_response = client.post(
        "/api/corporate/admin/task-drafts/generate",
        json={"knowledgeBaseId": knowledge["id"], "count": 2, "language": "ru"},
    )

    assert drafts_response.status_code == 200
    drafts = drafts_response.json()
    assert len(drafts) == 2

    assign_response = client.post(
        "/api/corporate/admin/task-drafts/assign",
        json={
            "taskDraftIds": [drafts[0]["id"]],
            "employeeIds": [EMPLOYEE_ID],
            "requiredScore": 80,
        },
    )

    assert assign_response.status_code == 200
    assignment = assign_response.json()["assignments"][0]
    assert assignment["employeeIds"] == [EMPLOYEE_ID]


def test_manual_task_draft_can_be_created_without_existing_knowledge_base(client):
    response = act_as(client, ADMIN_ID).post(
        "/api/corporate/admin/task-drafts",
        json={
            "title": "Handle a VIP objection",
            "clientType": "VIP client",
            "skill": "Objection handling",
            "difficulty": "hard",
            "goal": "Calmly explain AI limits and agree on a safe next step.",
        },
    )

    assert response.status_code == 200
    draft = response.json()
    assert draft["title"] == "Handle a VIP objection"
    assert draft["status"] == "manual"
    assert draft["knowledgeBaseId"]
    assert draft["generatedPayload"]["source"] == "manual"
    assert "AI limits" in draft["generatedPayload"]["goal"]

    list_response = client.get("/api/corporate/admin/task-drafts")
    assert list_response.status_code == 200
    assert list_response.json()[0]["id"] == draft["id"]


def test_review_returns_employee_details_after_attempt(client):
    material = client.post(
        "/api/materials",
        json={"title": "Rules", "type": "text", "content": "Use approved policy."},
    ).json()
    scenario = client.post(
        "/api/scenarios/generate",
        json={"materialId": material["id"], "goal": "Policy practice", "language": "ru"},
    ).json()
    assignment = client.post(
        "/api/assignments",
        json={"scenarioId": scenario["id"], "employeeIds": [EMPLOYEE_ID], "requiredScore": 80},
    ).json()
    act_as(client, EMPLOYEE_ID).post(
        "/api/attempts/evaluate",
        json={
            "scenarioId": scenario["id"],
            "assignmentId": assignment["id"],
            "transcript": [{"role": "user", "message": "I will follow approved policy and suggest next steps."}],
            "language": "ru",
        },
    )

    response = act_as(client, ADMIN_ID).get("/api/corporate/admin/review")
    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["totals"]["employees"] == 1
    assert dashboard["employees"][0]["id"] == EMPLOYEE_ID
    assert dashboard["employees"][0]["result"] > 0


def test_review_returns_employee_details_without_attempt(client):
    response = act_as(client, ADMIN_ID).get("/api/corporate/admin/review")

    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["totals"]["employees"] == 1
    assert dashboard["employees"][0]["id"] == EMPLOYEE_ID
    assert dashboard["employees"][0]["result"] == 0


def test_prizes_can_be_saved_and_loaded(client):
    response = act_as(client, ADMIN_ID).patch(
        "/api/corporate/admin/prizes",
        json={
            "firstPlace": "First prize",
            "secondPlace": "Second prize",
            "thirdPlace": "Third prize",
        },
    )
    assert response.status_code == 200
    assert response.json()["firstPlace"] == "First prize"

    get_response = client.get("/api/corporate/admin/prizes")
    assert get_response.status_code == 200
    assert get_response.json()["thirdPlace"] == "Third prize"
