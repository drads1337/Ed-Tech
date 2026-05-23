# Backend MVP Roadmap

Scope starts at points 4 and 5 from `docs/backend-instructions.md`, then exposes enough API surface to support the demo loop later.

## Phase 1: AI Service Contract

- Add `generateScenario(material, goal, skills)`.
- Add `continueRoleplay(scenario, transcript, userMessage)`.
- Add `evaluateAttempt(scenario, transcript)`.
- Keep outputs deterministic and schema-stable for frontend work.
- Return the first-day scenario JSON contract:
  - `title`
  - `persona`
  - `openingMessage`
  - `evaluationSkills`
  - `rubric`

## Phase 2: Backend Demo Loop

- Add MVP models for demo users, organizations, materials, scenarios, assignments, and attempts.
- Persist them in a lightweight SQLite store for the demo backend.
- Add endpoints:
  - `POST /api/materials`
  - `POST /api/scenarios/generate`
  - `POST /api/assignments`
  - `GET /api/employee/dashboard`
  - `POST /api/simulation/message`
  - `POST /api/attempts/evaluate`
  - `GET /api/admin/dashboard`

## Phase 3: Real AI Adapter

- Add an OpenAI-compatible adapter behind the existing service functions.
- Keep deterministic behavior as the no-key fallback for local demos and tests.
- Keep function signatures and JSON contracts unchanged.
- Validate AI output with Pydantic before storing or returning it.
- Expose `GET /api/ai/status` so the frontend can show whether AI is live or deterministic.

## Phase 4: Persistence

- Evolve the current SQLite store into a production-ready persistence layer.
- Keep repository methods aligned to the current store API.
- Add migrations for the MVP models only.

## Phase 5: Auth Boundary

- Keep demo-user `userId` flow for the hackathon demo.
- Add real auth only after the end-to-end loop is reliable.
