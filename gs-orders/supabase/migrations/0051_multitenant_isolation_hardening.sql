-- =========================================================================
-- THÖREN — Fase 7A: Aislamiento multi-tenant real
-- =========================================================================
-- Cierra los 4 puntos donde la autoridad/datos seguían siendo GLOBALES
-- (auditoría Fase 7): user_profiles, salespeople, product_types, y las
-- policies de storage de order-media/order-files que dependían de
-- current_user_is_admin() sin ningún filtro de organización. Objetivo
-- único: Organization B no puede ver ni modificar datos de Organization A
-- por ninguno de estos 4 caminos. NO se reabre ninguna auditoría de 6R
-- (permisos admin/vendedor/capabilities dentro de una misma organización
-- quedan exactamente igual).
--
-- =========================================================================
-- DECISIÓN — user_profiles: NO se agrega organization_id propio
-- =========================================================================
-- Se deriva de organization_members (ya la fuente de verdad de membership,
-- 0013) vía un helper nuevo, en vez de duplicar una columna que tendría que
-- mantenerse sincronizada a mano. organization_members ya es 1:1 fiable
-- para cualquier usuario dado de alta por el flujo real (insertProfileAndM
-- embershipOrCompensate siempre crea ambas filas o revierte todo vía
-- compensación de Auth) — no hay una FK nullable de por medio que pudiera
-- dejar la derivación ambigua, a diferencia de salespeople (ver abajo).
--
-- =========================================================================
-- DECISIÓN — salespeople y product_types: SÍ se agrega organization_id
-- propio (columna nueva, no derivada)
-- =========================================================================
-- Para salespeople existe una ruta indirecta (person_id -> people.
-- organization_id, ya usada por fn_salesperson_organization_id en 0022),
-- pero person_id es NULLABLE (0016) — un salesperson sin Person vinculada
-- quedaría con organización irresolvable (ni excepción clara ni fila
-- visible, simplemente inaccesible en silencio). salespeople y
-- product_types son, además, exactamente el tipo de tabla que YA tiene su
-- propia columna organization_id en el resto del proyecto (business_units,
-- customers, suppliers, product_catalog, quotes, orders, warehouses,
-- deliveries) — seguir ese mismo patrón es más consistente y más robusto
-- que introducir la única excepción de derivación-vía-FK-nullable.
--
-- =========================================================================
-- DECISIÓN — organization_id con DEFAULT current_user_organization_id(),
-- nunca provisto por el cliente
-- =========================================================================
-- Ni vendedores/actions.ts ni configuracion/tipos-producto/actions.ts
-- necesitan cambiar: ninguno de los dos envía organization_id hoy, así que
-- el DEFAULT lo resuelve automáticamente desde la sesión real del que
-- inserta — mismo criterio de "organization_id SIEMPRE server-side" ya
-- usado en rpc_create_order (0022), solo que aquí se expresa como DEFAULT
-- de columna porque no hay un RPC de por medio (INSERT directo vía
-- PostgREST). Si un cliente malicioso mandara un organization_id explícito
-- de todos modos, el WITH CHECK de is_organization_admin(organization_id)
-- en la policy de INSERT lo rechaza igual — el DEFAULT es conveniencia,
-- nunca la barrera de seguridad real.
--
-- =========================================================================
-- DECISIÓN — product_types.code sigue siendo ÚNICO GLOBAL (fuera de
-- alcance de 7A, documentado como riesgo conocido)
-- =========================================================================
-- orders.product_type referencia product_types.code (texto, FK agregada en
-- 0019) — volverlo único-por-organización requeriría una FK compuesta
-- (product_type, organization_id) y tocar rpc_create_order/rpc_update_order
-- (6 migraciones distintas los redefinen históricamente). Fuera del
-- alcance explícito de 7A ("no ampliar scope", sección 4 solo pide
-- visibilidad/autoridad org-scoped, no unicidad de code). Efecto práctico:
-- Organization B no podrá crear un tipo de producto con un code ya usado
-- por otra organización (colisión de UNIQUE, error de aplicación claro,
-- nunca fuga de datos) — documentado en el reporte final como riesgo real.
--
-- =========================================================================
-- DECISIÓN — storage order-media/order-files: se corrige TAMBIÉN el branch
-- de current_user_has_capability('can_manage_deliveries') (0050)
-- =========================================================================
-- No solo current_user_is_admin() era global: current_user_has_capability()
-- resuelve la organización DEL QUE LLAMA, nunca la del pedido objetivo —
-- así que un titular de can_manage_deliveries en Org B podía gestionar
-- archivos de un pedido de Org A con solo conocer su UUID. El fix real es
-- estructural: exigir SIEMPRE is_organization_member(orden.organization_id)
-- como condición previa, y solo después evaluar la autoridad de negocio
-- (admin/dueño/capability) — ver current_user_can_manage_order_storage()
-- abajo.
-- =========================================================================

