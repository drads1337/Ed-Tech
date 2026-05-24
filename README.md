# Ed-Tech Training Loop

## Project Summary

Ed-Tech Training Loop is a full-stack communication training platform for employees and teams. It turns company materials, policies, FAQs, and playbooks into interactive AI roleplay scenarios where users practice difficult conversations in a 3D simulation.

The MVP includes a React/Vite frontend, FastAPI backend, Supabase integration, AI/fallback scenario generation, live roleplay responses, progress tracking, admin dashboards, and automated checks. It supports both solo learners and corporate training flows: admins create or upload training content, generate scenarios, assign them to employees, and review results.

## Notes for Organizers

- This is a working full-stack MVP, not a static mockup. The repo includes frontend, backend, API routes, tests, SQL schema, and 3D assets.
- The project can be reviewed without paid AI access: if `OPENROUTER_API_KEY` is missing, the backend uses deterministic fallback responses.
- Recommended demo path: start the backend, start the frontend, open the learner flow, then show the admin flow where a material becomes a scenario, assignment, attempt, score, and dashboard result.
- The live simulation demonstrates the core product idea: AI roleplay responses are connected to emotion/motion states that drive the 3D character experience.
- Supabase is used for the production-style auth/data layer, while tests use an in-memory repository to keep the review flow reproducible.
- Current MVP scope focuses on communication practice, scenario generation, scoring, progress, and dashboards. Voice input, full deployment config, and advanced HR analytics are planned next steps.

## Что уже работает

- Клиентское приложение на React + Vite.
- 3D-сцены на Three.js и React Three Fiber.
- Несколько GLB-моделей для разных форматов тренировки: персонаж, standing-сцена, desk/table-сцена.
- Онбординг пользователя с AI-summary и сохранением профиля.
- Личный тренажер с планом обучения, библиотекой кейсов, быстрыми практиками, прогрессом, профилем и результатами.
- Админский corporate-flow: материалы -> сценарий -> назначение -> попытка сотрудника -> оценка -> dashboard.
- FastAPI backend с роутами для материалов, сценариев, назначений, попыток, dashboard, solo-тренировок, onboarding и live simulation.
- Supabase-интеграция для Auth и хранения данных.
- In-memory repository для тестов и локального fallback-режима.
- Mock/deterministic AI fallback, чтобы демо не ломалось без API-ключей.
- OpenRouter-интеграция для генерации ответов и оценки live roleplay.
- Live simulation API: старт сцены, чат с персонажем, эмоции, motion-состояния и итоговый brief.
- Проверки: frontend route smoke-check, pose validation, backend pytest flow.

## Демо-сценарии для проверки на хакатоне

### 1. Solo learner flow

Пользователь открывает приложение, проходит onboarding, выбирает индустрию и попадает в личный тренажер.

Что показать:

- главная панель дня;
- персональный learning path;
- библиотека кейсов по индустриям;
- быстрый AI-кейс;
- страница сценария;
- результаты и прогресс;
- профиль и настройки.

Основные файлы:

- `src/CommTrainerApp.jsx` - solo learner experience;
- `src/data/mockData.js` - демо-индустрии, сценарии, achievements;
- `src/quickPractice.js` - логика quick practice;
- `src/backendApi.js` - клиент для FastAPI и Supabase.

### 2. Corporate admin flow

Администратор загружает материал компании, backend создает training material, затем генерируется сценарий, назначается сотруднику и результат попадает в dashboard.

Что показать:

- admin dashboard;
- загрузку/создание training material;
- генерацию сценария из материала;
- назначение задания сотруднику;
- employee dashboard;
- симуляцию ответа;
- оценку попытки;
- обновление admin dashboard.

Основные backend-роуты:

- `POST /api/materials`
- `GET /api/materials/{material_id}/chunks`
- `POST /api/scenarios/generate`
- `POST /api/assignments`
- `GET /api/employee/dashboard`
- `POST /api/simulation/message`
- `POST /api/attempts/evaluate`
- `GET /api/admin/dashboard`

### 3. Live 3D simulation flow

Пользователь запускает live-сцену, AI-персонаж отвечает как реальный собеседник, backend возвращает emotion/motion, frontend двигает 3D-персонажа и показывает речь.

Что показать:

- выбор сценария;
- разговор с AI-персонажем;
- смену эмоций;
- motion-состояния персонажа;
- финальный brief с оценкой, плюсами, зонами роста и следующими шагами.

