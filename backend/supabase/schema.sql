create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null check (role in ('solo', 'admin', 'employee')),
  xp integer not null default 0,
  streak integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.training_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  type text not null default 'text',
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  material_id uuid not null references public.training_materials(id) on delete cascade,
  title text not null,
  goal text not null,
  difficulty text not null,
  persona text not null,
  opening_message text not null,
  evaluation_skills jsonb not null default '[]'::jsonb,
  rubric jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  due_date date,
  required_score integer not null default 80,
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_employees (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (assignment_id, employee_id)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  transcript jsonb not null default '[]'::jsonb,
  score integer not null,
  skill_scores jsonb not null default '{}'::jsonb,
  feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_organization_id_idx on public.profiles(organization_id);
create index if not exists training_materials_organization_id_idx on public.training_materials(organization_id);
create index if not exists scenarios_organization_id_idx on public.scenarios(organization_id);
create index if not exists assignments_organization_id_idx on public.assignments(organization_id);
create index if not exists assignment_employees_employee_id_idx on public.assignment_employees(employee_id);
create index if not exists attempts_user_id_idx on public.attempts(user_id);
create index if not exists attempts_scenario_id_idx on public.attempts(scenario_id);
