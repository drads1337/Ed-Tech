# FastAPI Backend

FastAPI service for the MVP training loop:

```text
material -> scenario -> assignment -> employee attempt -> score -> admin dashboard
```

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 3001
```

Create the Supabase tables with `supabase/schema.sql`.

## Auth

Frontend logs in with Supabase Auth and sends:

```http
Authorization: Bearer <supabase_access_token>
```

The backend verifies the token through Supabase and loads the matching row from `profiles`.