Основные файлы:

- `src/App.jsx` - 3D-сцена, corporate routes, auth gates;
- `src/LiveMotion.jsx` - emotion/motion adjustments для персонажа;
- `backend/app/routers/live_sim.py` - API live simulation;
- `backend/app/services/live_sim.py` - OpenRouter prompt, parsing emotion/motion, brief evaluation.

## Архитектура

```text
React/Vite frontend
    |
    | fetch через src/backendApi.js
    v
FastAPI backend
    |
    | Repository abstraction
    |-- SupabaseRepository    -> Supabase tables/Auth
    |-- InMemoryRepository    -> tests/local deterministic mode
    |
    | AI services
    |-- mock_ai.py            -> deterministic scenario/score fallback
    |-- onboarding_ai.py      -> onboarding summary
    |-- plan_ai.py            -> learning plan generation
    |-- live_sim.py           -> live roleplay + emotion/motion + brief
    |
    v
Supabase + optional OpenRouter
```

### Frontend

Frontend написан на React 19 и Vite. Визуальная часть состоит из двух больших слоев:

- `src/App.jsx` - корневое приложение, auth, onboarding, admin/employee dashboard, simulation gate, 3D scene shell.
- `src/CommTrainerApp.jsx` - основной пользовательский тренажер: home, plan, library, progress, practice, profile, scenario, results.

3D-слой использует:

- `three`;
- `@react-three/fiber`;
- `@react-three/drei`;
- GLB-модели `ordinary.glb`, `bearded.glb`, `note.glb`, `table.glb`;
- pose-конфиги из `src/casePoses.js`;
- live motion helpers из `src/LiveMotion.jsx`.

### Backend

Backend написан на FastAPI. Точка входа:

- `backend/app/main.py`

Подключенные группы роутов:

- `backend/app/routers/auth.py` - профиль текущего пользователя и регистрация;
- `backend/app/routers/materials.py` - учебные материалы компании;
- `backend/app/routers/scenarios.py` - генерация сценариев;
- `backend/app/routers/assignments.py` - назначение сценариев сотрудникам;
- `backend/app/routers/dashboards.py` - admin и employee dashboards;
- `backend/app/routers/simulation.py` - обычная roleplay-симуляция;
- `backend/app/routers/attempts.py` - оценка попытки;
- `backend/app/routers/solo.py` - solo-продукт: индустрии, кейсы, прогресс, daily suggestions, план;
- `backend/app/routers/onboarding.py` - AI-summary после onboarding;
- `backend/app/routers/live_sim.py` - live 3D roleplay API.

Слой данных находится в:

- `backend/app/repositories.py`

Там есть общий интерфейс `Repository`, реализация `SupabaseRepository` и in-memory реализация для тестов. Благодаря этому бизнес-логика роутов не привязана напрямую к Supabase и легко тестируется.

### Data flow MVP

Главный corporate pipeline:

```text
Training material
    -> AI/generated scenario
    -> Assignment
    -> Employee roleplay attempt
    -> Evaluation score
    -> Admin dashboard analytics
```

Solo learner pipeline:

```text
Onboarding
    -> profile/progress
    -> personal learning plan
    -> scenario practice
    -> result screen
    -> XP/coins/streak/progress update
```

Live simulation pipeline:

```text
Scenario context
    -> /api/live-sim/start
    -> user message
    -> /api/live-sim/chat
    -> AI reply + emotion + motion
    -> 3D character reaction
    -> /api/live-sim/brief
    -> final coaching report
```

## Быстрый запуск

### Требования

- Node.js 20+
- npm
- Python 3.11+ или 3.12
- Supabase проект нужен для полноценного Auth/DB-режима
- OpenRouter API key нужен только для реальных AI-ответов; без него работают fallback-ответы

## Docker / VPS deploy

Для VPS достаточно Docker и Docker Compose.

### 1. Подготовить env

```bash
cp .env.example .env
```

Для запуска через `docker-compose` оставьте `VITE_API_BASE_URL` пустым или закомментированным: frontend будет обращаться к backend через Nginx по тому же домену на `/api`.

Минимально:

```env
APP_PORT=80
BACKEND_CORS_ORIGINS=http://your-domain.com,https://your-domain.com
```

Для Supabase/Auth:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Для real AI через OpenRouter:

```env
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=openai/gpt-oss-120b
OPENROUTER_APP_URL=https://your-domain.com
```

### 2. Запустить

