from abc import ABC, abstractmethod
from datetime import datetime, timezone
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
    def get_organization(self, organization_id: str) -> dict | None:
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

    @abstractmethod
    def create_corporate_document(self, payload: dict) -> dict:
        raise NotImplementedError

    @abstractmethod
    def list_corporate_documents(self, organization_id: str) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def get_corporate_documents(self, organization_id: str, document_ids: list[str] | None = None) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def upsert_corporate_knowledge_base(self, organization_id: str, payload: dict) -> dict:
        raise NotImplementedError

    @abstractmethod
    def get_current_corporate_knowledge_base(self, organization_id: str) -> dict | None:
        raise NotImplementedError

    @abstractmethod
    def create_corporate_task_drafts(self, payloads: list[dict]) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def list_corporate_task_drafts(self, organization_id: str, knowledge_base_id: str | None = None) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def get_corporate_task_drafts(self, organization_id: str, task_draft_ids: list[str]) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def upsert_corporate_prizes(self, organization_id: str, payload: dict) -> dict:
        raise NotImplementedError

    @abstractmethod
    def get_corporate_prizes(self, organization_id: str) -> dict | None:
        raise NotImplementedError

    @abstractmethod
    def list_organization_profiles(self, organization_id: str) -> list[dict]:
        raise NotImplementedError

    # ── Solo / CommTrainer ────────────────────────────────────────────────────

    @abstractmethod
    def list_industries(self) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def list_solo_scenarios(self, industry_ids: list[str] | None = None) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def get_solo_scenario(self, scenario_id: str) -> dict | None:
        raise NotImplementedError

    @abstractmethod
    def list_daily_suggestions(self, industry_ids: list[str] | None = None) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def get_daily_quest(self) -> dict | None:
        raise NotImplementedError

    @abstractmethod
    def get_user_progress(self, user_id: str) -> dict | None:
        raise NotImplementedError

    @abstractmethod
    def upsert_user_progress(self, user_id: str, payload: dict) -> dict:
        raise NotImplementedError

    @abstractmethod
    def create_solo_attempt(self, payload: dict) -> dict:
        raise NotImplementedError