begin;

-- =========================================================================
-- 1) SALESPEOPLE — organization_id + prefix único por organización
-- =========================================================================
alter table salespeople
  add column if not exists organization_id uuid references organizations (id) on delete restrict;

do $$
declare
  v_legacy_count integer;
  v_org_count integer;
  v_org_id uuid;
begin
  select count(*) into v_legacy_count from salespeople where organization_id is null;

  if v_legacy_count > 0 then
    select count(*) into v_org_count from organizations;

    if v_org_count <> 1 then
      raise exception
        '0051: % vendedor(es) requieren backfill de organization_id, pero existen % organizaciones (se esperaba exactamente 1). Backfill abortado — requiere resolución manual antes de continuar.',
        v_legacy_count, v_org_count;
    end if;

    select id into v_org_id from organizations;

    update salespeople set organization_id = v_org_id where organization_id is null;

    if exists (select 1 from salespeople where organization_id is null) then
      raise exception '0051: quedaron vendedores con organization_id NULL después del backfill. Abortado.';
    end if;
  end if;
end $$;

alter table salespeople alter column organization_id set default current_user_organization_id();
alter table salespeople alter column organization_id set not null;

create index if not exists salespeople_organization_idx on salespeople (organization_id);

-- El prefijo deja de ser único GLOBALMENTE por business_unit: pasa a ser
-- único por (organization_id, business_unit, prefix) — Org A y Org B ya
-- pueden usar el mismo prefijo sin chocar. Ningún dato existente cambia
-- (Global Supplier conserva exactamente las mismas combinaciones que ya
-- tenía, ahora con su organization_id real agregado a la tupla).
drop index if exists salespeople_prefix_unique_per_unit;
create unique index if not exists salespeople_prefix_unique_per_org_unit
  on salespeople (organization_id, business_unit, upper(prefix));

-- RLS: current_user_is_admin() (global) -> is_organization_admin(organization_id)
-- (de la ORGANIZACIÓN DEL VENDEDOR, 0013). "Propio vendedor" (id =
-- current_user_salesperson_id()) no necesita chequeo de organización aparte:
-- un vendedor siempre pertenece a una única organización por construcción.
drop policy if exists "salespeople_select_own_or_admin" on salespeople;
create policy "salespeople_select_own_or_admin" on salespeople
  for select using (
    current_user_active() and (is_organization_admin(organization_id) or id = current_user_salesperson_id())
  );

drop policy if exists "salespeople_admin_insert" on salespeople;
create policy "salespeople_admin_insert" on salespeople
  for insert with check (is_organization_admin(organization_id));

drop policy if exists "salespeople_update_own_or_admin" on salespeople;
create policy "salespeople_update_own_or_admin" on salespeople
  for update using (
    current_user_active() and (is_organization_admin(organization_id) or id = current_user_salesperson_id())
  ) with check (
    current_user_active() and (is_organization_admin(organization_id) or id = current_user_salesperson_id())
  );

-- trg_prevent_vendor_salesperson_edit (0011) NO se toca: para llegar a
-- ejecutarse sobre una fila ya se pasó la policy de UPDATE de arriba, que
-- ahora exige is_organization_admin(ESA fila.organization_id) — así que
-- "current_user_is_admin()" dentro del trigger, en este punto, ya equivale
-- a "admin de la organización de este vendedor". Cambiarlo no cierra
-- ningún gap adicional y solo agrega riesgo a una pieza ya probada.

