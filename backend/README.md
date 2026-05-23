# FastAPI Backend

FastAPI service for the MVP training loop:

```text
material -> scenario -> assignment -> employee attempt -> score -> admin dashboard
```

## Setup

```bash
cd backend
python3.12 -m venv ../.venv
../.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
../.venv/bin/python -m uvicorn app.main:app --reload --port 3001
```

From the project root you can also run:

```bash
npm run backend:dev
```

Create the Supabase tables with `supabase/schema.sql`.

## Auth

Frontend logs in with Supabase Auth and sends:

```http
Authorization: Bearer <supabase_access_token>
```

The backend verifies the token through Supabase and loads the matching row from `profiles`.
