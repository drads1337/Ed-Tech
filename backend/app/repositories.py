from abc import ABC, abstractmethod
from uuid import uuid4

from .config import get_settings
from .supabase_client import get_supabase_client


DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"
DEMO_ADMIN_ID = "00000000-0000-0000-0000-000000000010"
DEMO_EMPLOYEE_ID = "00000000-0000-0000-0000-000000000011"


class Repository(ABC):
    @abstractmethod
    def create_organization(self, name: str) -> dict:
        raise NotImplementedError

    @abstractmethod
    def create_session(self, payload: dict) -> dict:
        raise NotImplementedError

    @abstractmethod
    def get_session(self, session_id: str) -> dict | None:
        raise NotImplementedError

    @abstractmethod
    def update_session_transcript(self, session_id: str, transcript: list[dict]) -> dict:
        raise NotImplementedError

    @abstractmethod
    def upsert_profile(self, payload: dict) -> dict:
        raise NotImplementedError

    @abstractmethod
    def get_profile(self, user_id: str) -> dict | None:
        raise NotImplementedError

    @abstractmethod
    def create_material(self, payload: dict) -> dict:
        raise NotImplementedError

    @abstractmethod
    def get_material(self, material_id: str, organization_id: str) -> dict | None:
        raise NotImplementedError

    @abstractmethod
    def create_scenario(self, payload: dict) -> dict:
        raise NotImplementedError

    @abstractmethod
    def get_scenario(self, scenario_id: str, organization_id: str) -> dict | None:
        raise NotImplementedError

    @abstractmethod
    def create_assignment(self, payload: dict, employee_ids: list[str]) -> dict:
        raise NotImplementedError

    @abstractmethod
    def list_employee_assignments(self, user_id: str, organization_id: str) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def create_attempt(self, payload: dict) -> dict:
        raise NotImplementedError

    @abstractmethod
    def list_attempts_for_user(self, user_id: str, organization_id: str) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def list_admin_dashboard_rows(self, organization_id: str) -> dict:
        raise NotImplementedError


