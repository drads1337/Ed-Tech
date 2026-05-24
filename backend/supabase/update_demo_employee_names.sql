-- Run backend/supabase/schema.sql first.
-- This script updates the display names for the Demo Organization employees.
--
-- Demo Organization:
--   00000000-0000-0000-0000-000000000001 / Demo Organization
--
-- Edit the names below as needed, then rerun this script.

update public.profiles as p
set name = v.name
from (
  values
    ('dffgfghh@gmail.com', 'Madina Rustamova'),
    ('employee1@demo.com', 'Alina Karimova'),
    ('employee2@demo.com', 'Timur Saidov'),
    ('kftdr@gmail.com', 'Aziz Yuldashev'),
    ('dsdsdsds@gmail.com', 'Kamila Rakhimova'),
    ('sdsdsdsds@gmail.com', 'Dilshod Akramov'),
    ('sdsdsdss@mai.ru', 'Nigora Usmanova'),
    ('sasasasa@gmail.co', 'Sardor Tursunov')
) as v(email, name)
where p.email = v.email
  and p.organization_id = '00000000-0000-0000-0000-000000000001';

update auth.users as u
set raw_user_meta_data = jsonb_set(
  coalesce(u.raw_user_meta_data, '{}'::jsonb),
  '{name}',
  to_jsonb(v.name),
  true
)
from (
  values
    ('dffgfghh@gmail.com', 'Madina Rustamova'),
    ('employee1@demo.com', 'Alina Karimova'),
    ('employee2@demo.com', 'Timur Saidov'),
    ('kftdr@gmail.com', 'Aziz Yuldashev'),
    ('dsdsdsds@gmail.com', 'Kamila Rakhimova'),
    ('sdsdsdsds@gmail.com', 'Dilshod Akramov'),
    ('sdsdsdss@mai.ru', 'Nigora Usmanova'),
    ('sasasasa@gmail.co', 'Sardor Tursunov')
) as v(email, name)
where u.email = v.email;
