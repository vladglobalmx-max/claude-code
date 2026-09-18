-- THÖREN — Comisiones: vista propia de solo lectura para VENDEDOR (0083).
--
-- =========================================================================
-- CONTEXTO — reversión PARCIAL y explícita de una decisión de 0073
-- =========================================================================
-- 0073 (Comisiones privadas de Dirección MVP) diseñó `commission_records`/
-- `commission_events` como EXCLUSIVAMENTE visibles para
-- `can_manage_commissions`, sin ninguna rama de dueño-vendedor — decisión
-- deliberada, documentada extensamente en esa migración, y pedida
-- literalmente por el ticket original ("vendedores NO deben poder
-- consultar montos, porcentajes, margen ni pagos de comisión").
--
-- Este ticket pide relajar ESO, pero solo parcialmente: un vendedor con
-- una capability NUEVA (`can_view_own_commissions`, distinta de
-- `can_manage_commissions`) puede ahora consultar EN SOLO LECTURA
-- únicamente sus propias comisiones — nunca las de otro vendedor, nunca
-- calcular/liberar/modificar/pagar. `can_manage_commissions` no cambia en
-- absoluto: mismo alcance, misma exclusividad, mismas policies de
-- SELECT/INSERT/UPDATE de 0073, sin ninguna rama nueva.
--
-- =========================================================================
-- DECISIÓN — SIN SELECT directo sobre commission_records (ajuste post-
-- review, reemplaza el primer diseño de esta migración)
-- =========================================================================
-- `commission_records_select` NO SE TOCA — se queda EXACTAMENTE como 0073
-- la dejó (esta migración no la vuelve a declarar en absoluto): solo
-- `current_user_has_commission_authority()`, sin ninguna rama de dueño.
-- Un vendedor con `can_view_own_commissions` sigue obteniendo 0 filas ante
-- cualquier `select` directo (vía PostgREST/Supabase client) sobre
-- `commission_records` — exactamente igual que un vendedor sin la
-- capability. La única vía de lectura para "vista propia" son dos RPCs
-- SECURITY DEFINER nuevos (sección 3), que:
--   (a) resuelven usuario/organización/vendedor INTERNAMENTE
--       (auth.uid()/current_user_organization_id()/
--       current_user_salesperson_id() — nunca aceptan esos valores como
--       parámetro del cliente),
--   (b) exigen `can_view_own_commissions` vía
--       `current_user_has_own_commission_view_authority()` (mismo patrón
--       SIN atajo de admin que `current_user_has_commission_authority()`,
--       0073),
--   (c) filtran SIEMPRE por `salesperson_id = current_user_salesperson_id()`
--       — un vendedor nunca puede pasar el id de otro vendedor, porque el
--       RPC ni siquiera lo acepta como parámetro,
--   (d) devuelven EXCLUSIVAMENTE las columnas aprobadas: id,
--       sales_order_id, folio de la Sales Order, cliente, monto de la
--       comisión, moneda de la Sales Order origen (ajuste post-review —
--       necesaria para formatear el monto correctamente, no es dato
--       financiero sensible), estatus, fecha de generación — nunca
--       commission_rate/commission_base/commission_rule_snapshot/
--       eligible_amount/paid_amount/cancelled_*/created_by/updated_at.
--
-- Esto es un blindaje real (a nivel de contrato de función, no solo de
-- columnas seleccionadas en la app): ni siquiera alguien golpeando la API
-- REST de Supabase directamente con el token del vendedor puede pedir
-- `commission_rate` de su propia comisión — esa columna simplemente no
-- existe en el `returns table` del RPC, y `commission_records` en sí
-- sigue sin ninguna policy de SELECT que lo permita.
--
-- =========================================================================
-- DECISIÓN — SECURITY DEFINER, no INVOKER
-- =========================================================================
-- A diferencia de los RPCs de escritura de 0073 (SECURITY INVOKER — la
-- autoridad real es 100% RLS ahí), estos RPCs de lectura SÍ necesitan
-- SECURITY DEFINER: deben leer `commission_records`/`sales_orders`/
-- `customers` más allá de lo que la RLS de esas tablas le permitiría al
-- vendedor de a pie (commission_records_select ya NO tiene rama de
-- dueño). Mismo patrón que `rpc_delete_purchase_order` (0082)/
-- `rpc_delete_salesperson` (0079): toda la autorización real vive DENTRO
-- del cuerpo de la función, verificada ANTES de cualquier lectura.
--
-- =========================================================================
-- DECISIÓN — solo se toca commission_records_insert/update? NO, ni eso.
-- =========================================================================
-- `commission_records_insert`/`commission_records_update` NO se tocan: se
-- quedan exclusivamente en `current_user_has_commission_authority()`, tal
-- cual 0073 las dejó. `commission_events` tampoco se toca en esta versión
-- (ni su policy de SELECT ni ningún RPC nuevo) — decisión explícita del
-- ticket: la pantalla de vendedor no necesita el historial de eventos.
--
-- Como el resto del proyecto: idempotente (on conflict do nothing, create
-- or replace function) y corre completa en una transacción (begin/commit).

begin;

-- =========================================================================
-- 1) capabilities — nueva capacidad, aditiva sobre el catálogo de 0040/0073.
-- =========================================================================
insert into capabilities (key, description) values
  ('can_view_own_commissions', 'Consultar en solo lectura las propias comisiones de venta (folio de Sales Order, cliente, monto, estatus, fecha) vía rpc_list_own_commissions/rpc_get_own_commission — sin SELECT directo sobre commission_records, sin autoridad de gestión y sin acceso a comisiones de otros vendedores. Distinta y separada de can_manage_commissions.')
