-- GS Orders — Migración 0024: THÖREN Business Unit Branding / Logos
--
-- Convierte Unidades de Negocio en un módulo administrable: agrega
-- `business_units.logo_path`, la primera policy de escritura que existe
-- sobre esta tabla (hoy solo tiene SELECT — ver 0014_core_business_units.sql),
-- y el bucket privado + Storage policies para el archivo físico del logo.
-- Implementa exactamente el diseño aprobado en "THÖREN — BUSINESS UNIT
-- BRANDING / LOGOS" de esta misma sesión.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Agrega `business_units.logo_path` (nullable, text) — referencia al
--    archivo en Storage, nunca una URL absoluta ni base64/blob. Sin
--    `logo_updated_at`/`logo_alt_text`/metadata de branding: `updated_at`
--    ya existe y el trigger `trg_business_units_updated_at` (0014) ya se
--    dispara con cualquier UPDATE, y el `name` de la BU ya sirve como alt
--    text calculado en el cliente — agregar más columnas sería repetir el
--    sobre-diseño que 0014 ya rechazó una vez (ver su propio comentario
--    "Sin slug/prefix/branding/metadata...").
-- 2) Agrega `business_units_update_admin` — la PRIMERA policy de escritura
--    de esta tabla. Usa `is_organization_admin(organization_id)` (helper
--    de 0013, sin helper nuevo) — NUNCA `current_user_is_admin()`, que es
--    un flag global no-org-scoped y sería el criterio equivocado para una
--    tabla ya multi-tenant. Permite a un ADMIN de la organización de esa BU
--    actualizar cualquier columna editable (name/active/logo_path) — no
--    hay granularidad por columna a nivel de policy (Postgres RLS no la
--    da sin GRANT por columna, mecanismo que este proyecto no usa en
--    ningún lado); la inmutabilidad de organization_id/code se protege
--    aparte, con un trigger (punto 3), porque RLS por sí sola no puede
--    expresar "esta columna no puede cambiar durante un UPDATE" — USING
--    se evalúa contra la fila vieja y WITH CHECK contra la fila nueva,
--    pero ninguna de las dos compara vieja-contra-nueva.
-- 3) Trigger nuevo y AISLADO `trg_business_units_prevent_org_code_change`
--    (mismo patrón que `trg_orders_prevent_organization_change` de 0022):
--    bloquea cualquier UPDATE que intente cambiar `organization_id` o
--    `code`, sin importar quién lo intente ni por qué camino (RLS ya lo
--    exige admin de la organización, pero el trigger es la garantía real
--    de inmutabilidad — RLS decide QUIÉN puede tocar la fila, el trigger
--    decide QUÉ columnas nunca pueden cambiar). No se toca ningún trigger
--    existente de `business_units`.
-- 4) Bucket `business-unit-assets` — PRIVADO (`public = false`), igual que
--    los 2 buckets existentes (`order-media`/`order-files`, 0003) — cero
--    excepciones nuevas al patrón "sin buckets públicos" del proyecto.
--    Path determinístico `{organization_id}/{business_unit_id}/logo.{ext}`
--    (a diferencia de `order-media`, que usa nombre aleatorio porque puede
--    haber muchos archivos por carpeta — acá hay como máximo un logo por
--    BU, así que el nombre fijo permite reemplazar con `upsert: true` sin
--    acumular basura).
-- 5) 4 policies nuevas sobre `storage.objects` para este bucket — MÁS
--    ESTRICTAS que las de `order-media`/`order-files` (0011), que aceptan
--    "cualquier autenticado activo" en INSERT/UPDATE/DELETE porque el id
--    de un Order se genera client-side antes de existir la fila (no hay
--    nada contra qué validar en ese momento). Acá SÍ hay una fila real de
--    `business_units` antes de que exista el logo, así que cada policy
--    valida ownership completo: el segundo segmento del path debe ser el
--    id de una Business Unit real, Y el primer segmento debe coincidir
--    exactamente con el organization_id real de esa BU (defensa en
--    profundidad explícita, no solo "algún id de BU válido en algún
--    lado") — lectura para cualquier miembro de esa organización,
--    escritura (insert/update/delete) solo para su admin.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO toca `quotes`, `quote_items`, `orders`, `order_items`, ni ningún PDF
--   — el FK `business_unit_id` ya existe en ambas tablas desde 0020/0022;
--   la propagación del logo a Quote/Order/PDF queda para una fase futura,
--   sin necesitar ningún cambio de esquema adicional cuando llegue.
-- - NO toca `organizations` (datos fiscales del emisor quedan fuera,
--   documentado en el discovery de esta sesión).
-- - NO corrige el header hardcodeado del Order PDF
--   ("Thunder Safety Solutions / Thunder LED Lights",
--   (print)/pedidos/[id]/pdf/page.tsx) — deuda preexistente, documentada,
--   fuera de alcance explícito de esta migración.
-- - NO agrega colores, branding metadata, ni ningún campo fiscal.
-- - NO toca folios, GOBO, Product Types, Inventory, Purchasing.
-- - NO modifica ninguna policy existente de `order-media`/`order-files`.
--
-- Como el resto del proyecto: idempotente (add column if not exists,
-- create or replace para funciones, drop/create policy) y corre completa
-- en una sola transacción (begin/commit).

begin;

-- =========================================================================
-- 1) business_units.logo_path
-- =========================================================================
alter table business_units
  add column if not exists logo_path text;

