-- =========================================================================
-- THÖREN — Fase 7B: Provisioning de organización + primer admin
-- =========================================================================
-- OBJETIVO: poder levantar una Organization B real sin SQL manual
-- improvisado. Una única función, restringida a service_role, que crea
-- organización + primer admin (user_profiles + organization_members) +
-- Business Unit inicial + Person del admin, todo en una sola transacción.
--
-- =========================================================================
-- DECISIÓN — autoridad: RPC restringida a service_role, no un endpoint
-- HTTP nuevo
-- =========================================================================
-- El proyecto no tiene (ni necesita todavía) un concepto de "platform
-- admin" distinto de "organization admin" — inventar uno sería la
-- arquitectura innecesaria que el enunciado pide evitar. `organizations`
-- ya es de solo lectura para cualquier rol autenticado (0013, sin policy
-- de insert/update/delete a propósito) — la única forma de escribir ahí
-- hoy es como dueño de las tablas o service_role. Esta función:
--   1) Es SECURITY DEFINER (corre con privilegios de su dueño, igual que
--      rpc_create_person_for_user necesita para completar el alta).
--   2) Se le revoca EXECUTE a public/authenticated/anon explícitamente —
--      Postgres otorga EXECUTE a PUBLIC por default en cualquier función
--      nueva, así que sin este REVOKE cualquier vendedor autenticado podría
--      crear su propia organización y auto-nombrarse admin. Se le otorga
--      EXECUTE únicamente a service_role.
-- Consecuencia práctica: solo quien tenga la service_role key (nunca
-- expuesta al cliente, nunca a un usuario de la app) puede invocarla — vía
-- el script scripts/provision-organization.mjs, ejecutado LOCALMENTE por
-- un operador humano con esas credenciales, igual criterio que
-- upload-cotizia-pdfs.mjs. Cero superficie HTTP nueva expuesta por la app.
--
-- =========================================================================
-- DECISIÓN — atomicidad: una función PL/pgSQL, no una RPC "de mejor
-- esfuerzo" con compensación manual de 4 tablas
-- =========================================================================
-- organizations/user_profiles/organization_members/business_units/people
-- viven en el mismo Postgres — una función PL/pgSQL corre dentro de la
-- transacción del caller: si CUALQUIER insert falla (slug duplicado,
-- user_id ya con perfil, etc.), Postgres revierte TODO lo que la función
-- ya había hecho, automáticamente, sin código de compensación manual para
-- esas 4 tablas. Lo único que NO puede compartir esta transacción es el
-- usuario de Auth (vive en un sistema aparte, GoTrue) — por eso se crea
-- ANTES de llamar a esta función (en el script) y, si esta función falla,
-- el script lo revierte con admin.auth.admin.deleteUser(), mismo patrón ya
-- probado en insertProfileAndMembershipOrCompensate (user-access.ts). Como
-- el usuario de Auth recién creado no tiene todavía perfil ni membership
-- en ese punto, revertirlo no deja ningún rastro huérfano.
--
-- =========================================================================
-- DECISIÓN — Business Unit inicial: nombre/code 100% parametrizados
-- =========================================================================
-- p_business_unit_name/p_business_unit_code nunca tienen un default
-- hardcodeado a "Thunder"/"Global Supplier"/"Juno" — el operador decide el
-- nombre real de la primera unidad de negocio de la organización nueva.
-- No se crea almacén ni configuración de folios de cotización: ninguno de
-- los dos es obligatorio para que el primer admin pueda operar (warehouses
-- se crea desde /almacenes cuando haga falta; salesperson_quote_sequences
-- es por-salesperson, y el primer admin no tiene uno).
--
-- =========================================================================
-- DECISIÓN — Person del admin: se reutiliza rpc_create_person_for_user
-- (0016/0042/0043) tal cual, sin duplicar su lógica
-- =========================================================================
-- Es SECURITY INVOKER, pero invocada desde dentro de una función SECURITY
-- DEFINER hereda el contexto de privilegios elevados de esta (verificado
-- contra Postgres real en las pruebas de 0052) — no necesita convertirse a
-- SECURITY DEFINER ni duplicar su INSERT. Mismo criterio de "un solo lugar
-- de verdad" ya usado en el resto del proyecto para esa función.

begin;

create or replace function rpc_provision_organization(
  p_organization_name text,
  p_organization_slug text,
  p_admin_user_id uuid,
  p_admin_name text,
  p_admin_email text,
  p_business_unit_name text,
  p_business_unit_code text
)
returns table (organization_id uuid, business_unit_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_bu_id uuid;
begin
  insert into organizations (name, slug)
  values (p_organization_name, p_organization_slug)
  returning id into v_org_id;

  -- INSERT simple (sin on conflict): si p_admin_user_id ya tiene un perfil,
  -- esto falla con unique_violation y Postgres revierte TODA la función
  -- (incluida la organización recién creada) — nunca queda un tenant a
  -- medias ni un admin reasignado por accidente.
  insert into user_profiles (user_id, name, role, active)
  values (p_admin_user_id, p_admin_name, 'admin', true);

  insert into organization_members (organization_id, user_id, role, active)
  values (v_org_id, p_admin_user_id, 'admin', true);

  insert into business_units (organization_id, name, code)
  values (v_org_id, p_business_unit_name, p_business_unit_code)
  returning id into v_bu_id;

  perform rpc_create_person_for_user(p_admin_user_id, v_org_id, p_admin_name, p_admin_email, true);

  return query select v_org_id, v_bu_id;
end;
$$;

-- Postgres otorga EXECUTE a PUBLIC por default en toda función nueva —
-- revocarlo explícitamente es lo que realmente cierra el acceso, no el
-- hecho de ser SECURITY DEFINER (eso solo decide CON QUÉ privilegios corre,
-- no QUIÉN puede invocarla).
revoke all on function rpc_provision_organization(text, text, uuid, text, text, text, text) from public;
revoke all on function rpc_provision_organization(text, text, uuid, text, text, text, text) from authenticated;
revoke all on function rpc_provision_organization(text, text, uuid, text, text, text, text) from anon;
grant execute on function rpc_provision_organization(text, text, uuid, text, text, text, text) to service_role;

commit;