```bash
docker compose up -d --build
```

Приложение будет доступно на:

```text
http://your-server-ip/
```

Backend health-check идет через frontend/Nginx:

```text
http://your-server-ip/api/health
```

Если порт `80` уже занят, поменяйте:

```env
APP_PORT=8080
```

и откройте:

```text
http://your-server-ip:8080/
```

### 1. Установить frontend dependencies

```bash
npm install
```

### 2. Создать backend virtualenv

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
```

### 3. Настроить env

Скопируйте пример:

```bash
cp .env.example .env
```

Минимально для локального запуска frontend + backend:

```env
VITE_API_BASE_URL=http://localhost:3001
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
PORT=3001
```

Для Supabase-режима:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Для real AI через OpenRouter:

```env
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-oss-120b
OPENROUTER_APP_URL=http://localhost:5173
OPENROUTER_APP_NAME=Ed-Tech Training Loop
```

### 4. Запустить backend

```bash
npm run backend:dev
```

Backend будет доступен на:

```text
http://localhost:3001
```

Проверка:

```text
http://localhost:3001/api/health
```

### 5. Запустить frontend

В другом терминале:

```bash
npm run dev
```

Vite обычно запускается на:

```text
http://localhost:5173
```

## Скрипты

```bash
npm run dev
```

Запускает Vite dev server.

```bash
npm run backend:dev
```

Запускает FastAPI через uvicorn на порту `3001`.

```bash
npm run build
```

Собирает production frontend в `dist/`.

```bash
npm run preview
```

Локально показывает production build.

```bash
npm run check:trainer-routes
```

Проверяет, что маршруты тренажера в `CommTrainerApp.jsx` не сломаны.

```bash
npm run check:pose
```

Проверяет pose-конфиги GLB-моделей.

```bash
npm run check
```

Запускает frontend-проверки `check:trainer-routes` и `check:pose`.

```bash
npm run backend:test
```

Запускает backend tests из `backend/tests`.

## Структура проекта

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app factory и подключение роутов
│   │   ├── config.py               # env/settings
│   │   ├── dependencies.py         # auth/repository dependencies
│   │   ├── repositories.py         # Supabase + in-memory data layer
│   │   ├── schemas.py              # Pydantic schemas
│   │   ├── supabase_client.py      # Supabase client
│   │   ├── routers/                # API endpoints
│   │   └── services/               # AI/mock/live/onboarding services
│   ├── supabase/
│   │   ├── schema.sql              # основная SQL-схема
│   │   ├── migrate_solo.sql        # solo trainer migration
│   │   └── seed_demo_profiles.sql  # demo profiles
│   ├── tests/                      # pytest API flow tests
│   └── requirements.txt
├── docs/
│   ├── backend-instructions.md
│   ├── backend-roadmap.md
│   └── run-backend.md
├── scripts/
│   ├── check-pose-config.mjs
│   ├── check-trainer-routes.mjs
│   └── measure-pose.mjs
├── src/
│   ├── App.jsx                     # root app, auth, admin/employee, 3D shell
│   ├── CommTrainerApp.jsx          # main solo trainer UI
│   ├── LiveMotion.jsx              # live emotion/motion mapping
│   ├── backendApi.js               # API client
│   ├── casePoses.js                # GLB pose configs
│   ├── data/mockData.js            # demo scenarios/industries
│   ├── quickPractice.js            # quick practice logic
│   ├── main.jsx
│   └── styles.css
├── bearded.glb
├── note.glb
├── ordinary.glb
├── table.glb
├── package.json
└── vite.config.js
```

## API overview

### System

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Проверка backend |
| `GET` | `/api/ai/status` | Показывает, используется OpenRouter или deterministic fallback |
| `GET` | `/api/contracts/scenario` | Контракт первого демо-сценария |
| `GET` | `/api/demo-users` | Демо-пользователи |

### Auth/Profile

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/me` | Текущий пользователь |
| `POST` | `/api/auth/register` | Создание профиля |

### Corporate training

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/materials` | Создать training material |
| `GET` | `/api/materials/{material_id}/chunks` | Получить chunks материала |
| `POST` | `/api/scenarios/generate` | Сгенерировать сценарий из материала |
| `POST` | `/api/assignments` | Назначить сценарий сотрудникам |
| `GET` | `/api/employee/dashboard` | Dashboard сотрудника |
| `GET` | `/api/admin/dashboard` | Dashboard администратора |
| `POST` | `/api/simulation/message` | Один шаг roleplay |
| `POST` | `/api/simulation/sessions` | Создать session-based simulation |
| `POST` | `/api/simulation/sessions/{session_id}/message` | Сообщение в session simulation |
| `POST` | `/api/attempts/evaluate` | Оценить попытку |