-- 0046 (can_manage_users) — salespeople_select_user_manager no tenía forma
-- de acotar por organización porque salespeople no tenía la columna
-- todavía; ahora sí. Companion fix necesario para no dejar un hueco nuevo
-- (un can_manage_users de Org B podía ver salespeople de cualquier org).
drop policy if exists "salespeople_select_user_manager" on salespeople;
create policy "salespeople_select_user_manager" on salespeople
  for select using (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and organization_id = current_user_organization_id()
  );

-- fn_next_order_folio/trg_set_order_folio/trg_prevent_folio_change (0002):
-- CERO cambios de código. Corren SECURITY INVOKER, así que su
-- `select ... from salespeople where id = p_salesperson_id for update`
-- ya queda sujeto a la nueva RLS de arriba automáticamente — un
-- salesperson_id de otra organización simplemente no es visible ("Vendedor
-- no encontrado", la misma excepción que ya existía). El folio en sí (su
-- formato, su independencia por vendedor) no se rediseña.
--
-- orders_folio_unique (0001) SÍ necesita cambiar: era `unique(folio)`
-- GLOBAL — con prefix ahora reutilizable entre organizaciones (arriba),
-- Org A y Org B con el mismo prefix generando su primer pedido del mismo
-- día chocarían con el MISMO folio ("VU1-20260903-001" para ambas), y esa
-- collision es real, no hipotética (el index es unique de verdad). Mismo
-- patrón ya usado por purchase_orders_folio_unique (0035:
-- `unique(organization_id, folio)`) — orders.organization_id ya existe y
-- es inmutable desde 0022, así que este cambio es un ajuste de índice, no
-- un rediseño del sistema de folios (formato/secuencia/prefix intactos).
drop index if exists orders_folio_unique;
create unique index if not exists orders_folio_unique on orders (organization_id, folio);

-- =========================================================================
-- 2) PRODUCT_TYPES — organization_id, mismo patrón que product_catalog (0019)
-- =========================================================================
alter table product_types
  add column if not exists organization_id uuid references organizations (id) on delete restrict;

do $$
declare
  v_legacy_count integer;
  v_org_count integer;
  v_org_id uuid;
begin
  select count(*) into v_legacy_count from product_types where organization_id is null;

  if v_legacy_count > 0 then
    select count(*) into v_org_count from organizations;

    if v_org_count <> 1 then
      raise exception
        '0051: % tipo(s) de producto requieren backfill de organization_id, pero existen % organizaciones (se esperaba exactamente 1). Backfill abortado — requiere resolución manual antes de continuar.',
        v_legacy_count, v_org_count;
    end if;

    select id into v_org_id from organizations;

    update product_types set organization_id = v_org_id where organization_id is null;

    if exists (select 1 from product_types where organization_id is null) then
      raise exception '0051: quedaron tipos de producto con organization_id NULL después del backfill. Abortado.';
    end if;
  end if;
end $$;

alter table product_types alter column organization_id set default current_user_organization_id();
alter table product_types alter column organization_id set not null;

create index if not exists product_types_organization_idx on product_types (organization_id);

-- code sigue únique GLOBAL a propósito — ver DECISIÓN arriba (fuera de
-- alcance de 7A). Ninguna referencia (orders.product_type,
-- product_catalog.product_type_id) se ve afectada por agregar
-- organization_id: la primera sigue siendo code->code (sin cambios), la
-- segunda ya era id->id (uuid, siempre única, nunca dependió de code).
drop policy if exists "product_types_select" on product_types;
create policy "product_types_select" on product_types
  for select using (
    is_organization_admin(organization_id)
    or (is_organization_member(organization_id) and active = true)
  );

drop policy if exists "product_types_admin_write" on product_types;
create policy "product_types_admin_write" on product_types
  for all using (is_organization_admin(organization_id)) with check (is_organization_admin(organization_id));

