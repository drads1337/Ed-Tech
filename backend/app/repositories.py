from abc import ABC, abstractmethod
from uuid import uuid4

from .supabase_client import get_supabase_client


class Repository(ABC):
    @abstractmethod
    def create_organization(self, name: str) -> dict:
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


class InMemoryRepository(Repository):
    def __init__(self) -> None:
        self.profiles: dict[str, dict] = {}
        self.materials: dict[str, dict] = {}
        self.scenarios: dict[str, dict] = {}
        self.assignments: dict[str, dict] = {}
        self.attempts: dict[str, dict] = {}

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


def get_repository() -> Repository:
    return SupabaseRepository()