on conflict (key) do nothing;

-- =========================================================================
-- 2) current_user_has_own_commission_view_authority() — mismo patrón EXACTO
--    que current_user_has_commission_authority() (0073), sin el atajo de
--    admin de current_user_has_capability(). SECURITY DEFINER: necesita
--    leer user_capabilities más allá de lo que la RLS de esa tabla le
--    permitiría al usuario de a pie.
-- =========================================================================
create or replace function current_user_has_own_commission_view_authority()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  if not current_user_active() then
    return false;
  end if;

  v_organization_id := current_user_organization_id();
  if v_organization_id is null then
    return false;
  end if;

  return exists (
    select 1 from user_capabilities uc
    where uc.user_id = auth.uid()
      and uc.organization_id = v_organization_id
      and uc.capability = 'can_view_own_commissions'
      and uc.active = true
  );
end;
$$;

-- =========================================================================
-- 3) rpc_list_own_commissions() / rpc_get_own_commission() — única vía de
--    lectura para la vista propia de vendedor. Sin parámetro de
--    salesperson_id/organization_id en ninguno de los dos: se resuelven
--    internamente, así que un vendedor no puede pedir los de otro aunque
--    conozca su id. Columnas devueltas: exactamente las aprobadas, ni una
--    más — ver DECISIÓN de cabecera. `currency` (ajuste post-review) viene
--    de sales_orders.currency de la Sales Order origen — necesaria para
--    formatear commission_amount con el símbolo/código correcto (MXN/USD),
--    no es un dato financiero sensible (no es tasa/base/margen/costo).
-- =========================================================================
create or replace function rpc_list_own_commissions()
returns table (
  id uuid,
  sales_order_id uuid,
  sales_order_folio text,
  customer_name text,
  commission_amount numeric,
  currency text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_salesperson_id uuid;
begin
  if not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_has_own_commission_view_authority() then
    raise exception 'No tienes autoridad para consultar comisiones.';
  end if;

  v_organization_id := current_user_organization_id();
  v_salesperson_id := current_user_salesperson_id();
  if v_organization_id is null or v_salesperson_id is null then
    return;
  end if;

  return query
  select
    cr.id,
    cr.sales_order_id,
    so.order_number,
    c.name,
    cr.commission_amount,
    so.currency,
    cr.status,
    cr.created_at
  from commission_records cr
  join sales_orders so on so.id = cr.sales_order_id
  left join customers c on c.id = so.customer_id
  where cr.organization_id = v_organization_id
    and cr.salesperson_id = v_salesperson_id
  order by cr.created_at desc;
end;
$$;

create or replace function rpc_get_own_commission(p_commission_id uuid)
returns table (
  id uuid,
  sales_order_id uuid,
  sales_order_folio text,
  customer_name text,
  commission_amount numeric,
  currency text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_salesperson_id uuid;
begin
  if not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_has_own_commission_view_authority() then
    raise exception 'No tienes autoridad para consultar comisiones.';
  end if;

  v_organization_id := current_user_organization_id();
  v_salesperson_id := current_user_salesperson_id();
  if v_organization_id is null or v_salesperson_id is null then
    return;
  end if;

  -- Sin rama especial para "existe pero no es tuya": el WHERE exige
  -- dueño Y organización a la vez, así que una comisión ajena y una
  -- inexistente se comportan IGUAL (0 filas) — mismo criterio de
  -- no-disclosure que el 404 de commission_records_select vía RLS.
  return query
  select
    cr.id,
    cr.sales_order_id,
    so.order_number,
    c.name,
    cr.commission_amount,
    so.currency,
    cr.status,
    cr.created_at
  from commission_records cr
  join sales_orders so on so.id = cr.sales_order_id
  left join customers c on c.id = so.customer_id
  where cr.id = p_commission_id
    and cr.organization_id = v_organization_id
    and cr.salesperson_id = v_salesperson_id;
end;
$$;

-- =========================================================================
-- 4) Asignación inicial — otorga can_view_own_commissions a TODO
--    user_profiles activo con role='vendedor' de Global Supplier MTY
--    (única organización real hoy, ver 0013). Idempotente (on conflict do
--    nothing sobre el índice único de user_capabilities) y explícitamente
--    acotada a role='vendedor' — ningún admin recibe esta capability por
--    este bootstrap. granted_by_user_id se resuelve al primer admin activo
--    de la organización; si por algún motivo no existiera ninguno, el NOT
--    NULL de user_capabilities aborta esta sección completa (y con ella
--    toda la migración, ver begin/commit) en vez de insertar un valor
--    inventado — señal explícita de un estado roto que debe investigarse,
--    no algo que este bootstrap deba disimular.
-- =========================================================================
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id)
select
  om.organization_id,
  up.user_id,
  'can_view_own_commissions',
  (
    select om_admin.user_id
    from organization_members om_admin
    where om_admin.organization_id = om.organization_id
      and om_admin.role = 'admin'
      and om_admin.active = true
    order by om_admin.user_id
    limit 1
  )
from user_profiles up
join organization_members om on om.user_id = up.user_id and om.active = true
join organizations o on o.id = om.organization_id
where up.role = 'vendedor'
  and up.active = true
  and o.slug = 'global-supplier-mty'
on conflict (organization_id, user_id, capability) do nothing;

commit;