### Solo trainer

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/solo/industries` | Список индустрий |
| `GET` | `/api/solo/scenarios` | Список solo-сценариев |
| `GET` | `/api/solo/scenarios/{scenario_id}` | Один solo-сценарий |
| `GET` | `/api/solo/daily-suggestions` | Daily suggestions |
| `GET` | `/api/solo/quest/daily` | Квест дня |
| `GET` | `/api/solo/progress` | Прогресс пользователя |
| `POST` | `/api/solo/progress` | Обновить прогресс |
| `POST` | `/api/solo/attempts` | Сохранить solo attempt |
| `POST` | `/api/solo/generate-plan` | Сгенерировать learning plan |

### Live simulation

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/live-sim/start` | Старт live roleplay |
| `POST` | `/api/live-sim/chat` | Следующее сообщение AI-персонажа |
| `POST` | `/api/live-sim/brief` | Финальная оценка диалога |
| `GET` | `/api/live-sim/config` | Конфиг live simulation |

## База данных

SQL-файлы лежат в `backend/supabase/`.

Используйте:

- `schema.sql` для основной corporate-схемы;
- `migrate_solo.sql` для solo trainer таблиц;
- `seed_demo_profiles.sql` для демо-профилей.

Backend ожидает Supabase service role key для серверных операций. Frontend использует publishable key для Auth-сессии.

## AI и fallback-режим

Проект специально сделан так, чтобы его можно было показать даже без внешних AI-ключей.

Если `OPENROUTER_API_KEY` не задан:

- `/api/ai/status` вернет provider `deterministic`;
- scenario generation работает через `backend/app/services/mock_ai.py`;
- live simulation возвращает короткие fallback-ответы;
- brief строится локально через fallback-логику.

Если `OPENROUTER_API_KEY` задан:

- live simulation вызывает OpenRouter chat completions;
- модель просит персонажа отвечать коротко, оставаться в роли, возвращать `EMOTION` и `MOTION`;
- backend парсит emotion/motion и отправляет frontend структурированный ответ;
- финальный brief генерируется AI и нормализуется backend-ом.

## 3D и анимации

В проекте используются GLB-ассеты:

- `ordinary.glb` - базовый персонаж/сцена;
- `bearded.glb` - standing/persona scene;
- `note.glb` - sitting scene с встроенной sitting pose;
- `table.glb` - desk/table scene.

Pose-конфиги лежат в:

```text
src/casePoses.js
```

Проверка pose-конфигов:

```bash
npm run check:pose
```

Если заменить GLB-модель или skeleton, нужно проверить bone names и transform values, иначе персонаж может отображаться некорректно.

## Тестирование

Frontend checks:

```bash
npm run check
```

Backend tests:

```bash
npm run backend:test
```

Backend test flow проверяет полный MVP loop:

```text
admin creates material
    -> admin generates scenario
    -> admin creates assignment
    -> employee sees assignment
    -> employee sends simulation message
    -> backend evaluates attempt
    -> admin dashboard receives completion/score
```

## Что важно для проверяющих

- Это не статичная landing page, а работающий прототип продукта.
- Есть frontend, backend, data layer, AI layer, тесты и SQL-схема.
- Можно показать два рынка: индивидуальный тренажер навыков и корпоративное обучение сотрудников.
- Демо не зависит полностью от внешнего AI: без ключей есть deterministic fallback.
- Архитектура расширяемая: repository abstraction позволяет заменить Supabase или запускать тесты без реальной базы.
- 3D-сцена связана с live simulation: backend возвращает emotion/motion, frontend меняет поведение персонажа.

## Roadmap

Ближайшие улучшения:

- добавить полноценную запись голосового ввода;
- подключить TTS/STT для voice-first тренировки;
- расширить Supabase migrations и seed data;
- добавить роли и permissions на уровне RLS;
- сделать больше готовых industry packs;
- добавить экспорт результатов для HR/admin;
- улучшить scoring rubric и объяснимость оценки;
- добавить deployment config.

Дополнительные заметки лежат в:

- `docs/backend-instructions.md`
- `docs/backend-roadmap.md`
- `docs/run-backend.md`