class SupabaseRepository(Repository):
    def __init__(self) -> None:
        self.client = get_supabase_client()

    def create_organization(self, name: str) -> dict:
        result = self.client.table("organizations").insert({"name": name}).execute()
        return result.data[0]

    def get_organization(self, organization_id: str) -> dict | None:
        result = (
            self.client.table("organizations")
            .select("*")
            .eq("id", organization_id)
            .maybe_single()
            .execute()
        )
        return result.data if result else None

    def upsert_profile(self, payload: dict) -> dict:
        result = self.client.table("profiles").upsert(payload).execute()
        return result.data[0]

    # Hardcoded demo profiles so X-Demo-User works even against real Supabase
    _DEMO_PROFILES: dict[str, dict] = {
        DEMO_ADMIN_ID: {"id": DEMO_ADMIN_ID, "email": "admin@demo.com", "name": "Demo Admin", "role": "admin", "organization_id": DEMO_ORG_ID, "xp": 0, "streak": 0},
        DEMO_EMPLOYEE_ID: {"id": DEMO_EMPLOYEE_ID, "email": "employee1@demo.com", "name": "Alina Karimova", "role": "employee", "organization_id": DEMO_ORG_ID, "xp": 120, "streak": 3},
    }

    def get_profile(self, user_id: str) -> dict | None:
        if user_id in self._DEMO_PROFILES:
            return self._DEMO_PROFILES[user_id]
        result = self.client.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
        return result.data if result else None

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
        return result.data if result else None

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
        return result.data if result else None

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

    def create_corporate_document(self, payload: dict) -> dict:
        return self.client.table("corporate_documents").insert(payload).execute().data[0]

    def list_corporate_documents(self, organization_id: str) -> list[dict]:
        return (
            self.client.table("corporate_documents")
            .select("*")
            .eq("organization_id", organization_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def get_corporate_documents(self, organization_id: str, document_ids: list[str] | None = None) -> list[dict]:
        query = self.client.table("corporate_documents").select("*").eq("organization_id", organization_id)
        if document_ids:
            query = query.in_("id", document_ids)
        return query.execute().data

    def upsert_corporate_knowledge_base(self, organization_id: str, payload: dict) -> dict:
        existing = self.get_current_corporate_knowledge_base(organization_id)
        if existing:
            return (
                self.client.table("corporate_knowledge_bases")
                .update(payload)
                .eq("id", existing["id"])
                .execute()
                .data[0]
            )
        return self.client.table("corporate_knowledge_bases").insert({"organization_id": organization_id, **payload}).execute().data[0]

    def get_current_corporate_knowledge_base(self, organization_id: str) -> dict | None:
        result = (
            self.client.table("corporate_knowledge_bases")
            .select("*")
            .eq("organization_id", organization_id)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def create_corporate_task_drafts(self, payloads: list[dict]) -> list[dict]:
        if not payloads:
            return []
        return self.client.table("corporate_task_drafts").insert(payloads).execute().data

    def list_corporate_task_drafts(self, organization_id: str, knowledge_base_id: str | None = None) -> list[dict]:
        query = self.client.table("corporate_task_drafts").select("*").eq("organization_id", organization_id)
        if knowledge_base_id:
            query = query.eq("knowledge_base_id", knowledge_base_id)
        return query.order("created_at", desc=True).execute().data

    def get_corporate_task_drafts(self, organization_id: str, task_draft_ids: list[str]) -> list[dict]:
        return (
            self.client.table("corporate_task_drafts")
            .select("*")
            .eq("organization_id", organization_id)
            .in_("id", task_draft_ids)
            .execute()
            .data
        )

    def upsert_corporate_prizes(self, organization_id: str, payload: dict) -> dict:
        result = (
            self.client.table("corporate_prizes")
            .upsert({"organization_id": organization_id, **payload}, on_conflict="organization_id")
            .execute()
        )
        return result.data[0]

    def get_corporate_prizes(self, organization_id: str) -> dict | None:
        result = (
            self.client.table("corporate_prizes")
            .select("*")
            .eq("organization_id", organization_id)
            .maybe_single()
            .execute()
        )
        return result.data if result else None

    def list_organization_profiles(self, organization_id: str) -> list[dict]:
        return (
            self.client.table("profiles")
            .select("*")
            .eq("organization_id", organization_id)
            .execute()
            .data
        )

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
        return result.data if result else None

    def update_session_transcript(self, session_id: str, transcript: list[dict]) -> dict:
        result = (
            self.client.table("simulation_sessions")
            .update({"transcript": transcript})
            .eq("id", session_id)
            .execute()
        )
        return result.data[0]

    def list_industries(self) -> list[dict]:
        try:
            return self.client.table("solo_industries").select("*").execute().data
        except Exception:
            return list(_INDUSTRIES)

    def list_solo_scenarios(self, industry_ids: list[str] | None = None) -> list[dict]:
        try:
            q = self.client.table("solo_scenarios").select("*")
            if industry_ids:
                q = q.in_("industry", industry_ids)
            return q.execute().data
        except Exception:
            if not industry_ids:
                return list(_SOLO_SCENARIOS)
            return [s for s in _SOLO_SCENARIOS if s["industry"] in industry_ids]

    def get_solo_scenario(self, scenario_id: str) -> dict | None:
        try:
            result = (
                self.client.table("solo_scenarios")
                .select("*")
                .eq("id", scenario_id)
                .maybe_single()
                .execute()
            )
            return result.data if result else None
        except Exception:
            return next((s for s in _SOLO_SCENARIOS if s["id"] == scenario_id), None)

    def list_daily_suggestions(self, industry_ids: list[str] | None = None) -> list[dict]:
        try:
            q = self.client.table("daily_suggestions").select("*")
            if industry_ids:
                q = q.in_("industry", industry_ids)
            data = q.execute().data
            # apply the same daily-rotation logic
            from datetime import date
            return _pick_daily_suggestions(data, industry_ids or ["medicine"], date.today().isoformat())
        except Exception:
            from datetime import date
            return _pick_daily_suggestions(_DAILY_SUGGESTIONS, industry_ids or ["medicine"], date.today().isoformat())

    def get_daily_quest(self) -> dict | None:
        try:
            result = self.client.table("solo_quests").select("*").limit(1).maybe_single().execute()
            return result.data or (_SOLO_QUESTS[0] if _SOLO_QUESTS else None)
        except Exception:
            return _SOLO_QUESTS[0] if _SOLO_QUESTS else None

    def get_user_progress(self, user_id: str) -> dict | None:
        try:
            result = (
                self.client.table("user_progress")
                .select("*")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            return result.data if result else None
        except Exception:
            return None

    def upsert_user_progress(self, user_id: str, payload: dict) -> dict:
        try:
            data = {**payload, "user_id": user_id, "updated_at": datetime.now(timezone.utc).isoformat()}
            result = self.client.table("user_progress").upsert(data, on_conflict="user_id").execute()
            return result.data[0]
        except Exception:
            return {**payload, "user_id": user_id}

    def create_solo_attempt(self, payload: dict) -> dict:
        try:
            result = self.client.table("solo_attempts").insert(payload).execute()
            return result.data[0]
        except Exception:
            return {"id": str(uuid4()), **payload, "created_at": datetime.now(timezone.utc).isoformat()}


_INDUSTRIES = [
    {"id": "medicine", "name": "Медицина", "icon": "🏥", "roles": ["Врач", "Медсестра", "Диспетчер"]},
    {"id": "psychology", "name": "Психология", "icon": "🧠", "roles": ["Психолог", "Соцработник"]},
    {"id": "education", "name": "Образование", "icon": "🎓", "roles": ["Преподаватель", "Куратор", "Методист"]},
    {"id": "finance", "name": "Финансы", "icon": "🏦", "roles": ["Менеджер банка", "Финансовый консультант"]},
    {"id": "hospitality", "name": "Сервис", "icon": "🛎️", "roles": ["Администратор", "Менеджер смены", "Саппорт"]},
    {"id": "public_service", "name": "Госуслуги", "icon": "🏛️", "roles": ["Оператор МФЦ", "Инспектор", "Координатор"]},
]

_SOLO_SCENARIOS = [
    {"id": "med_01", "industry": "medicine", "skill": "Сбор анамнеза", "title": "Пациент с болью в груди", "goal": "Сбор анамнеза", "difficulty": 2, "duration_min": 4, "xp_reward": 15, "coin_reward": 8, "ai_persona": "Тревожный пациент 55 лет", "patient_type": "angry", "script": [{"role": "ai", "text": "У меня здесь колет... уже третий день. Что это может быть?", "delay": 1200}, {"role": "user", "expected": ["локализация", "характер боли", "иррадиация"], "hint": "Начните с места боли, характера ощущений и отдаёт ли боль куда-то.", "quickReplies": ["Покажите, где именно болит, какая боль по характеру и отдаёт ли она куда-то?", "Сколько вам лет и принимали ли вы таблетки?"]}, {"role": "ai", "text": "Больше слева. Иногда будто жжёт и уходит в плечо.", "delay": 1400}, {"role": "user", "expected": ["одышка", "тошнота", "пот"], "hint": "Проверьте красные флаги: одышка, тошнота, холодный пот.", "quickReplies": ["Есть ли одышка, тошнота или холодный пот?", "Попробуйте глубоко вдохнуть, стало легче?"]}, {"role": "ai", "text": "Да, сегодня немного тошнило, и я вспотел, когда поднимался по лестнице.", "delay": 1700}, {"role": "user", "expected": ["скорая", "безопасность", "спокойно"], "hint": "Нужно спокойно объяснить срочность и предложить безопасный следующий шаг.", "quickReplies": ["Симптомы требуют срочной оценки. Давайте вызовем скорую, а вы пока сядьте и не нагружайтесь.", "Понаблюдайте до завтра, возможно, пройдёт."]}], "feedback": {"good": ["Чётко спросили про локализацию", "Использовали эмпатию", "Отследили красные флаги"], "improve": ["Пропущен вопрос про аллергию", "Слишком быстрый темп"]}},
    {"id": "med_02", "industry": "medicine", "skill": "Эмпатия", "title": "Родитель в приёмном покое", "goal": "Снизить тревогу и собрать симптомы", "difficulty": 2, "duration_min": 5, "xp_reward": 16, "coin_reward": 9, "ai_persona": "Мама ребёнка с высокой температурой", "patient_type": "sad", "script": [{"role": "ai", "text": "У ребёнка 39,5, я уже не знаю, что делать. Почему нас не принимают сразу?", "delay": 1100}, {"role": "user", "expected": ["понимаю", "тревогу", "осмотр"], "hint": "Сначала признайте эмоцию, затем объясните ближайшее действие.", "quickReplies": ["Понимаю вашу тревогу. Сейчас уточню симптомы и помогу ускорить осмотр по приоритету.", "Все ждут, вам нужно успокоиться."]}, {"role": "ai", "text": "Он вялый, почти не пьёт. Я боюсь, что станет хуже.", "delay": 1500}, {"role": "user", "expected": ["пьёт", "мочился", "сыпь"], "hint": "Уточните признаки обезвоживания и опасные симптомы.", "quickReplies": ["Когда он пил последний раз, мочился ли сегодня, есть ли сыпь или судороги?", "Какая температура была утром?"]}, {"role": "ai", "text": "Пил пару глотков, подгузник почти сухой. Сыпи нет.", "delay": 1500}, {"role": "user", "expected": ["передам", "врач", "рядом"], "hint": "Завершите поддержкой и понятным обещанием без ложной гарантии.", "quickReplies": ["Я передам врачу эти признаки прямо сейчас. Оставайтесь рядом, мы не оставим вас без внимания.", "Тогда это не срочно, ждите вызова."]}], "feedback": {"good": ["Назвали тревогу родителя", "Собрали признаки обезвоживания", "Дали понятный следующий шаг"], "improve": ["Можно было уточнить вес ребёнка", "Не хватает проверки лекарств и дозировок"]}},
    {"id": "psy_01", "industry": "psychology", "skill": "Активное слушание", "title": "Клиент после конфликта", "goal": "Отразить эмоции и уточнить запрос", "difficulty": 1, "duration_min": 4, "xp_reward": 12, "coin_reward": 7, "ai_persona": "Клиент, обиженный на коллегу", "patient_type": "neutral", "script": [{"role": "ai", "text": "Я сорвался на коллегу. Теперь стыдно, но он тоже перегнул.", "delay": 1200}, {"role": "user", "expected": ["стыд", "злость", "слышится"], "hint": "Отразите две эмоции без оценки.", "quickReplies": ["Слышится, что вам одновременно стыдно и злитесь из-за того, как всё произошло.", "Вы оба виноваты, надо просто извиниться."]}, {"role": "ai", "text": "Да. И я боюсь, что теперь на работе все будут смотреть косо.", "delay": 1300}, {"role": "user", "expected": ["страх", "последствия", "важно"], "hint": "Уточните, какие последствия для клиента самые значимые.", "quickReplies": ["Похоже, вас пугают последствия. Что сейчас для вас самое важное сохранить на работе?", "Почему вас так волнует мнение других?"]}, {"role": "ai", "text": "Хочу восстановить контакт и не выглядеть слабым.", "delay": 1500}, {"role": "user", "expected": ["варианты", "контакт", "границы"], "hint": "Предложите исследовать варианты с учётом контакта и границ.", "quickReplies": ["Давайте рассмотрим варианты, как восстановить контакт и одновременно обозначить границы.", "Лучше сделать вид, что ничего не было."]}], "feedback": {"good": ["Отражали чувства без давления", "Уточнили значимый результат", "Сохранили нейтральность"], "improve": ["Можно мягче проверить телесные реакции", "Не стоит торопиться с советами"]}},
    {"id": "psy_02", "industry": "psychology", "skill": "Кризисная коммуникация", "title": "Подросток говорит «мне всё равно»", "goal": "Оценить риск и удержать контакт", "difficulty": 3, "duration_min": 6, "xp_reward": 22, "coin_reward": 12, "ai_persona": "Замкнутый подросток 16 лет", "patient_type": "sad", "script": [{"role": "ai", "text": "Мне всё равно. Никто всё равно не поймёт.", "delay": 1200}, {"role": "user", "expected": ["рядом", "сложно", "расскажешь"], "hint": "Сохраняйте контакт и не спорьте с переживанием.", "quickReplies": ["Похоже, сейчас очень сложно. Я рядом и готов слушать, если расскажешь хотя бы немного.", "Так говорить нельзя, это пугает взрослых."]}, {"role": "ai", "text": "Я просто устал. Иногда думаю, что всем будет легче без меня.", "delay": 1500}, {"role": "user", "expected": ["безопасность", "навредить", "план"], "hint": "Прямо и спокойно оцените риск самоповреждения.", "quickReplies": ["Спасибо, что сказал. Ты думал навредить себе, есть ли план или что-то опасное рядом?", "Не говори так, подумай о родителях."]}, {"role": "ai", "text": "Плана нет, но дома есть таблетки. Я один.", "delay": 1700}, {"role": "user", "expected": ["взрослый", "таблетки", "связь"], "hint": "Нужен ближайший взрослый и удаление опасных предметов.", "quickReplies": ["Давай прямо сейчас свяжемся с взрослым рядом, а таблетки уберём подальше, пока мы на связи.", "Ложись спать, утром станет легче."]}], "feedback": {"good": ["Сохранили контакт", "Задали прямой вопрос о риске", "Предложили конкретный план безопасности"], "improve": ["Важно назвать экстренные контакты", "Не хватает согласования следующей проверки связи"]}},
    {"id": "edu_01", "industry": "education", "skill": "Обратная связь", "title": "Студент спорит с оценкой", "goal": "Дать обратную связь без эскалации", "difficulty": 2, "duration_min": 4, "xp_reward": 14, "coin_reward": 8, "ai_persona": "Раздражённый студент", "patient_type": "angry", "script": [{"role": "ai", "text": "Вы занизили оценку. Я потратил на проект всю неделю.", "delay": 1000}, {"role": "user", "expected": ["вижу", "усилия", "критерии"], "hint": "Признайте усилия и переведите разговор к критериям.", "quickReplies": ["Вижу, что вы вложили много усилий. Давайте спокойно пройдёмся по критериям оценки.", "Неделя работы не гарантирует высокий балл."]}, {"role": "ai", "text": "Но у других ошибки были хуже, а баллы выше.", "delay": 1400}, {"role": "user", "expected": ["не сравнивать", "ваша работа", "пример"], "hint": "Не обсуждайте чужие работы, вернитесь к конкретике.", "quickReplies": ["Я не буду сравнивать с чужими работами. Покажу на вашей работе конкретный пример.", "У них были другие обстоятельства."]}, {"role": "ai", "text": "Хорошо, но мне важно понять, как исправить.", "delay": 1300}, {"role": "user", "expected": ["план", "доработка", "срок"], "hint": "Закройте разговор планом доработки и сроком.", "quickReplies": ["Составим короткий план доработки и договоримся о сроке повторной сдачи.", "Прочитайте методичку ещё раз."]}], "feedback": {"good": ["Признали усилия", "Опирались на критерии", "Не обсуждали других студентов"], "improve": ["Можно спросить, что студент уже понял сам", "Не хватает одного конкретного примера критерия"]}},
    {"id": "edu_02", "industry": "education", "skill": "Мотивационное интервью", "title": "Сотрудник не проходит обучение", "goal": "Выяснить барьеры и договориться о шаге", "difficulty": 2, "duration_min": 5, "xp_reward": 15, "coin_reward": 9, "ai_persona": "Уставший сотрудник на курсе", "patient_type": "neutral", "script": [{"role": "ai", "text": "Я опять не успел пройти модуль. Честно, не вижу смысла.", "delay": 1200}, {"role": "user", "expected": ["смысл", "мешает", "расскажите"], "hint": "Спросите о барьерах и смысле вместо упрёка.", "quickReplies": ["Расскажите, что больше всего мешает и какой смысл обучения сейчас неочевиден?", "Если не пройдёте, будут последствия."]}, {"role": "ai", "text": "После смены сил нет. А задания кажутся абстрактными.", "delay": 1400}, {"role": "user", "expected": ["пример", "работа", "маленький шаг"], "hint": "Свяжите обучение с реальной задачей и уменьшите шаг.", "quickReplies": ["Давайте возьмём один пример из вашей работы и выберем маленький шаг на 15 минут.", "Нужно просто дисциплинироваться."]}, {"role": "ai", "text": "15 минут звучит реально. Но я могу забыть.", "delay": 1200}, {"role": "user", "expected": ["напоминание", "время", "договоримся"], "hint": "Договоритесь о времени и напоминании.", "quickReplies": ["Договоримся о конкретном времени и включим напоминание перед началом.", "Тогда начните когда получится."]}], "feedback": {"good": ["Выяснили барьеры", "Связали обучение с работой", "Предложили реалистичный шаг"], "improve": ["Можно сильнее подчеркнуть автономию сотрудника", "Не хватает проверки согласия на план"]}},
    {"id": "fin_01", "industry": "finance", "skill": "Работа с возражениями", "title": "Клиент сомневается в тарифе", "goal": "Объяснить ценность без давления", "difficulty": 2, "duration_min": 4, "xp_reward": 15, "coin_reward": 8, "ai_persona": "Клиент банка, сравнивающий тарифы", "patient_type": "vip", "script": [{"role": "ai", "text": "У конкурентов обслуживание дешевле. Почему я должен платить больше?", "delay": 1000}, {"role": "user", "expected": ["сравнить", "важно", "задачи"], "hint": "Сначала узнайте, что для клиента важнее цены.", "quickReplies": ["Давайте сравним по вашим задачам: что кроме цены для вас важно в обслуживании?", "Потому что у нас надёжнее."]}, {"role": "ai", "text": "Мне важны быстрые платежи и чтобы поддержка отвечала без очереди.", "delay": 1300}, {"role": "user", "expected": ["платежи", "поддержка", "выгода"], "hint": "Свяжите тариф с названными задачами клиента.", "quickReplies": ["В этом тарифе как раз быстрые платежи и приоритетная поддержка, поэтому выгода не только в цене.", "Тогда берите самый дорогой тариф."]}, {"role": "ai", "text": "А если мне не подойдёт?", "delay": 1200}, {"role": "user", "expected": ["период", "пересмотр", "без давления"], "hint": "Снимите риск через период проверки и отсутствие давления.", "quickReplies": ["Можно начать с периода проверки и потом пересмотреть тариф без давления.", "Если не подойдёт, это уже будет ваш выбор."]}], "feedback": {"good": ["Не спорили о цене", "Выявили критерии клиента", "Снизили риск решения"], "improve": ["Можно назвать конкретный срок пересмотра", "Не хватает проверки бюджета"]}},
    {"id": "fin_02", "industry": "finance", "skill": "Объяснение сложного", "title": "Инвестор боится просадки", "goal": "Объяснить риск простым языком", "difficulty": 3, "duration_min": 6, "xp_reward": 21, "coin_reward": 12, "ai_persona": "Начинающий инвестор", "patient_type": "good", "script": [{"role": "ai", "text": "Портфель просел на 8%. Это всё, я потерял деньги?", "delay": 1000}, {"role": "user", "expected": ["понимаю", "просадка", "не зафиксировали"], "hint": "Признайте тревогу и объясните разницу между просадкой и фиксированным убытком.", "quickReplies": ["Понимаю тревогу. Просадка означает снижение стоимости сейчас, но убыток не зафиксирован, пока вы не продали.", "Это нормально, рынок всегда возвращается."]}, {"role": "ai", "text": "Но вдруг упадёт ещё сильнее?", "delay": 1300}, {"role": "user", "expected": ["риск", "горизонт", "диверсификация"], "hint": "Объясните риск через горизонт и диверсификацию.", "quickReplies": ["Такой риск есть, поэтому важны горизонт инвестирования и диверсификация, а не решение в панике.", "Нужно срочно докупить."]}, {"role": "ai", "text": "Что мне делать сегодня?", "delay": 1200}, {"role": "user", "expected": ["план", "цель", "порог"], "hint": "Верните клиента к заранее согласованному плану и порогам.", "quickReplies": ["Сегодня сверим портфель с вашей целью, планом и порогом риска, после этого выберем действие.", "Просто ничего не делайте."]}], "feedback": {"good": ["Объяснили термин простыми словами", "Не дали гарантии доходности", "Вернули к плану"], "improve": ["Можно уточнить срок цели", "Стоит проговорить, что это не индивидуальная рекомендация без анализа"]}},
    {"id": "svc_01", "industry": "hospitality", "skill": "Деэскалация", "title": "Гость недоволен номером", "goal": "Снизить напряжение и предложить варианты", "difficulty": 2, "duration_min": 4, "xp_reward": 14, "coin_reward": 8, "ai_persona": "Раздражённый гость отеля", "patient_type": "angry", "script": [{"role": "ai", "text": "В номере шумно и пахнет краской. Я не собираюсь за это платить!", "delay": 1000}, {"role": "user", "expected": ["понимаю", "неприятно", "проверю"], "hint": "Признайте неудобство и возьмите ситуацию в работу.", "quickReplies": ["Понимаю, это неприятно. Я сейчас проверю доступные варианты и помогу решить вопрос.", "У нас все номера такие, ничем не могу помочь."]}, {"role": "ai", "text": "Мне нужен тихий номер сегодня, у меня завтра встреча.", "delay": 1300}, {"role": "user", "expected": ["тихий", "сегодня", "варианты"], "hint": "Повторите приоритет гостя и предложите варианты.", "quickReplies": ["Ваш приоритет - тихий номер уже сегодня. Проверю замену и альтернативные варианты размещения.", "Могу предложить беруши."]}, {"role": "ai", "text": "И что с оплатой за эту ночь?", "delay": 1200}, {"role": "user", "expected": ["компенсация", "правила", "менеджер"], "hint": "Не обещайте лишнего, но обозначьте процесс компенсации.", "quickReplies": ["Я передам менеджеру вопрос компенсации по правилам отеля и вернусь с решением после переселения.", "Вернём всё, только не ругайтесь."]}], "feedback": {"good": ["Снизили накал", "Повторили ключевую потребность", "Не дали неподтверждённого обещания"], "improve": ["Можно назвать время ответа менеджера", "Не хватает извинения за конкретное неудобство"]}},
    {"id": "svc_02", "industry": "hospitality", "skill": "Стрессоустойчивость", "title": "Клиент кричит в поддержке", "goal": "Остаться спокойным и вернуть диалог к фактам", "difficulty": 3, "duration_min": 5, "xp_reward": 20, "coin_reward": 11, "ai_persona": "Клиент, у которого сорвалась доставка", "patient_type": "angry", "script": [{"role": "ai", "text": "Вы испортили мне весь день! Где мой заказ? Я требую ответ сейчас!", "delay": 900}, {"role": "user", "expected": ["понимаю", "проверю", "номер заказа"], "hint": "Сохраняйте ровный тон, признайте эмоцию и запросите факт.", "quickReplies": ["Понимаю, ситуация очень неприятная. Я проверю статус, подскажите номер заказа.", "Не кричите, иначе я завершу чат."]}, {"role": "ai", "text": "Номер 4821. И не надо мне ваших шаблонов.", "delay": 1200}, {"role": "user", "expected": ["4821", "минуту", "решение"], "hint": "Подтвердите номер и обозначьте короткое ожидание.", "quickReplies": ["Проверяю заказ 4821, это займёт минуту. После этого предложу решение.", "Я же сказал, ожидайте."]}, {"role": "ai", "text": "Если его нет через час, я пишу жалобу.", "delay": 1400}, {"role": "user", "expected": ["срок", "варианты", "жалоба"], "hint": "Не спорьте с жалобой, дайте срок и варианты.", "quickReplies": ["Вы вправе оставить жалобу. Сейчас уточню реальный срок и предложу варианты: ускорение или компенсация.", "Жалоба ничего не ускорит."]}], "feedback": {"good": ["Сохранили спокойный тон", "Вернули разговор к фактам", "Не обесценили право на жалобу"], "improve": ["Можно установить границу общения мягче", "Не хватает финального резюме договорённости"]}},
    {"id": "gov_01", "industry": "public_service", "skill": "Ясные инструкции", "title": "Посетитель запутался в документах", "goal": "Объяснить порядок действий без канцелярита", "difficulty": 1, "duration_min": 4, "xp_reward": 12, "coin_reward": 7, "ai_persona": "Пожилой посетитель МФЦ", "patient_type": "good", "script": [{"role": "ai", "text": "Я уже третий раз прихожу. Опять чего-то не хватает?", "delay": 1100}, {"role": "user", "expected": ["понимаю", "проверим", "список"], "hint": "Сначала снизьте раздражение, затем предложите совместную проверку.", "quickReplies": ["Понимаю, это утомительно. Давайте вместе проверим список документов по шагам.", "Если чего-то нет, придётся прийти ещё раз."]}, {"role": "ai", "text": "У меня паспорт, заявление и копия договора. Что ещё?", "delay": 1200}, {"role": "user", "expected": ["паспорт", "заявление", "выписка"], "hint": "Повторите имеющееся и назовите недостающее простыми словами.", "quickReplies": ["Паспорт, заявление и договор есть. Не хватает выписки, её можно получить в соседнем окне.", "Нужен документ по форме 7-Б."]}, {"role": "ai", "text": "Я могу сделать это сегодня?", "delay": 1000}, {"role": "user", "expected": ["сегодня", "окно", "вернуться"], "hint": "Дайте короткий маршрут и следующий шаг.", "quickReplies": ["Да, сегодня: сначала окно 4 за выпиской, потом вернитесь ко мне, и мы завершим подачу.", "Попробуйте, если успеете."]}], "feedback": {"good": ["Говорили простыми словами", "Разложили действия по шагам", "Подтвердили возможность сделать сегодня"], "improve": ["Можно записать маршрут на бумаге", "Не хватает проверки, понял ли посетитель инструкцию"]}},
    {"id": "gov_02", "industry": "public_service", "skill": "Нейтральный тон", "title": "Заявитель обвиняет ведомство", "goal": "Ответить нейтрально и удержать процесс", "difficulty": 3, "duration_min": 6, "xp_reward": 21, "coin_reward": 12, "ai_persona": "Заявитель после отказа", "patient_type": "neutral", "script": [{"role": "ai", "text": "Вы специально всё отклоняете. У вас тут круговая порука!", "delay": 1000}, {"role": "user", "expected": ["понимаю", "расстроены", "причина отказа"], "hint": "Не защищайте систему, верните разговор к причине отказа.", "quickReplies": ["Понимаю, вы расстроены. Давайте разберём конкретную причину отказа и варианты исправления.", "Это необоснованное обвинение."]}, {"role": "ai", "text": "Причина написана непонятно. «Недостаточно оснований» - что это значит?", "delay": 1300}, {"role": "user", "expected": ["простыми словами", "подтверждение", "документ"], "hint": "Переведите формулировку на простой язык.", "quickReplies": ["Простыми словами: не хватает документа, который подтверждает основание для услуги.", "Это юридическая формулировка, она стандартная."]}, {"role": "ai", "text": "И как мне подать снова, чтобы не отказали?", "delay": 1200}, {"role": "user", "expected": ["перечень", "срок", "повторная подача"], "hint": "Назовите перечень, срок и путь повторной подачи.", "quickReplies": ["Я дам перечень документов, срок подготовки и путь повторной подачи через личный кабинет или окно.", "Гарантировать ничего не могу."]}], "feedback": {"good": ["Не перешли в спор", "Перевели формулировку на простой язык", "Удержали процесс"], "improve": ["Можно заранее назвать право на обжалование", "Не хватает письменного резюме следующих шагов"]}},
    {"id": "cross_01", "industry": "hospitality", "skill": "Конфликт", "title": "Коллега срывает дедлайн", "goal": "Провести сложный разговор без обвинений", "difficulty": 2, "duration_min": 5, "xp_reward": 16, "coin_reward": 9, "ai_persona": "Коллега, который избегает ответственности", "patient_type": "neutral", "script": [{"role": "ai", "text": "Я не успел свою часть. У меня и так задач выше крыши.", "delay": 1000}, {"role": "user", "expected": ["понимаю", "дедлайн", "влияние"], "hint": "Признайте нагрузку и назовите влияние на общий результат.", "quickReplies": ["Понимаю, нагрузка большая. При этом дедлайн влияет на весь релиз, нужно договориться о плане.", "Ты опять всех подводишь."]}, {"role": "ai", "text": "Ну а что я сделаю, если мне не дали людей?", "delay": 1300}, {"role": "user", "expected": ["ресурсы", "приоритет", "варианты"], "hint": "Соберите факты: ресурсы, приоритеты, варианты сокращения.", "quickReplies": ["Давай посмотрим ресурсы, приоритеты и варианты: что можно сократить или передать?", "Это не моя проблема."]}, {"role": "ai", "text": "Могу отдать черновик сегодня, финал завтра утром.", "delay": 1200}, {"role": "user", "expected": ["фиксируем", "черновик", "завтра"], "hint": "Зафиксируйте договорённость и точное время.", "quickReplies": ["Фиксируем: черновик сегодня, финал завтра утром. Во сколько я получу файл?", "Ладно, только не забудь."]}], "feedback": {"good": ["Говорили через влияние, а не обвинение", "Искали варианты", "Зафиксировали договорённость"], "improve": ["Нужно уточнить риск повторного срыва", "Можно договориться о промежуточной проверке"]}},
    {"id": "cross_02", "industry": "education", "skill": "Переговоры", "title": "Руководитель просит невозможное", "goal": "Согласовать реалистичный объём", "difficulty": 3, "duration_min": 6, "xp_reward": 22, "coin_reward": 12, "ai_persona": "Руководитель с срочной задачей", "patient_type": "vip", "script": [{"role": "ai", "text": "Нужно подготовить полный отчёт к вечеру. Это приоритет номер один.", "delay": 1000}, {"role": "user", "expected": ["приоритет", "объём", "срок"], "hint": "Подтвердите приоритет и уточните объём результата к сроку.", "quickReplies": ["Понимаю, это приоритет. Уточню объём: какой результат к вечеру нужен обязательно?", "Это невозможно сделать к вечеру."]}, {"role": "ai", "text": "Мне нужны выводы, таблицы и презентация для совета.", "delay": 1300}, {"role": "user", "expected": ["варианты", "минимум", "качество"], "hint": "Предложите варианты с компромиссом по объёму и качеству.", "quickReplies": ["Есть варианты: к вечеру минимум с выводами и ключевыми таблицами, презентацию доработать утром.", "Если хотите качество, ждите неделю."]}, {"role": "ai", "text": "Хорошо, но выводы должны быть точными.", "delay": 1200}, {"role": "user", "expected": ["данные", "проверка", "согласуем"], "hint": "Закройте договорённость через источник данных и проверку.", "quickReplies": ["Тогда согласуем источники данных и одну проверку в 18:00, чтобы выводы были точными.", "Точность зависит от того, что успею найти."]}], "feedback": {"good": ["Не отказались резко", "Предложили реалистичный минимум", "Согласовали проверку качества"], "improve": ["Можно уточнить, что снять с текущих задач", "Не хватает письменного подтверждения договорённости"]}},
]

_DAILY_SUGGESTIONS = [
    {"id": "offer_med_conflict", "industry": "medicine", "skill": "Деэскалация", "title": "Сложный конфликт в приёмной", "description": "Пациент отказывается ждать и требует немедленного приёма. Отработайте спокойный тон и границы.", "price": 0, "emoji": "⚡", "difficulty": 2, "duration_min": 5, "patient_type": "angry"},
    {"id": "offer_med_chest", "industry": "medicine", "skill": "Сбор анамнеза", "title": "Боль в груди под давлением", "description": "Срочный сбор симптомов при тревоге пациента. Уточните красные флаги и следующий шаг.", "price": 5, "emoji": "🫀", "difficulty": 2, "duration_min": 4, "patient_type": "vip"},
    {"id": "offer_med_parent", "industry": "medicine", "skill": "Эмпатия", "title": "Родитель в панике", "description": "Мама ребёнка с высокой температурой. Снизьте тревогу и соберите ключевые симптомы.", "price": 3, "emoji": "👶", "difficulty": 2, "duration_min": 5, "patient_type": "sad"},
    {"id": "offer_psy_crisis", "industry": "psychology", "skill": "Кризисная коммуникация", "title": "Звонок в кризисной линии", "description": "Клиент в остром стрессе. Поддержите, уточните безопасность и предложите план на ближайший час.", "price": 8, "emoji": "📞", "difficulty": 3, "duration_min": 6, "patient_type": "sad"},
    {"id": "offer_psy_boundaries", "industry": "psychology", "skill": "Границы", "title": "Клиент нарушает границы", "description": "Собеседник давит на личный контакт. Отработайте вежливый отказ и возврат к теме сессии.", "price": 5, "emoji": "🛡️", "difficulty": 2, "duration_min": 4, "patient_type": "angry"},
    {"id": "offer_edu_parent", "industry": "education", "skill": "Обратная связь", "title": "Разговор с недовольным родителем", "description": "Родитель жалуется на оценки. Дайте конструктивную обратную связь без обороны.", "price": 4, "emoji": "📋", "difficulty": 2, "duration_min": 5, "patient_type": "angry"},
    {"id": "offer_edu_motivation", "industry": "education", "skill": "Мотивация", "title": "Студент выгорел", "description": "Учащийся потерял интерес. Найдите барьер и согласуйте один маленький шаг.", "price": 0, "emoji": "🌱", "difficulty": 1, "duration_min": 4, "patient_type": "neutral"},
    {"id": "offer_fin_negotiation", "industry": "finance", "skill": "Переговоры", "title": "Клиент требует скидку", "description": "Лояльный клиент недоволен тарифом. Сохраните отношения и предложите варианты без давления.", "price": 6, "emoji": "💳", "difficulty": 2, "duration_min": 5, "patient_type": "vip"},
    {"id": "offer_hosp_complaint", "industry": "hospitality", "skill": "Работа с жалобой", "title": "Гость недоволен номером", "description": "Жалоба на шум и сервис. Признайте эмоцию, уточните факты и предложите решение.", "price": 3, "emoji": "🛎️", "difficulty": 2, "duration_min": 4, "patient_type": "angry"},
    {"id": "offer_hosp_vip", "industry": "hospitality", "skill": "VIP-сервис", "title": "VIP-гость с особыми запросами", "description": "Постоянный клиент просит невозможное. Баланс ожиданий и реальных возможностей отеля.", "price": 10, "emoji": "⭐", "difficulty": 3, "duration_min": 6, "patient_type": "vip"},
    {"id": "offer_gov_queue", "industry": "public_service", "skill": "Ясные инструкции", "title": "Очередь в МФЦ", "description": "Гражданин не понимает список документов. Объясните простыми словами и зафиксируйте шаги.", "price": 0, "emoji": "🏛️", "difficulty": 1, "duration_min": 4, "patient_type": "neutral"},
    {"id": "offer_gov_refusal", "industry": "public_service", "skill": "Объяснение отказа", "title": "Отказ в услуге", "description": "Заявитель злится из-за отказа. Объясните причину, документы и путь повторной подачи.", "price": 5, "emoji": "📄", "difficulty": 2, "duration_min": 5, "patient_type": "angry"},
    {"id": "offer_med_ethics", "industry": "medicine", "skill": "Этика", "title": "Вопрос о диагнозе соседа", "description": "Родственник просит информацию о другом пациенте. Сохраните конфиденциальность и эмпатию.", "price": 7, "emoji": "🔒", "difficulty": 3, "duration_min": 5, "patient_type": "neutral"},
    {"id": "offer_psy_silence", "industry": "psychology", "skill": "Активное слушание", "title": "Долгое молчание клиента", "description": "Клиент не отвечает на вопросы. Мягко вовлеките без давления и уточняющих «почему».", "price": 4, "emoji": "🤫", "difficulty": 2, "duration_min": 5, "patient_type": "neutral"},
]

_SOLO_QUESTS = [
    {"id": "q1", "text": "Пройти 1 сценарий на стрессоустойчивость", "reward": 20, "type": "communication", "target_skill": "Стрессоустойчивость"},
]


def _hash_seed(s: str) -> int:
    h = 0
    for ch in s:
        h = ((h << 5) - h + ord(ch)) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return abs(h)


def _pick_daily_suggestions(pool: list[dict], industry_ids: list[str], date_key: str, count: int = 10) -> list[dict]:
    ids = industry_ids if industry_ids else ["medicine"]
    relevant = [item for item in pool if item["industry"] in ids]
    rest = [item for item in pool if item["industry"] not in ids]
    combined = relevant + rest if len(relevant) < count else relevant

    seed = _hash_seed(f"{date_key}:{','.join(sorted(ids))}")
    shuffled = sorted(combined, key=lambda item: _hash_seed(f"{seed}:{item['id']}"))

    seen: set[str] = set()
    result: list[dict] = []
    for item in shuffled:
        if item["id"] not in seen:
            seen.add(item["id"])
            result.append(item)
            if len(result) >= count:
                break
    return result


class InMemoryRepository(Repository):
    def __init__(self, seed_demo: bool = False) -> None:
        self.organizations: dict[str, dict] = {}
        self.profiles: dict[str, dict] = {}
        self.materials: dict[str, dict] = {}
        self.scenarios: dict[str, dict] = {}
        self.assignments: dict[str, dict] = {}
        self.attempts: dict[str, dict] = {}
        self.sessions: dict[str, dict] = {}
        self.user_progress: dict[str, dict] = {}
        self.solo_attempts: list[dict] = []
        self.corporate_documents: dict[str, dict] = {}
        self.corporate_knowledge_bases: dict[str, dict] = {}
        self.corporate_task_drafts: dict[str, dict] = {}
        self.corporate_prizes: dict[str, dict] = {}

        if seed_demo:
            self._seed_demo()

    def _seed_demo(self) -> None:
        self.organizations[DEMO_ORG_ID] = {"id": DEMO_ORG_ID, "name": "Demo Organization"}
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
            "name": "Alina Karimova",
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
        self.organizations[row["id"]] = row
        return row

    def get_organization(self, organization_id: str) -> dict | None:
        return self.organizations.get(organization_id)

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

    def create_corporate_document(self, payload: dict) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        row = {"id": str(uuid4()), "created_at": now, "updated_at": now, **payload}
        self.corporate_documents[row["id"]] = row
        return row

    def list_corporate_documents(self, organization_id: str) -> list[dict]:
        return [
            row
            for row in self.corporate_documents.values()
            if row["organization_id"] == organization_id
        ]

    def get_corporate_documents(self, organization_id: str, document_ids: list[str] | None = None) -> list[dict]:
        ids = set(document_ids or [])
        return [
            row
            for row in self.corporate_documents.values()
            if row["organization_id"] == organization_id and (not ids or row["id"] in ids)
        ]

    def upsert_corporate_knowledge_base(self, organization_id: str, payload: dict) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        existing = self.get_current_corporate_knowledge_base(organization_id)
        if existing:
            existing.update(payload)
            existing["updated_at"] = now
            return existing
        row = {"id": str(uuid4()), "organization_id": organization_id, "created_at": now, "updated_at": now, **payload}
        self.corporate_knowledge_bases[row["id"]] = row
        return row

    def get_current_corporate_knowledge_base(self, organization_id: str) -> dict | None:
        rows = [
            row
            for row in self.corporate_knowledge_bases.values()
            if row["organization_id"] == organization_id
        ]
        return sorted(rows, key=lambda row: row.get("updated_at") or "", reverse=True)[0] if rows else None

    def create_corporate_task_drafts(self, payloads: list[dict]) -> list[dict]:
        now = datetime.now(timezone.utc).isoformat()
        rows = []
        for payload in payloads:
            row = {"id": str(uuid4()), "created_at": now, "updated_at": now, **payload}
            self.corporate_task_drafts[row["id"]] = row
            rows.append(row)
        return rows

    def list_corporate_task_drafts(self, organization_id: str, knowledge_base_id: str | None = None) -> list[dict]:
        return [
            row
            for row in self.corporate_task_drafts.values()
            if row["organization_id"] == organization_id
            and (knowledge_base_id is None or row["knowledge_base_id"] == knowledge_base_id)
        ]

    def get_corporate_task_drafts(self, organization_id: str, task_draft_ids: list[str]) -> list[dict]:
        ids = set(task_draft_ids)
        return [
            row
            for row in self.corporate_task_drafts.values()
            if row["organization_id"] == organization_id and row["id"] in ids
        ]

    def upsert_corporate_prizes(self, organization_id: str, payload: dict) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        row = {"organization_id": organization_id, "updated_at": now, **payload}
        self.corporate_prizes[organization_id] = row
        return row

    def get_corporate_prizes(self, organization_id: str) -> dict | None:
        return self.corporate_prizes.get(organization_id)

    def list_organization_profiles(self, organization_id: str) -> list[dict]:
        return [
            row
            for row in self.profiles.values()
            if row["organization_id"] == organization_id
        ]

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

    def list_industries(self) -> list[dict]:
        return list(_INDUSTRIES)

    def list_solo_scenarios(self, industry_ids: list[str] | None = None) -> list[dict]:
        if not industry_ids:
            return list(_SOLO_SCENARIOS)
        return [s for s in _SOLO_SCENARIOS if s["industry"] in industry_ids]

    def get_solo_scenario(self, scenario_id: str) -> dict | None:
        return next((s for s in _SOLO_SCENARIOS if s["id"] == scenario_id), None)

    def list_daily_suggestions(self, industry_ids: list[str] | None = None) -> list[dict]:
        from datetime import date
        date_key = date.today().isoformat()
        return _pick_daily_suggestions(_DAILY_SUGGESTIONS, industry_ids or ["medicine"], date_key)

    def get_daily_quest(self) -> dict | None:
        return _SOLO_QUESTS[0] if _SOLO_QUESTS else None

    def get_user_progress(self, user_id: str) -> dict | None:
        return self.user_progress.get(user_id)

    def upsert_user_progress(self, user_id: str, payload: dict) -> dict:
        existing = self.user_progress.get(user_id, {"user_id": user_id})
        merged = {**existing, **payload, "user_id": user_id, "updated_at": datetime.now(timezone.utc).isoformat()}
        self.user_progress[user_id] = merged
        return merged

    def create_solo_attempt(self, payload: dict) -> dict:
        row = {"id": str(uuid4()), **payload, "created_at": datetime.now(timezone.utc).isoformat()}
        self.solo_attempts.append(row)
        return row


_demo_repository = InMemoryRepository(seed_demo=True)


def get_repository() -> Repository:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return _demo_repository
    return SupabaseRepository()
