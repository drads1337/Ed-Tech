from statistics import mean

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..config import Settings, get_settings
from ..dependencies import require_roles
from ..repositories import Repository, get_repository
from ..schemas import (
    Assignment,
    CorporateDocument,
    CorporateKnowledgeBase,
    CorporateKnowledgeGenerateRequest,
    CorporateKnowledgePatch,
    CorporatePrizePatch,
    CorporatePrizes,
    CorporateReviewDashboard,
    CorporateReviewEmployee,
    CorporateReviewSkill,
    CorporateReviewTotals,
    CorporateTaskDraft,
    CorporateTaskDraftAssignRequest,
    CorporateTaskDraftAssignResponse,
    CorporateTaskDraftCreateRequest,
    CorporateTaskDraftGenerateRequest,
    Profile,
    Role,
)
from ..services.corporate_ai import extract_document_text, generate_knowledge, generate_task_drafts

router = APIRouter(prefix="/api/corporate/admin", tags=["corporate-admin"])


@router.post("/documents", response_model=CorporateDocument)
async def upload_document(
    file: UploadFile = File(...),
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
) -> dict:
    data = await file.read()
    try:
        extracted_text = extract_document_text(file.filename or "document", file.content_type or "", data)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if not extracted_text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Document text could not be extracted.")

    return repository.create_corporate_document(
        {
            "organization_id": current_user.organization_id,
            "filename": file.filename or "document",
            "mime_type": file.content_type or "application/octet-stream",
            "extracted_text": extracted_text,
            "status": "ready",
            "created_by": current_user.id,
        }
    )


@router.get("/documents", response_model=list[CorporateDocument])
def list_documents(
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
) -> list[dict]:
    return repository.list_corporate_documents(current_user.organization_id)


