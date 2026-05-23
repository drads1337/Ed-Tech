from collections import defaultdict
from statistics import mean

from fastapi import APIRouter, Depends

from ..dependencies import require_roles
from ..repositories import Repository, get_repository
from ..schemas import (
    AdminDashboard,
    AdminDashboardEmployee,
    AdminDashboardScenario,
    EmployeeDashboard,
    EmployeeDashboardItem,
    Profile,
    Role,
)

router = APIRouter(prefix="/api", tags=["dashboards"])


@router.get("/employee/dashboard", response_model=EmployeeDashboard)
def get_employee_dashboard(
    current_user: Profile = Depends(require_roles(Role.employee, Role.solo)),
    repository: Repository = Depends(get_repository),
) -> EmployeeDashboard:
    assignments = repository.list_employee_assignments(current_user.id, current_user.organization_id)
    attempts = repository.list_attempts_for_user(current_user.id, current_user.organization_id)
    attempts_by_assignment = {attempt.get("assignment_id"): attempt for attempt in attempts if attempt.get("assignment_id")}
    attempts_by_scenario = {attempt["scenario_id"]: attempt for attempt in attempts}

    items = []
    for assignment in assignments:
        latest_attempt = attempts_by_assignment.get(assignment["id"]) or attempts_by_scenario.get(assignment["scenario_id"])
        items.append(
            EmployeeDashboardItem(
                assignment_id=assignment["id"],
                scenario=assignment["scenario"],
                due_date=assignment.get("due_date"),
                required_score=assignment["required_score"],
                latest_attempt=latest_attempt,
                status="completed" if latest_attempt else "assigned",
            )
        )

    return EmployeeDashboard(user=current_user, assignments=items)


@router.get("/admin/dashboard", response_model=AdminDashboard)
def get_admin_dashboard(
    current_user: Profile = Depends(require_roles(Role.admin)),
    repository: Repository = Depends(get_repository),
) -> AdminDashboard:
    rows = repository.list_admin_dashboard_rows(current_user.organization_id)
    attempts = rows["attempts"]
    attempts_by_user_and_scenario = {
        (attempt["user_id"], attempt["scenario_id"]): attempt
        for attempt in attempts
    }
    weak_skill_counts: dict[str, int] = defaultdict(int)
    scenarios = []

    for assignment in rows["assignments"]:
        employees = []
        scores = []
        for assignment_employee in assignment.get("assignment_employees", []):
            profile = assignment_employee.get("profile") or {}
            user_id = assignment_employee["employee_id"]
            attempt = attempts_by_user_and_scenario.get((user_id, assignment["scenario_id"]))
            if attempt:
                scores.append(attempt["score"])
                for skill, score in (attempt.get("skill_scores") or {}).items():
                    if score < assignment["required_score"]:
                        weak_skill_counts[skill] += 1

            employees.append(
                AdminDashboardEmployee(
                    user_id=user_id,
                    name=profile.get("name", "Unknown employee"),
                    email=profile.get("email", ""),
                    completed=bool(attempt),
                    latest_score=attempt["score"] if attempt else None,
                )
            )

        completion_rate = sum(1 for employee in employees if employee.completed) / len(employees) if employees else 0
        scenarios.append(
            AdminDashboardScenario(
                scenario_id=assignment["scenario_id"],
                title=assignment["scenario"]["title"],
                assigned_employees=employees,
                completion_rate=round(completion_rate, 2),
                average_score=round(mean(scores), 2) if scores else None,
            )
        )

    weak_skills = [
        skill
        for skill, _count in sorted(weak_skill_counts.items(), key=lambda item: item[1], reverse=True)
    ]
    return AdminDashboard(
        organization_id=current_user.organization_id,
        scenarios=scenarios,
        weak_skills=weak_skills,
    )