-- =========================================================================
-- 3) USER_PROFILES — autoridad de admin pleno pasa a ser org-aware
-- =========================================================================
-- current_user_is_admin_of_user(p_target_user_id): ¿el usuario que llama es
-- admin ACTIVO de alguna organización a la que pertenece p_target_user_id?
-- Deliberadamente SIN filtro de active=true sobre la membership del
-- TARGET (mismo criterio que user_belongs_to_organization, 0046): así no
-- se autobloquea admin_update_user_role_and_active() cuando el propio
-- UPDATE que se está autorizando es el que desactiva al target.
create or replace function current_user_is_admin_of_user(p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members om
    where om.user_id = p_target_user_id
      and is_organization_admin(om.organization_id)
  );
$$;

-- Guardarraíl (fail loud, no adivinar): si algún user_profiles histórico no
-- tiene NINGUNA membership en organization_members, la nueva policy de
-- SELECT/UPDATE/DELETE lo dejaría invisible en silencio para cualquier
-- admin — 0013 ya garantizó (bootstrap) que todo user_profiles existente
-- tiene su membership, esto solo lo reconfirma antes de activar las
-- policies restrictivas.
do $$
declare
  v_orphan_count integer;
begin
  select count(*) into v_orphan_count
  from user_profiles up
  where not exists (select 1 from organization_members om where om.user_id = up.user_id);

  if v_orphan_count > 0 then
    raise exception
      '0051: % usuario(s) en user_profiles no tienen ninguna fila en organization_members — no se puede resolver su organización sin adivinar. Abortado.',
      v_orphan_count;
  end if;
end $$;

drop policy if exists "user_profiles_select_own_or_admin" on user_profiles;
create policy "user_profiles_select_own_or_admin" on user_profiles
  for select using (user_id = auth.uid() or current_user_is_admin_of_user(user_profiles.user_id));

-- La policy única "FOR ALL" (user_profiles_admin_write) se reemplaza por
-- tres policies explícitas (mismo criterio de separación ya usado en 0046
-- para can_manage_users).
--
-- AJUSTE (revisión post-implementación) — el INSERT NO se deja en
-- current_user_is_admin() (global, sin ningún concepto de organización):
-- se confirmó leyendo insertProfileAndMembershipOrCompensate (user-
-- access.ts) que el INSERT real de producción corre con
-- createSupabaseServerClient() (cliente authenticated normal, sujeto a
-- RLS) — nunca con el service role, así que esta policy SÍ se ejecuta de
-- verdad en producción y debía quedar org-aware. Se usa
-- is_organization_admin(current_user_organization_id()): exige que quien
-- inserta sea admin ACTIVO en organization_members de su propia
-- organización (no solo que user_profiles.role='admin', un flag sin
-- ninguna relación con organization_members). Sigue sin poder exigir la
-- organización del TARGET —en el flujo real user_profiles se inserta
-- ANTES que organization_members para un usuario de Auth recién creado, no
-- existe membership del target que consultar todavía—, pero eso no es un
-- gap nuevo: el límite de organización para el alta ya lo cierra la propia
-- policy de organization_members (0013, is_organization_admin
-- (organization_id) desde el día uno) inmediatamente después, y user_id
-- como PK impide "secuestrar" un usuario ya existente de otra
-- organización (solo puede crear la fila para un usuario de Auth sin
-- perfil previo). Mismo patrón que 0046 ya usa para
-- user_profiles_insert_user_manager (current_user_has_capability, que
-- también resuelve la organización del que llama, nunca la del target).
drop policy if exists "user_profiles_admin_write" on user_profiles;
drop policy if exists "user_profiles_admin_insert" on user_profiles;
drop policy if exists "user_profiles_admin_update" on user_profiles;
drop policy if exists "user_profiles_admin_delete" on user_profiles;

create policy "user_profiles_admin_insert" on user_profiles
  for insert with check (is_organization_admin(current_user_organization_id()));

create policy "user_profiles_admin_update" on user_profiles
  for update using (current_user_is_admin_of_user(user_profiles.user_id))
  with check (current_user_is_admin_of_user(user_profiles.user_id));

create policy "user_profiles_admin_delete" on user_profiles
  for delete using (current_user_is_admin_of_user(user_profiles.user_id));

