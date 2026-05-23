# Backend MVP Instructions

The backend team should not start with a full LMS. Start with one core product loop:

```text
material -> scenario -> assignment -> employee attempt -> score -> admin dashboard
```

MVP goal: show that training material can be turned into an AI scenario, an employee can complete a simulation, receive a score, and an admin can see the result.

## 1. Data Models

Minimum set of models:

### User

- `id`
- `name`
- `role`: `solo | admin | employee`
- `organizationId`
- `xp`
- `streak`

### Organization

- `id`
- `name`

### TrainingMaterial

- `id`
- `organizationId`
- `title`
- `type`
- `content`

### Scenario

- `id`
- `organizationId`
- `materialId`
- `title`
- `goal`
- `difficulty`
- `persona`
- `openingMessage`
- `evaluationSkills`
- `rubric`

### Assignment

- `id`
- `scenarioId`
- `employeeIds`
- `dueDate`
- `requiredScore`

### Attempt

- `id`
- `userId`
- `scenarioId`
- `transcript`
- `score`
- `skillScores`
- `feedback`

## 2. API For Demo Flow

The most important endpoints:

### `POST /api/materials`

Upload or paste training material text.

For the first version, a textarea input is enough:

```text
Paste sales script / SOP / FAQ
```

PDF upload is not needed yet.

### `POST /api/scenarios/generate`

AI takes the material and generates a training scenario.

### `POST /api/assignments`

Admin assigns a scenario to employees.

### `GET /api/employee/dashboard`

Employee sees assigned trainings.

### `POST /api/simulation/message`

Employee sends a response, and AI replies with the next roleplay message.

### `POST /api/attempts/evaluate`

AI evaluates the transcript and returns a score.

### `GET /api/admin/dashboard`

Admin sees scores, completion, and weak skills.

## 3. Auth For MVP

Do not build full authentication for the MVP.

Create demo users:

- `admin@demo.com`
- `employee1@demo.com`
- `employee2@demo.com`
- `solo@demo.com`

Frontend can simply send `userId` or `role`.

## 4. AI Services

Split AI logic into 3 functions:

### `generateScenario(material, goal, skills)`

Creates a scenario.

### `continueRoleplay(scenario, transcript, userMessage)`

Continues the conversation.

### `evaluateAttempt(scenario, transcript)`

Assigns a score and gives feedback.

## 5. First-Day JSON Contract

The most useful JSON that backend should return to frontend on day one:

```json
{
  "title": "Handling objections for new product launch",
  "persona": "Skeptical enterprise customer",
  "openingMessage": "I don't see why we need this product. We already have a solution.",
  "evaluationSkills": [
    "knowledge accuracy",
    "objection handling",
    "confidence",
    "structure",
    "policy adherence"
  ],
  "rubric": {
    "accuracy": "Did the employee use correct product facts?",
    "objectionHandling": "Did they handle resistance clearly?",
    "confidence": "Did they sound confident?"
  }
}
```

## Backend Priority

1. DB/schema or simple mock storage.
2. `POST /api/materials`
3. `POST /api/scenarios/generate`
4. `POST /api/simulation/message`
5. `POST /api/attempts/evaluate`
6. `GET /api/admin/dashboard`

Do not start with payments, a full LMS, or complex auth. The main goal is to make the demo cycle work end to end.
