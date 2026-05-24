create table if not exists public.corporate_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  extracted_text text not null,
  status text not null default 'ready',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.corporate_knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_prompt text not null default '',
  company_brief text not null default '',
  rules_brief text not null default '',
  client_types text not null default '',
  task_goal text not null default '',
  scoring_rules text not null default '',
  enabled_settings jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.corporate_task_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_base_id uuid not null references public.corporate_knowledge_bases(id) on delete cascade,
  title text not null,
  client_type text not null default '',
  skill text not null default '',
  difficulty text not null default 'medium',
  status text not null default 'draft',
  generated_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.corporate_prizes (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  first_place text not null default '',
  second_place text not null default '',
  third_place text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists corporate_documents_organization_id_idx on public.corporate_documents(organization_id);
create index if not exists corporate_knowledge_bases_organization_id_idx on public.corporate_knowledge_bases(organization_id);
create index if not exists corporate_task_drafts_organization_id_idx on public.corporate_task_drafts(organization_id);
create index if not exists corporate_task_drafts_knowledge_base_id_idx on public.corporate_task_drafts(knowledge_base_id);