-- admin_list_user_profiles() (0046) ya filtra por organización — sin
-- cambios. admin_update_user_role_and_active() (0013) ya resuelve/valida
-- la organización del actor ANTES de tocar user_profiles (actualiza
-- organization_members primero, scoped a v_organization_id =
-- current_user_organization_id()) — con las policies nuevas de arriba
-- sigue funcionando exactamente igual para el caso mismo-organización, y
-- ahora además queda protegido si alguna vez se llamara para un target de
-- otra organización (antes solo lo bloqueaba la propia query de
-- organization_members; ahora también user_profiles lo rechaza en
-- redundancia, defensa en profundidad).

-- =========================================================================
-- 4) STORAGE order-media / order-files — org-scoping real
-- =========================================================================
-- Lectura: reemplaza el chequeo inline de 0011 (current_user_is_admin()
-- global + "propio pedido") por un helper que exige, ANTES que cualquier
-- otra cosa, que el pedido pertenezca a una organización de la que el
-- usuario es miembro.
create or replace function current_user_can_view_order_storage(p_order_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from orders o
    where o.id::text = p_order_id
      and is_organization_member(o.organization_id)
      and (is_organization_admin(o.organization_id) or o.salesperson_id = current_user_salesperson_id())
  );
$$;

drop policy if exists "order_media_select_scoped" on storage.objects;
create policy "order_media_select_scoped" on storage.objects
  for select using (
    bucket_id = 'order-media' and auth.role() = 'authenticated' and current_user_active() and (
      current_user_can_view_order_storage((storage.foldername(objects.name))[1])
      or exists (
        select 1 from product_catalog pc
        where pc.id::text = (storage.foldername(objects.name))[1]
          and is_organization_member(pc.organization_id)
      )
    )
  );

drop policy if exists "order_files_select_scoped" on storage.objects;
create policy "order_files_select_scoped" on storage.objects
  for select using (
    bucket_id = 'order-files' and auth.role() = 'authenticated' and current_user_active()
      and current_user_can_view_order_storage((storage.foldername(objects.name))[1])
  );

-- Escritura (UPDATE/DELETE, 0050): current_user_can_manage_order_storage()
-- se redefine con el mismo `create or replace function` — las 4 policies
-- de 0050 (order_media_update/delete_scoped, order_files_update/
-- delete_scoped) la invocan por nombre, así que heredan el fix sin tocar
-- una sola policy. Ver DECISIÓN arriba: el branch de can_manage_deliveries
-- también queda condicionado a is_organization_member(o.organization_id) —
-- antes NO lo estaba, ese era el segundo gap real de este bucket.
create or replace function current_user_can_manage_order_storage(p_order_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from orders o
    where o.id::text = p_order_id
      and is_organization_member(o.organization_id)
      and (
        is_organization_admin(o.organization_id)
        or o.salesperson_id = current_user_salesperson_id()
        or current_user_has_capability('can_manage_deliveries')
      )
  );
$$;

-- INSERT de order-media (0050): rutas de PEDIDO siguen abiertas a
-- cualquier autenticado activo, sin cambio (el pedido no existe todavía en
-- el instante del upload — mismo residual ya documentado y aceptado desde
-- 0011, sin agravarse en multi-tenant: nunca se puede LEER de vuelta un
-- archivo subido a ciegas a la carpeta de un pedido ajeno, por la policy
-- de SELECT de arriba). Solo el branch de CATÁLOGO deja de usar
-- current_user_is_admin() global y pasa a exigir admin de la organización
-- REAL del producto.
drop policy if exists "order_media_write_scoped" on storage.objects;
create policy "order_media_write_scoped" on storage.objects
  for insert with check (
    bucket_id = 'order-media' and auth.role() = 'authenticated' and current_user_active() and (
      exists (
        select 1 from product_catalog pc
        where pc.id::text = (storage.foldername(objects.name))[1]
          and is_organization_admin(pc.organization_id)
      )
      or not exists (
        select 1 from product_catalog pc where pc.id::text = (storage.foldername(objects.name))[1]
      )
    )
  );

-- order-files INSERT (0011, "order_files_write_authenticated"): sin
-- cambio — nunca tuvo rama de catálogo y el pedido tampoco existe todavía
-- en el instante del upload (mismo residual aceptado, ver arriba).

commit;
