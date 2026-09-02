-- Stub de auth/storage + roles Postgres para correr las 21 migraciones
-- reales contra un Postgres local, sin Supabase. Mismo patrón usado en
-- todas las fases anteriores de este proyecto (Q4-Q7, CORE, etc).

create schema if not exists auth;
create schema if not exists storage;

-- email es character varying(255), NO text — así es auth.users en
-- Supabase Cloud real (GoTrue). THÖREN 6R.1B-4C encontró en producción
-- que admin_list_user_profiles() fallaba con "structure of query does not
-- match function result type" porque su RETURN TABLE declara `email
-- text` sin castear u.email — un mismatch de tipo invisible aquí mientras
-- este stub usaba `text` para email. Nunca volver a `text` sin cast
-- explícito en cualquier función nueva que seleccione auth.users.email.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email character varying(255)
);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('app.test_user_id', true), '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(nullif(current_setting('app.test_role', true), ''), 'authenticated');
$$;

create or replace function test_set_user(p_user_id uuid, p_role text default 'authenticated') returns void
language plpgsql
as $$
begin
  perform set_config('app.test_user_id', p_user_id::text, false);
  perform set_config('app.test_role', p_role, false);
end;
$$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid
);

alter table storage.objects enable row level security;

-- Stub de storage.foldername (real Supabase Storage): usado por RLS de
-- Storage en 0011/0024/0028 para scoping por carpeta (primer segmento del
-- path = id del recurso dueño). Implementación fiel: separa `name` por "/"
-- y devuelve todos los segmentos salvo el último (el nombre de archivo).
create or replace function storage.foldername(name text) returns text[]
language sql immutable
as $$
  select case
    when array_length(string_to_array(name, '/'), 1) <= 1 then array[]::text[]
    else (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
  end;
$$;

grant usage on schema auth, storage, public to authenticated, anon;
grant all on all tables in schema public to authenticated;
grant all on all tables in schema auth to authenticated;
grant all on all tables in schema storage to authenticated;
grant all on all sequences in schema public to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
