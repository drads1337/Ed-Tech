-- Run backend/supabase/schema.sql first.
-- This seeds demo Supabase Auth users and matching app profiles.
--
-- Demo password for all users:
--   Demo1234!
--
-- Rotate/delete these users before production use.

insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Demo Organization')
on conflict (id) do update set name = excluded.name;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@demo.com',
    crypt('Demo1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Demo Admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'employee1@demo.com',
    crypt('Demo1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Employee One"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'employee2@demo.com',
    crypt('Demo1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Employee Two"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'solo@demo.com',
    crypt('Demo1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Solo Learner"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000010',
    '{"sub":"00000000-0000-0000-0000-000000000010","email":"admin@demo.com"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000011',
    '{"sub":"00000000-0000-0000-0000-000000000011","email":"employee1@demo.com"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000012',
    '{"sub":"00000000-0000-0000-0000-000000000012","email":"employee2@demo.com"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000013',
    '{"sub":"00000000-0000-0000-0000-000000000013","email":"solo@demo.com"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  )
on conflict (provider, provider_id) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (id, organization_id, email, name, role, xp, streak)
values
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'admin@demo.com',
    'Demo Admin',
    'admin',
    0,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'employee1@demo.com',
    'Employee One',
    'employee',
    0,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'employee2@demo.com',
    'Employee Two',
    'employee',
    0,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    'solo@demo.com',
    'Solo Learner',
    'solo',
    0,
    0
  )
on conflict (id) do update set
  organization_id = excluded.organization_id,
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  xp = excluded.xp,
  streak = excluded.streak;