-- =========================================================================
-- 2) RLS — primera policy de escritura sobre business_units.
-- =========================================================================
drop policy if exists "business_units_update_admin" on business_units;
create policy "business_units_update_admin" on business_units
  for update using (is_organization_admin(organization_id))
  with check (is_organization_admin(organization_id));

-- =========================================================================
-- 3) organization_id / code inmutables — trigger nuevo y aislado, NO se
--    toca trg_business_units_updated_at (0014), fuera de alcance explícito.
-- =========================================================================
create or replace function trg_prevent_business_unit_org_code_change()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'La organización de una Business Unit no se puede modificar';
  end if;
  if new.code is distinct from old.code then
    raise exception 'El código de una Business Unit no se puede modificar';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_business_units_prevent_org_code_change'
  ) then
    create trigger trg_business_units_prevent_org_code_change
      before update on business_units
      for each row execute function trg_prevent_business_unit_org_code_change();
  end if;
end $$;

-- =========================================================================
-- 4) Bucket privado business-unit-assets.
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('business-unit-assets', 'business-unit-assets', false)
on conflict (id) do nothing;

-- =========================================================================
-- 5) Storage policies — ownership completo verificado en cada operación
--    (a diferencia de order-media/order-files, acá la BU ya existe antes
--    del upload, así que sí se puede validar por completo). Estructura del
--    path: {organization_id}/{business_unit_id}/logo.{ext} — [1]=org,
--    [2]=business_unit_id.
-- =========================================================================
drop policy if exists "business_unit_assets_select_member" on storage.objects;
create policy "business_unit_assets_select_member" on storage.objects
  for select using (
    bucket_id = 'business-unit-assets' and auth.role() = 'authenticated' and current_user_active()
    and exists (
      select 1 from business_units bu
      where bu.id::text = (storage.foldername(objects.name))[2]
        and bu.organization_id::text = (storage.foldername(objects.name))[1]
        and is_organization_member(bu.organization_id)
    )
  );

drop policy if exists "business_unit_assets_insert_admin" on storage.objects;
create policy "business_unit_assets_insert_admin" on storage.objects
  for insert with check (
    bucket_id = 'business-unit-assets' and auth.role() = 'authenticated' and current_user_active()
    and exists (
      select 1 from business_units bu
      where bu.id::text = (storage.foldername(objects.name))[2]
        and bu.organization_id::text = (storage.foldername(objects.name))[1]
        and is_organization_admin(bu.organization_id)
    )
  );

drop policy if exists "business_unit_assets_update_admin" on storage.objects;
create policy "business_unit_assets_update_admin" on storage.objects
  for update using (
    bucket_id = 'business-unit-assets' and auth.role() = 'authenticated' and current_user_active()
    and exists (
      select 1 from business_units bu
      where bu.id::text = (storage.foldername(objects.name))[2]
        and bu.organization_id::text = (storage.foldername(objects.name))[1]
        and is_organization_admin(bu.organization_id)
    )
  );

drop policy if exists "business_unit_assets_delete_admin" on storage.objects;
create policy "business_unit_assets_delete_admin" on storage.objects
  for delete using (
    bucket_id = 'business-unit-assets' and auth.role() = 'authenticated' and current_user_active()
    and exists (
      select 1 from business_units bu
      where bu.id::text = (storage.foldername(objects.name))[2]
        and bu.organization_id::text = (storage.foldername(objects.name))[1]
        and is_organization_admin(bu.organization_id)
    )
  );

commit;
