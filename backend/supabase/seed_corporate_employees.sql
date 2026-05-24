-- Run backend/supabase/schema.sql first.
-- This seeds corporate employee Supabase Auth users and matching app profiles.
--
-- Demo password for all users:
--   Demo1234!
--
-- Target organization:
--   7afd0b6b-f65a-4868-8577-dc40c1421593 / OOO Test
--
-- Rotate/delete these users before production use.

insert into public.organizations (id, name)
values ('7afd0b6b-f65a-4868-8577-dc40c1421593', 'OOO Test')
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
    '34210292-d473-4a43-a919-ebcbebbf630c',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'employee.alina@demo.com',
    crypt('Demo1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Alina Karimova"}'::jsonb,
    now(),
    now()
  ),
  (
    'f0767b21-49f6-45b5-9668-472fbda9af1a',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'employee.timur@demo.com',
    crypt('Demo1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Timur Saidov"}'::jsonb,
    now(),
    now()
  ),
  (
    'bf18ef07-1b91-431b-a87f-eb01c5c31e64',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'employee.madina@demo.com',
    crypt('Demo1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Madina Rustamova"}'::jsonb,
    now(),
    now()
  ),
  (
    'a8452b71-5114-42e9-8e5a-c07223f9fd90',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'employee.aziz@demo.com',
    crypt('Demo1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Aziz Yuldashev"}'::jsonb,
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
    '34210292-d473-4a43-a919-ebcbebbf630c',
    '34210292-d473-4a43-a919-ebcbebbf630c',
    '{"sub":"34210292-d473-4a43-a919-ebcbebbf630c","email":"employee.alina@demo.com"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'f0767b21-49f6-45b5-9668-472fbda9af1a',
    'f0767b21-49f6-45b5-9668-472fbda9af1a',
    '{"sub":"f0767b21-49f6-45b5-9668-472fbda9af1a","email":"employee.timur@demo.com"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'bf18ef07-1b91-431b-a87f-eb01c5c31e64',
    'bf18ef07-1b91-431b-a87f-eb01c5c31e64',
    '{"sub":"bf18ef07-1b91-431b-a87f-eb01c5c31e64","email":"employee.madina@demo.com"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'a8452b71-5114-42e9-8e5a-c07223f9fd90',
    'a8452b71-5114-42e9-8e5a-c07223f9fd90',
    '{"sub":"a8452b71-5114-42e9-8e5a-c07223f9fd90","email":"employee.aziz@demo.com"}'::jsonb,
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
    '34210292-d473-4a43-a919-ebcbebbf630c',
    '7afd0b6b-f65a-4868-8577-dc40c1421593',
    'employee.alina@demo.com',
    'Alina Karimova',
    'employee',
    0,
    0
  ),
  (
    'f0767b21-49f6-45b5-9668-472fbda9af1a',
    '7afd0b6b-f65a-4868-8577-dc40c1421593',
    'employee.timur@demo.com',
    'Timur Saidov',
    'employee',
    0,
    0
  ),
  (
    'bf18ef07-1b91-431b-a87f-eb01c5c31e64',
    '7afd0b6b-f65a-4868-8577-dc40c1421593',
    'employee.madina@demo.com',
    'Madina Rustamova',
    'employee',
    0,
    0
  ),
  (
    'a8452b71-5114-42e9-8e5a-c07223f9fd90',
    '7afd0b6b-f65a-4868-8577-dc40c1421593',
    'employee.aziz@demo.com',
    'Aziz Yuldashev',
    'employee',
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
