# Run Backend Locally

## 1. Install Python Dependencies

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## 2. Create Backend Environment File

Copy the example file:

```powershell
Copy-Item .env.example .env
```

Fill `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-legacy-jwt-secret
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-oss-120b:free
OPENROUTER_APP_URL=http://localhost:5173
OPENROUTER_APP_NAME=Ed-Tech Training Loop
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
PORT=3001
```

Use the legacy `service_role` API key for `SUPABASE_SERVICE_ROLE_KEY`. Do not commit `.env`.
`OPENROUTER_BASE_URL` is the OpenRouter API root. `OPENROUTER_APP_URL` is only the optional frontend referer sent in OpenRouter headers; keep it as `http://localhost:5173` for local development and use your deployed frontend URL in production. If `OPENROUTER_API_KEY` is missing or OpenRouter is unavailable, onboarding AI falls back to the deterministic local summary.

## 3. Prepare Supabase

In Supabase SQL Editor, run:

1. `backend/supabase/schema.sql`
2. `backend/supabase/seed_demo_profiles.sql`

If Auth login fails, create the demo users in Supabase Dashboard -> Authentication -> Users, then update `public.profiles` with the real Auth UUIDs.

Demo users:

```text
admin@demo.com      Demo1234!
employee1@demo.com  Demo1234!
employee2@demo.com  Demo1234!
solo@demo.com       Demo1234!
```

## 4. Start FastAPI

From `backend/`:

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 3001
```

Health check:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

Expected:

```json
{"status":"ok"}
```

## 5. Run Tests

From the repo root:

```powershell
python -m pytest backend\tests
```

## 6. Frontend Connection

Start the frontend separately from the repo root:

```powershell
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

Backend URL:

```text
http://localhost:3001
```