@router.post("/knowledge/generate", response_model=CorporateKnowledgeBase)
def generate_knowledge_base(
    payload: CorporateKnowledgeGenerateRequest,
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
    settings: Settings = Depends(get_settings),
) -> dict:
    documents = repository.get_corporate_documents(current_user.organization_id, payload.document_ids or None)
    if payload.document_ids and len(documents) != len(set(payload.document_ids)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more documents were not found.")

    generated = generate_knowledge(payload.source_prompt, documents, payload.language, settings)
    return repository.upsert_corporate_knowledge_base(
        current_user.organization_id,
        {
            **generated,
            "source_prompt": payload.source_prompt,
            "created_by": current_user.id,
        },
    )


@router.get("/knowledge/current", response_model=CorporateKnowledgeBase)
def get_current_knowledge_base(
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
) -> dict:
    knowledge = repository.get_current_corporate_knowledge_base(current_user.organization_id)
    if not knowledge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base has not been created.")
    return knowledge


@router.patch("/knowledge/current", response_model=CorporateKnowledgeBase)
def patch_current_knowledge_base(
    payload: CorporateKnowledgePatch,
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
) -> dict:
    existing = repository.get_current_corporate_knowledge_base(current_user.organization_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base has not been created.")
    patch = payload.model_dump(exclude_unset=True)
    return repository.upsert_corporate_knowledge_base(current_user.organization_id, patch)


@router.post("/task-drafts/generate", response_model=list[CorporateTaskDraft])
def generate_corporate_task_drafts(
    payload: CorporateTaskDraftGenerateRequest,
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
    settings: Settings = Depends(get_settings),
) -> list[dict]:
    knowledge = repository.get_current_corporate_knowledge_base(current_user.organization_id)
    if payload.knowledge_base_id:
        knowledge = next(
            (
                row
                for row in [knowledge]
                if row and row["id"] == payload.knowledge_base_id
            ),
            None,
        )
    if not knowledge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base has not been created.")

    drafts = generate_task_drafts(knowledge, payload.count, payload.language, settings)
    rows = [
        {
            "organization_id": current_user.organization_id,
            "knowledge_base_id": knowledge["id"],
            **draft,
        }
        for draft in drafts
    ]
    return repository.create_corporate_task_drafts(rows)


@router.post("/task-drafts", response_model=CorporateTaskDraft)
def create_corporate_task_draft(
    payload: CorporateTaskDraftCreateRequest,
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
) -> dict:
    title = payload.title.strip()
    client_type = payload.client_type.strip()
    skill = payload.skill.strip()
    goal = payload.goal.strip()
    difficulty = payload.difficulty.strip() or "medium"

    if not title or not client_type or not skill or not goal:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Manual draft fields are required.")
    if difficulty not in {"easy", "medium", "hard"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Difficulty must be easy, medium, or hard.")

    knowledge = repository.get_current_corporate_knowledge_base(current_user.organization_id)
    if not knowledge:
        knowledge = repository.upsert_corporate_knowledge_base(
            current_user.organization_id,
            {
                "source_prompt": "",
                "company_brief": "",
                "rules_brief": "",
                "client_types": "",
                "task_goal": goal,
                "scoring_rules": "",
                "enabled_settings": {},
                "status": "manual",
                "created_by": current_user.id,
            },
        )
    knowledge_base_id = payload.knowledge_base_id or (knowledge["id"] if knowledge else None)

    rows = repository.create_corporate_task_drafts(
        [
            {
                "organization_id": current_user.organization_id,
                "knowledge_base_id": knowledge_base_id,
                "title": title,
                "client_type": client_type,
                "skill": skill,
                "difficulty": difficulty,
                "status": "manual",
                "generated_payload": {
                    "source": "manual",
                    "goal": goal,
                    "persona": client_type,
                    "skill": skill,
                    "difficulty": difficulty,
                    "steps": [
                        {"role": "ai", "text": goal},
                        {"role": "user", "expected": [skill], "hint": goal, "quickReplies": []},
                    ],
                },
            }
        ]
    )
    return rows[0]


@router.get("/task-drafts", response_model=list[CorporateTaskDraft])
def list_corporate_task_drafts(
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
) -> list[dict]:
    return repository.list_corporate_task_drafts(current_user.organization_id)


@router.post("/task-drafts/assign", response_model=CorporateTaskDraftAssignResponse)
def assign_corporate_task_drafts(
    payload: CorporateTaskDraftAssignRequest,
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
) -> CorporateTaskDraftAssignResponse:
    drafts = repository.get_corporate_task_drafts(current_user.organization_id, payload.task_draft_ids)
    if len(drafts) != len(set(payload.task_draft_ids)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more task drafts were not found.")

    assignments = []
    for draft in drafts:
        generated = draft.get("generated_payload") or {}
        material = repository.create_material(
            {
                "organization_id": current_user.organization_id,
                "title": f"Corporate task: {draft['title']}",
                "type": "corporate-task",
                "content": generated.get("goal") or draft["title"],
            }
        )
        scenario = repository.create_scenario(
            {
                "organization_id": current_user.organization_id,
                "material_id": material["id"],
                "title": draft["title"],
                "goal": generated.get("goal") or draft["title"],
                "difficulty": draft.get("difficulty") or "medium",
                "persona": generated.get("persona") or draft.get("client_type") or "Corporate customer",
                "opening_message": generated.get("openingMessage") or "I need you to explain this clearly.",
                "evaluation_skills": generated.get("evaluationSkills") or [draft.get("skill") or "communication"],
                "rubric": generated.get("rubric") or {},
            }
        )
        assignment = repository.create_assignment(
            {
                "organization_id": current_user.organization_id,
                "scenario_id": scenario["id"],
                "due_date": payload.due_date.isoformat() if payload.due_date else None,
                "required_score": payload.required_score,
            },
            payload.employee_ids,
        )
        assignments.append(Assignment.model_validate(assignment))

    return CorporateTaskDraftAssignResponse(assignments=assignments)


def _score_band(score: int) -> tuple[str, str]:
    if score >= 85:
        return "Решила", "Готов вести сложные диалоги и помогать команде."
    if score >= 70:
        return "Нужна 1 попытка", "Есть база, нужно усилить точность и следующий шаг."
    return "Не решила", "Нужна практика структуры, тона и работы по документам."


MASCULINE_DEMO_NAMES = {
    "Timur Saidov",
    "Aziz Yuldashev",
    "Dilshod Akramov",
    "Sardor Tursunov",
}


def _solved_label_for_employee(name: str, solved: str) -> str:
    if name in MASCULINE_DEMO_NAMES:
        return solved.replace("Решила", "Решил")
    return solved


def _employee_review(profile: dict, attempts: list[dict]) -> CorporateReviewEmployee:
    latest = attempts[0] if attempts else None
    score = int(latest.get("score", 0)) if latest else 0
    skill_scores = latest.get("skill_scores") if latest else {}
    feedback = latest.get("feedback") if latest else {}
    skill_scores = skill_scores or {}
    feedback = feedback or {}
    solved, character = _score_band(score)
    skills = [
        CorporateReviewSkill(label=str(label), value=int(value))
        for label, value in list(skill_scores.items())[:5]
    ] or [
        CorporateReviewSkill(label="Правила", value=score or 50),
        CorporateReviewSkill(label="Тон", value=max(score - 4, 40) if score else 50),
        CorporateReviewSkill(label="Структура", value=max(score - 8, 40) if score else 50),
    ]
    strengths = feedback.get("strengths") or feedback.get("good") or ["Точность", "Готовность учиться", "Профессиональный тон"]
    improved = next(iter(skill_scores.keys()), "Точность по документам") if skill_scores else "Точность по документам"
    return CorporateReviewEmployee(
        id=profile["id"],
        name=profile.get("name", "Unknown employee"),
        role=profile.get("role", "employee"),
        result=score,
        solved=_solved_label_for_employee(profile.get("name", "Unknown employee"), solved),
        improved=improved,
        trained=feedback.get("trained") or "Корпоративные правила",
        file_accuracy=min(100, score + 4) if score else 0,
        usefulness=min(100, score + 1) if score else 0,
        character=feedback.get("summary") or character,
        file_behavior=feedback.get("fileBehavior") or "Ответы оцениваются по точности к корпоративным материалам и соблюдению правил.",
        strengths=[str(item) for item in strengths[:3]],
        skills=skills,
    )


@router.get("/review", response_model=CorporateReviewDashboard)
def get_corporate_review(
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
) -> CorporateReviewDashboard:
    rows = repository.list_admin_dashboard_rows(current_user.organization_id)
    documents = repository.list_corporate_documents(current_user.organization_id)
    profiles = [
        profile
        for profile in repository.list_organization_profiles(current_user.organization_id)
        if profile.get("role") == "employee"
    ]
    attempts_by_user: dict[str, list[dict]] = {}
    for attempt in rows["attempts"]:
        attempts_by_user.setdefault(attempt["user_id"], []).append(attempt)
    for attempts in attempts_by_user.values():
        attempts.sort(key=lambda row: row.get("created_at") or "", reverse=True)

    employees = [_employee_review(profile, attempts_by_user.get(profile["id"], [])) for profile in profiles]
    scored = [employee.result for employee in employees if employee.result]
    return CorporateReviewDashboard(
        organization_id=current_user.organization_id,
        totals=CorporateReviewTotals(
            documents=len(documents),
            assignments=len(rows["assignments"]),
            employees=len(employees),
            attempts=len(rows["attempts"]),
            average_growth=round(mean(scored) - 70) if scored else 0,
        ),
        employees=employees,
    )


@router.get("/prizes", response_model=CorporatePrizes)
def get_prizes(
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
) -> dict:
    prizes = repository.get_corporate_prizes(current_user.organization_id)
    return prizes or {
        "organization_id": current_user.organization_id,
        "first_place": "1 место: денежный бонус и сертификат лидера обучения",
        "second_place": "2 место: подарок от компании и публичное признание",
        "third_place": "3 место: доступ к продвинутому AI-треку",
        "updated_by": None,
    }


@router.patch("/prizes", response_model=CorporatePrizes)
def patch_prizes(
    payload: CorporatePrizePatch,
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
) -> dict:
    return repository.upsert_corporate_prizes(
        current_user.organization_id,
        {
            **payload.model_dump(),
            "updated_by": current_user.id,
        },
    )