class SupabaseRepository(Repository):
    def __init__(self) -> None:
        self.client = get_supabase_client()

    def create_organization(self, name: str) -> dict:
        result = self.client.table("organizations").insert({"name": name}).execute()
        return result.data[0]

    def upsert_profile(self, payload: dict) -> dict:
        result = self.client.table("profiles").upsert(payload).execute()
        return result.data[0]

    def get_profile(self, user_id: str) -> dict | None:
        result = self.client.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
        return result.data

    def create_material(self, payload: dict) -> dict:
        result = self.client.table("training_materials").insert(payload).execute()
        return result.data[0]

    def get_material(self, material_id: str, organization_id: str) -> dict | None:
        result = (
            self.client.table("training_materials")
            .select("*")
            .eq("id", material_id)
            .eq("organization_id", organization_id)
            .maybe_single()
            .execute()
        )
        return result.data

    def create_scenario(self, payload: dict) -> dict:
        result = self.client.table("scenarios").insert(payload).execute()
        return result.data[0]

    def get_scenario(self, scenario_id: str, organization_id: str) -> dict | None:
        result = (
            self.client.table("scenarios")
            .select("*")
            .eq("id", scenario_id)
            .eq("organization_id", organization_id)
            .maybe_single()
            .execute()
        )
        return result.data

    def create_assignment(self, payload: dict, employee_ids: list[str]) -> dict:
        assignment = self.client.table("assignments").insert(payload).execute().data[0]
        rows = [
            {"assignment_id": assignment["id"], "employee_id": employee_id}
            for employee_id in employee_ids
        ]
        if rows:
            self.client.table("assignment_employees").insert(rows).execute()
        assignment["employee_ids"] = employee_ids
        return assignment

    def list_employee_assignments(self, user_id: str, organization_id: str) -> list[dict]:
        result = (
            self.client.table("assignment_employees")
            .select("assignment:assignments(*, scenario:scenarios(*))")
            .eq("employee_id", user_id)
            .execute()
        )
        assignments = [row["assignment"] for row in result.data if row.get("assignment")]
        return [row for row in assignments if row.get("organization_id") == organization_id]

    def create_attempt(self, payload: dict) -> dict:
        result = self.client.table("attempts").insert(payload).execute()
        return result.data[0]

    def list_attempts_for_user(self, user_id: str, organization_id: str) -> list[dict]:
        result = (
            self.client.table("attempts")
            .select("*, scenario:scenarios(organization_id)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [
            row
            for row in result.data
            if row.get("scenario", {}).get("organization_id") == organization_id
        ]

    def list_admin_dashboard_rows(self, organization_id: str) -> dict:
        assignments = (
            self.client.table("assignments")
            .select("*, scenario:scenarios(*), assignment_employees(employee_id, profile:profiles(*))")
            .eq("organization_id", organization_id)
            .execute()
            .data
        )
        attempts = (
            self.client.table("attempts")
            .select("*, scenario:scenarios(organization_id)")
            .execute()
            .data
        )
        attempts = [
            row
            for row in attempts
            if row.get("scenario", {}).get("organization_id") == organization_id
        ]
        return {"assignments": assignments, "attempts": attempts}

    def create_session(self, payload: dict) -> dict:
        result = self.client.table("simulation_sessions").insert(payload).execute()
        return result.data[0]

    def get_session(self, session_id: str) -> dict | None:
        result = (
            self.client.table("simulation_sessions")
            .select("*, scenario:scenarios(*)")
            .eq("id", session_id)
            .maybe_single()
            .execute()
        )
        return result.data

    def update_session_transcript(self, session_id: str, transcript: list[dict]) -> dict:
        result = (
            self.client.table("simulation_sessions")
            .update({"transcript": transcript})
            .eq("id", session_id)
            .execute()
        )
        return result.data[0]


class InMemoryRepository(Repository):
    def __init__(self, seed_demo: bool = False) -> None:
        self.profiles: dict[str, dict] = {}
        self.materials: dict[str, dict] = {}
        self.scenarios: dict[str, dict] = {}
        self.assignments: dict[str, dict] = {}
        self.attempts: dict[str, dict] = {}
        self.sessions: dict[str, dict] = {}

        if seed_demo:
            self._seed_demo()

    def _seed_demo(self) -> None:
        self.profiles[DEMO_ADMIN_ID] = {
            "id": DEMO_ADMIN_ID,
            "email": "admin@demo.com",
            "name": "Demo Admin",
            "role": "admin",
            "organization_id": DEMO_ORG_ID,
            "xp": 0,
            "streak": 0,
        }
        self.profiles[DEMO_EMPLOYEE_ID] = {
            "id": DEMO_EMPLOYEE_ID,
            "email": "employee1@demo.com",
            "name": "Employee One",
            "role": "employee",
            "organization_id": DEMO_ORG_ID,
            "xp": 120,
            "streak": 3,
        }
        material = self.create_material(
            {
                "organization_id": DEMO_ORG_ID,
                "title": "Enterprise Sales FAQ",
                "type": "text",
                "content": (
                    "Enterprise customers ask about security, procurement, implementation value, "
                    "contract guarantees, and operational savings."
                ),
            }
        )
        scenario = self.create_scenario(
            {
                "organization_id": DEMO_ORG_ID,
                "material_id": material["id"],
                "title": "Handle enterprise objections: Enterprise Sales FAQ",
                "goal": "Handle enterprise objections",
                "difficulty": "medium",
                "persona": "Skeptical enterprise customer",
                "opening_message": (
                    "I don't see why we need this product. We already have a solution, "
                    "and every vendor claims they can save us money."
                ),
                "evaluation_skills": [
                    "knowledge accuracy",
                    "objection handling",
                    "confidence",
                    "structure",
                    "policy adherence",
                ],
                "rubric": {
                    "accuracy": "Did the employee use correct product facts?",
                    "objectionHandling": "Did they handle resistance clearly?",
                    "confidence": "Did they sound confident?",
                    "structure": "Did they organize the answer in a clear sequence?",
                    "policyAdherence": "Did they stay within the training material and company policy?",
                },
            }
        )
        self.create_assignment(
            {
                "organization_id": DEMO_ORG_ID,
                "scenario_id": scenario["id"],
                "due_date": None,
                "required_score": 75,
            },
            [DEMO_EMPLOYEE_ID],
        )

    def create_organization(self, name: str) -> dict:
        row = {"id": str(uuid4()), "name": name}
        return row

    def upsert_profile(self, payload: dict) -> dict:
        self.profiles[payload["id"]] = payload
        return payload

    def get_profile(self, user_id: str) -> dict | None:
        return self.profiles.get(user_id)

    def create_material(self, payload: dict) -> dict:
        row = {"id": str(uuid4()), **payload}
        self.materials[row["id"]] = row
        return row

    def get_material(self, material_id: str, organization_id: str) -> dict | None:
        row = self.materials.get(material_id)
        return row if row and row["organization_id"] == organization_id else None

    def create_scenario(self, payload: dict) -> dict:
        row = {"id": str(uuid4()), **payload}
        self.scenarios[row["id"]] = row
        return row

    def get_scenario(self, scenario_id: str, organization_id: str) -> dict | None:
        row = self.scenarios.get(scenario_id)
        return row if row and row["organization_id"] == organization_id else None

    def create_assignment(self, payload: dict, employee_ids: list[str]) -> dict:
        row = {"id": str(uuid4()), **payload, "employee_ids": employee_ids}
        self.assignments[row["id"]] = row
        return row

    def list_employee_assignments(self, user_id: str, organization_id: str) -> list[dict]:
        return [
            {**row, "scenario": self.scenarios[row["scenario_id"]]}
            for row in self.assignments.values()
            if user_id in row["employee_ids"] and row["organization_id"] == organization_id
        ]

    def create_attempt(self, payload: dict) -> dict:
        row = {"id": str(uuid4()), **payload}
        self.attempts[row["id"]] = row
        return row

    def list_attempts_for_user(self, user_id: str, organization_id: str) -> list[dict]:
        return [
            row
            for row in self.attempts.values()
            if row["user_id"] == user_id
            and self.scenarios[row["scenario_id"]]["organization_id"] == organization_id
        ]

    def list_admin_dashboard_rows(self, organization_id: str) -> dict:
        assignments = [
            {
                **row,
                "scenario": self.scenarios[row["scenario_id"]],
                "assignment_employees": [
                    {"employee_id": user_id, "profile": self.profiles.get(user_id)}
                    for user_id in row["employee_ids"]
                ],
            }
            for row in self.assignments.values()
            if row["organization_id"] == organization_id
        ]
        attempts = [
            row
            for row in self.attempts.values()
            if self.scenarios[row["scenario_id"]]["organization_id"] == organization_id
        ]
        return {"assignments": assignments, "attempts": attempts}

    def create_session(self, payload: dict) -> dict:
        row = {"id": str(uuid4()), **payload}
        if "transcript" not in row:
            row["transcript"] = []
        self.sessions[row["id"]] = row
        return row

    def get_session(self, session_id: str) -> dict | None:
        row = self.sessions.get(session_id)
        if row:
            scenario = self.scenarios.get(row["scenario_id"])
            if scenario:
                row = {**row, "scenario": scenario}
        return row

    def update_session_transcript(self, session_id: str, transcript: list[dict]) -> dict:
        self.sessions[session_id]["transcript"] = transcript
        return self.sessions[session_id]


_demo_repository = InMemoryRepository(seed_demo=True)


def get_repository() -> Repository:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return _demo_repository
    return SupabaseRepository()
