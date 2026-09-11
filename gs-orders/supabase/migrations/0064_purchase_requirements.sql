-- =========================================================================
-- THÖREN — Fase 9 / Block 1: Purchase Requirements (Order → Inventory →
-- Purchase Requirement → PO)
-- =========================================================================
-- OBJETIVO: conectar Pedidos con Compras a través de un concepto explícito
-- de "necesidad de compra" — hoy Compras crea una Purchase Order a mano
-- sin ningún registro de POR QUÉ (qué faltante la originó). Todo lo
-- demás (inventario, reservas, recepción, POs) ya existe y funciona; esta
-- migración es aditiva salvo dos ajustes puntuales y explícitamente
-- aprobados (ver ACLARACIÓN FASE 9 / BLOCK 1 abajo): el índice único de
-- inventory_reservations pasa a incluir warehouse_id, y orders gana dos
-- columnas de estado de sincronización. Cero ALTER sobre purchase_orders/
-- purchase_order_items.
--
-- =========================================================================
-- ACLARACIÓN FASE 9 / BLOCK 1 — dos gaps cerrados antes de close-out
-- =========================================================================
-- GAP 1 (stock fragmentado entre almacenes): el diseño original de este
-- archivo reservaba de UN SOLO almacén (el de más disponible) por Pedido+
-- producto — si el stock estaba repartido entre varios almacenes activos
-- (ninguno cubriendo el total), el motor generaba shortage de más aunque
-- la suma total sí alcanzara. Corregido:
--   - inventory_reservations_active_unique pasa de (order_id, product_id)
--     a (order_id, product_id, warehouse_id) — un Pedido+producto ahora
--     puede tener una reserva activa POR almacén, nunca dos en el MISMO
--     almacén. inventory_reservations.quantity sigue significando "lo
--     reservado en ESE almacén"; el total reservado de un Pedido+producto
--     es la SUMA de sus filas activas — exactamente el mismo patrón que
--     rpc_inventory_committed_levels (0037/0038) ya usa para agregar
--     reservas de MÚLTIPLES Pedidos por almacén, aplicado ahora también
--     dentro de un mismo Pedido.
--   - rpc_reserve_inventory (0037/0044) se redefine (create or replace,
--     misma firma) SOLO para que su validación de "ya existe una reserva
--     activa" sea por (order_id, product_id, warehouse_id) en vez de
--     (order_id, product_id) — el resto de la función (permisos, cálculo
--     de AVAILABLE por almacén, inserción) es idéntico, carácter por
--     carácter, a la versión de 0044.
--   - fn_order_product_shortage NO CAMBIA: su fórmula ya agregaba
--     on_hand/reservado con SUM a través de TODOS los almacenes activos
--     (nunca eligió uno solo) — el bug vivía exclusivamente en el motor
--     de RESERVA (rpc_confirm_order_procurement), no en el cálculo de
--     shortage, que siempre fue correcto.
--   - El motor de reserva (ahora rpc_sync_order_procurement, ver GAP 2)
--     reparte codiciosamente entre almacenes activos ordenados por
--     disponible descendente (MVP determinista, sin optimización de
--     almacén) hasta cubrir lo que el Pedido necesita o agotar el
--     disponible real — verificado con los dos casos exigidos: 8=4+4 y
--     12=5+4+1 (ver reporte).
--
-- GAP 2 (sync de procurement no puede fallar en silencio): la versión
-- original llamaba a rpc_confirm_order_procurement como best-effort desde
-- TypeScript (try/log, nunca visible). Corregido con la Opción B
-- (recuperable y visible) — un rediseño transaccional completo (Opción A)
-- habría requerido reabrir rpc_create_order_with_custom_fields/
-- rpc_update_order_with_custom_fields (0058), un módulo cerrado y ya
-- probado, para envolver la sincronización en la MISMA transacción que
-- create/update de Pedido; el costo de reabrir esas RPCs en los 3 call
-- sites (crear/editar/cambiar estado) para una garantía marginal sobre lo
-- que ya da la Opción B no se justificaba para Block 1:
--   - orders gana `procurement_sync_status` ('ok'|'failed', default 'ok')
--     y `procurement_sync_error` (texto, nullable) — visibles, nunca un
--     console.error silencioso.
--   - rpc_confirm_order_procurement y rpc_cancel_purchase_requirements_for_order
--     se consolidan en UNA sola función idempotente,
--     rpc_sync_order_procurement(p_order_id) — lee el status ACTUAL del
--     Pedido y decide qué sincronizar (pedido → disponibilidad/reserva/
--     requirement; cancelado → libera reservas + cancela requirements;
--     cualquier otro estado → no-op limpio). Es el ÚNICO punto de entrada
--     para: confirmar, editar cantidades, cancelar, o reintentar
--     manualmente — mismo criterio pedido explícitamente ("Debe existir
--     una función idempotente... que pueda ejecutarse: al confirmar
--     Pedido, al editar cantidades, al cancelar, manualmente si algo
--     falló").
--   - Si termina sin errores, la propia función deja
--     procurement_sync_status='ok' como su último paso (atómico con todo
--     lo demás que hizo). Si lanza una excepción, TODA la transacción de
--     esa llamada se revierte (nada queda a medias) — marcar
--     procurement_sync_status='failed' + guardar el mensaje ocurre
--     DESPUÉS, en una llamada separada desde TypeScript (no puede ocurrir
--     dentro de la misma transacción que acaba de revertirse) — ver
--     runProcurementSideEffect en pedidos/actions.ts.
--
-- RIESGO ESTRUCTURAL CONOCIDO Y APROBADO (ver diagnóstico Fase 9):
-- purchase_orders.order_id es NOT NULL e INMUTABLE (trigger
-- trg_purchase_orders_prevent_folio_change, 0035) — una PO pertenece a
-- exactamente UN Pedido. Esta migración NO lo toca. Cuando Compras arma
-- una PO a partir de requirements de Pedidos DISTINTOS hacia el mismo
-- proveedor, la capa de aplicación crea una PO POR Pedido — decisión de
-- negocio, no de esquema, deliberadamente diferida.
--
-- GRANULARIDAD (ver aclaración Fase 9, Block 1) — Purchase Requirement por
-- (order_id, catalog_product_id), NUNCA por order_item_id:
-- inventory_reservations (0037) YA agrega por (order_id, product_id) — a
-- lo sumo una reserva activa por esa pareja. Si un Pedido tiene dos
-- partidas del MISMO producto, calcular disponibilidad/shortage por
-- partida haría que ambas "vean" el mismo stock disponible de forma
-- independiente → sobre-compra. Este modelo evita ese bug agregando la
-- demanda ANTES de comparar contra disponible, exactamente como ya hace
-- fn_check_order_delivery_completion (0039) con fulfillment/delivery. La
-- trazabilidad hacia las partidas de origen vive en una tabla hija
-- (purchase_requirement_source_items), puramente informativa — nunca
-- participa en la aritmética de disponibilidad/shortage.
--
-- catalog_product_id NOT NULL en purchase_requirements — a diferencia de
-- order_items/quote_items (ambos NULLABLE por diseño, ver 0009: partidas
-- manuales/no catalogadas son un caso real y activo, confirmado en
-- productos-section.tsx). Un order_item sin catalog_product_id NO tiene
-- ningún registro de inventario que consultar (inventory_movements/
-- inventory_reservations son 100% keyed por catalog_product_id) — el
-- automatismo de esta migración simplemente OMITE esas partidas al
-- calcular shortage; nunca inventa un producto de catálogo para
-- representarlas. Compras puede seguir comprándolas por el flujo manual
-- de "Crear PO" ya existente (rpc_create_purchase_order acepta cualquier
-- order_item_id, catalogado o no, sin cambios).
--
-- FUERA DE ALCANCE de Block 1 (ver Parte V del enunciado completo):
-- recepción, entrega, cierre, facturación, planning/replenishment,
-- forecasting. Nada de eso se toca aquí.
-- =========================================================================

begin;

-- =========================================================================
-- 1) suppliers.preferred_document_language — idioma preferido del
--    documento para ESE proveedor específico (Fase 9, Parte H). Prioridad
--    de resolución (ver getPurchaseOrderDocumentLanguage en TS):
--    supplier.preferred_document_language → business_unit_process_settings.
--    provider_document_language (0063) → 'es'. Nullable: un proveedor sin
--    preferencia explícita cae al siguiente nivel, nunca a un default
--    hardcodeado de Business Unit.
-- =========================================================================
alter table suppliers
  add column if not exists preferred_document_language text
    check (preferred_document_language is null or preferred_document_language in ('es', 'en'));

-- =========================================================================
-- 1b) orders.procurement_sync_status/procurement_sync_error (GAP 2) —
--     visibilidad explícita de si la última sincronización de
--     procurement (reserva + purchase_requirements) de este Pedido
--     terminó bien o falló. 'ok' es el default porque para un Pedido en
--     borrador/cerrado/cancelado "sincronizado" no aplica — solo importa
--     de verdad mientras status='pedido', y ahí rpc_sync_order_procurement
--     es quien lo mantiene al día.
-- =========================================================================
alter table orders
  add column if not exists procurement_sync_status text not null default 'ok'
    check (procurement_sync_status in ('ok', 'failed'));
alter table orders
  add column if not exists procurement_sync_error text;

-- =========================================================================
-- 1c) inventory_reservations — GAP 1: permite una reserva activa POR
--     ALMACÉN para el mismo Pedido+producto (antes, a lo sumo una en
--     total). Ver ACLARACIÓN arriba.
-- =========================================================================
drop index if exists inventory_reservations_active_unique;
create unique index if not exists inventory_reservations_active_unique
  on inventory_reservations (order_id, product_id, warehouse_id)
  where released_at is null;

-- rpc_reserve_inventory — create or replace idéntico a 0044, SOLO con la
-- validación de "ya existe una reserva activa" ahora scoped a
-- (order_id, product_id, warehouse_id) en vez de (order_id, product_id).
create or replace function rpc_reserve_inventory(
  p_reservation_id uuid,
  p_order_id uuid,
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity integer
)
returns inventory_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_organization_id uuid;
  v_order_salesperson_id uuid;
  v_committed_others integer;
  v_on_hand integer;
  v_available integer;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_row inventory_reservations;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  select organization_id, salesperson_id into v_order_organization_id, v_order_salesperson_id
    from orders where id = p_order_id;
  if v_order_organization_id is null then
    raise exception 'Pedido no encontrado: %', p_order_id;
  end if;
  if not is_organization_member(v_order_organization_id) then
    raise exception 'El Pedido no pertenece a tu organización.';
  end if;
  if not current_user_is_admin()
     and v_order_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_reserve_inventory') then
    raise exception 'No tienes permiso para reservar inventario sobre este Pedido.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad a reservar debe ser mayor a cero.';
  end if;

  if not exists (
    select 1 from product_catalog where id = p_product_id and organization_id = v_order_organization_id
  ) then
    raise exception 'El producto seleccionado no existe o no pertenece a tu organización.';
  end if;
  if not exists (
    select 1 from order_items where order_id = p_order_id and catalog_product_id = p_product_id
  ) then
    raise exception 'Este producto no forma parte de las partidas de este Pedido.';
  end if;
  if not exists (
    select 1 from warehouses where id = p_warehouse_id and organization_id = v_order_organization_id and active = true
  ) then
    raise exception 'El almacén seleccionado no existe, no pertenece a tu organización, o está inactivo.';
  end if;

  -- GAP 1: scoped también por warehouse_id — un Pedido+producto puede
  -- tener una reserva activa POR almacén (antes, a lo sumo una en total).
  if exists (
    select 1 from inventory_reservations
    where order_id = p_order_id and product_id = p_product_id and warehouse_id = p_warehouse_id and released_at is null
  ) then
    raise exception 'Ya existe una reserva activa para este producto en este almacén y Pedido; ajústala en vez de crear una nueva.';
  end if;

  select coalesce(sum(quantity), 0) into v_committed_others
    from inventory_reservations
    where product_id = p_product_id and warehouse_id = p_warehouse_id and released_at is null;
  select coalesce(sum(quantity_delta), 0) into v_on_hand
    from inventory_movements
    where product_id = p_product_id and warehouse_id = p_warehouse_id;
  v_available := v_on_hand - v_committed_others;

  if p_quantity > v_available then
    raise exception 'No hay suficiente disponible en ese almacén (disponible: %, solicitado: %).', v_available, p_quantity;
  end if;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

  insert into inventory_reservations (
    id, organization_id, order_id, product_id, warehouse_id, quantity,
    created_by_user_id, created_by_name
  ) values (
    p_reservation_id, v_order_organization_id, p_order_id, p_product_id, p_warehouse_id, p_quantity,
    v_user_id, coalesce(v_user_name, '—')
  )
  returning * into v_row;

  insert into inventory_reservation_events (
    reservation_id, organization_id, order_id, product_id, warehouse_id,
    event_type, previous_quantity, new_quantity, changed_by_user_id, changed_by_name
  ) values (
    v_row.id, v_order_organization_id, p_order_id, p_product_id, p_warehouse_id,
    'creada', null, p_quantity, v_user_id, coalesce(v_user_name, '—')
  );

  return v_row;
end;
$$;

-- =========================================================================
-- 2) purchase_requirements — una fila por (order_id, catalog_product_id)
--    con demanda pendiente de cubrir vía compra. Nace del cálculo de
--    shortage al confirmar un Pedido (rpc_confirm_order_procurement,
--    abajo); Compras la consume para crear Purchase Orders.
-- =========================================================================
create table if not exists purchase_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  business_unit_id uuid references business_units (id) on delete restrict,
  order_id uuid not null references orders (id) on delete cascade,
  catalog_product_id uuid not null references product_catalog (id) on delete restrict,
  supplier_id uuid references suppliers (id) on delete set null,
  required_qty integer not null check (required_qty > 0),
  allocated_qty integer not null default 0
    check (allocated_qty >= 0 and allocated_qty <= required_qty),
  status text not null default 'open'
    check (status in ('open', 'partially_allocated', 'allocated', 'cancelled')),
  required_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A lo sumo UNA fila activa (no cancelada) por Pedido+producto — mismo
-- criterio que inventory_reservations_active_unique (0037): una necesidad
-- cancelada no bloquea que se genere una nueva más adelante.
create unique index if not exists purchase_requirements_active_unique
  on purchase_requirements (order_id, catalog_product_id)
  where status <> 'cancelled';

create index if not exists purchase_requirements_organization_idx on purchase_requirements (organization_id);
create index if not exists purchase_requirements_order_idx on purchase_requirements (order_id);
create index if not exists purchase_requirements_supplier_idx on purchase_requirements (supplier_id) where supplier_id is not null;
create index if not exists purchase_requirements_open_idx on purchase_requirements (organization_id, status) where status in ('open', 'partially_allocated');

drop trigger if exists trg_purchase_requirements_updated_at on purchase_requirements;
create trigger trg_purchase_requirements_updated_at
  before update on purchase_requirements
  for each row execute function set_updated_at();

alter table purchase_requirements enable row level security;

-- SELECT: mismo patrón exacto que inventory_reservations_select (0037) —
-- ADMIN ve todas las de su organización; VENDEDOR solo las de Pedidos que
-- le pertenecen.
drop policy if exists "purchase_requirements_select" on purchase_requirements;
create policy "purchase_requirements_select" on purchase_requirements
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.id = purchase_requirements.order_id
          and o.salesperson_id = current_user_salesperson_id()
      )
    )
  );

-- Sin policy de insert/update/delete — solo las RPCs SECURITY DEFINER de
-- abajo escriben aquí, mismo criterio que inventory_reservations.

-- =========================================================================
-- 3) purchase_requirement_source_items — trazabilidad hacia las partidas
--    de origen de un requirement agregado. PURAMENTE INFORMATIVA: nunca
--    participa en el cálculo de disponibilidad/shortage (ver DECISIÓN de
--    granularidad arriba). Se reemplaza completa (delete+reinsert) en
--    cada recálculo, mismo patrón que rpc_replace_purchase_order_items.
-- =========================================================================
create table if not exists purchase_requirement_source_items (
  id uuid primary key default gen_random_uuid(),
  purchase_requirement_id uuid not null references purchase_requirements (id) on delete cascade,
  order_item_id uuid not null references order_items (id) on delete cascade,
  requested_qty integer not null check (requested_qty > 0),
  constraint purchase_requirement_source_items_unique unique (purchase_requirement_id, order_item_id)
);

create index if not exists purchase_requirement_source_items_requirement_idx
  on purchase_requirement_source_items (purchase_requirement_id);

alter table purchase_requirement_source_items enable row level security;

drop policy if exists "purchase_requirement_source_items_select" on purchase_requirement_source_items;
create policy "purchase_requirement_source_items_select" on purchase_requirement_source_items
  for select using (
    exists (
      select 1 from purchase_requirements pr
      where pr.id = purchase_requirement_source_items.purchase_requirement_id
        and current_user_active()
        and is_organization_member(pr.organization_id)
        and (
          current_user_is_admin()
          or exists (
            select 1 from orders o
            where o.id = pr.order_id and o.salesperson_id = current_user_salesperson_id()
          )
        )
    )
  );

-- =========================================================================
-- 4) purchase_requirement_allocations — vínculo real Order Item ↔ PO Item
--    (Fase 9, Parte B), vía la necesidad como intermediaria. N:N genuino
--    sin tocar purchase_orders/purchase_order_items: un requirement puede
--    repartirse en varias partidas de PO; una partida de PO puede cubrir
--    varios requirements (mismo producto, mismo Pedido — recordar que una
--    PO pertenece a un solo Pedido, ver RIESGO arriba).
-- =========================================================================
create table if not exists purchase_requirement_allocations (
  id uuid primary key default gen_random_uuid(),
  purchase_requirement_id uuid not null references purchase_requirements (id) on delete cascade,
  purchase_order_item_id uuid not null references purchase_order_items (id) on delete cascade,
  allocated_qty integer not null check (allocated_qty > 0),
  created_at timestamptz not null default now()
);

create index if not exists purchase_requirement_allocations_requirement_idx
  on purchase_requirement_allocations (purchase_requirement_id);
create index if not exists purchase_requirement_allocations_po_item_idx
  on purchase_requirement_allocations (purchase_order_item_id);

alter table purchase_requirement_allocations enable row level security;

drop policy if exists "purchase_requirement_allocations_select" on purchase_requirement_allocations;
create policy "purchase_requirement_allocations_select" on purchase_requirement_allocations
  for select using (
    exists (
      select 1 from purchase_requirements pr
      where pr.id = purchase_requirement_allocations.purchase_requirement_id
        and current_user_active()
        and is_organization_member(pr.organization_id)
        and (
          current_user_is_admin()
          or exists (
            select 1 from orders o
            where o.id = pr.order_id and o.salesperson_id = current_user_salesperson_id()
          )
        )
    )
  );

-- Sin policy de insert/update/delete en ninguna de las 3 tablas nuevas —
-- solo las RPCs SECURITY DEFINER de abajo escriben.

-- =========================================================================
-- 5) fn_order_product_shortage — solo lectura. Disponibilidad/shortage
--    agregada por (order_id, catalog_product_id), reutilizando EXACTAMENTE
--    la misma fórmula ya validada en rpc_reserve_inventory (0037):
--    available = on_hand - comprometido_de_otros_pedidos (sumado en TODOS
--    los almacenes activos de la organización). incoming reutiliza
--    rpc_inventory_incoming_by_product (0036) sin duplicar esa lógica.
--    Omite explícitamente order_items con catalog_product_id null (ver
--    DECISIÓN arriba).
-- =========================================================================
-- Fórmula (derivada y verificada contra el caso obligatorio de la
-- aclaración Fase 9: Partida 1 qty 5 + Partida 2 qty 7 del mismo
-- producto, stock 4):
--   available_qty (mostrado)  = on_hand - reserved_other - reserved_this
--     → el pool REALMENTE libre en este momento (ya reservado por
--       cualquier Pedido, incluido este, deja de estar libre).
--   shortage_qty = greatest(requested_qty - on_hand_qty + reserved_other_orders_qty - incoming_qty, 0)
--     → equivalente a greatest((requested_qty - reserved_this_order_qty) - available_qty - incoming_qty, 0),
--       pero reserved_this_order_qty se cancela algebraicamente: el
--       shortage de un Pedido es una función de su demanda TOTAL contra
--       la oferta TOTAL (on_hand + incoming) menos lo que otros Pedidos
--       ya reclamaron — es INDEPENDIENTE de cuánto de su propia demanda
--       ya alcanzó a reservar este mismo Pedido (reservar no crea ni
--       destruye disponibilidad física, solo la reasigna). Verificado
--       antes y después de reservar en el caso obligatorio: shortage=8
--       en ambos momentos (ver supabase/tests/0064_..._functional_tests.sql,
--       TEST de "shortage estable antes/después de reservar").
create or replace function fn_order_product_shortage(p_order_id uuid)
returns table (
  catalog_product_id uuid,
  requested_qty integer,
  on_hand_qty integer,
  reserved_other_orders_qty integer,
  reserved_this_order_qty integer,
  available_qty integer,
  incoming_qty integer,
  shortage_qty integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  select organization_id into v_organization_id from orders where id = p_order_id;
  if v_organization_id is null then
    return;
  end if;

  return query
    with demand as (
      select oi.catalog_product_id as product_id, sum(oi.quantity)::integer as requested_qty
      from order_items oi
      where oi.order_id = p_order_id and oi.catalog_product_id is not null
      group by oi.catalog_product_id
    ),
    on_hand as (
      -- w.organization_id = v_organization_id es la única defensa contra
      -- un inventory_movement corrupto/inconsistente que apunte a un
      -- almacén de OTRA organización (ningún flujo normal de la app
      -- puede producir esto — rpc_create_inventory_movement ya valida
      -- ambos — pero esta función no debe confiar en que el dato de
      -- entrada siempre sea válido). Ver TEST G6 (0064 tests).
      select im.product_id, sum(im.quantity_delta)::integer as qty
      from inventory_movements im
      join warehouses w on w.id = im.warehouse_id
      where im.product_id in (select product_id from demand)
        and w.active = true
        and w.organization_id = v_organization_id
      group by im.product_id
    ),
    reserved_this as (
      select ir.product_id, sum(ir.quantity)::integer as qty
      from inventory_reservations ir
      where ir.order_id = p_order_id and ir.released_at is null
        and ir.product_id in (select product_id from demand)
      group by ir.product_id
    ),
    reserved_other as (
      select ir.product_id, sum(ir.quantity)::integer as qty
      from inventory_reservations ir
      where ir.order_id <> p_order_id and ir.released_at is null
        and ir.product_id in (select product_id from demand)
      group by ir.product_id
    ),
    incoming as (
      select i.product_id, i.incoming::integer as qty
      from rpc_inventory_incoming_by_product() i
      where i.product_id in (select product_id from demand)
    )
    select
      d.product_id,
      d.requested_qty,
      coalesce(oh.qty, 0) as on_hand_qty,
      coalesce(ro.qty, 0) as reserved_other_orders_qty,
      coalesce(rt.qty, 0) as reserved_this_order_qty,
      (coalesce(oh.qty, 0) - coalesce(ro.qty, 0) - coalesce(rt.qty, 0))::integer as available_qty,
      coalesce(inc.qty, 0) as incoming_qty,
      greatest(
        d.requested_qty - coalesce(oh.qty, 0) + coalesce(ro.qty, 0) - coalesce(inc.qty, 0),
        0
      )::integer as shortage_qty
    from demand d
    left join on_hand oh on oh.product_id = d.product_id
    left join reserved_this rt on rt.product_id = d.product_id
    left join reserved_other ro on ro.product_id = d.product_id
    left join incoming inc on inc.product_id = d.product_id;
end;
$$;

-- =========================================================================
-- 6) rpc_sync_order_procurement — SECURITY DEFINER, ÚNICO punto de entrada
--    para sincronizar procurement de un Pedido (Fase 9 / Block 1,
--    aclaración GAP 2). Reemplaza a rpc_confirm_order_procurement +
--    rpc_cancel_purchase_requirements_for_order (consolidados aquí):
--    lee el status ACTUAL del Pedido y decide qué hacer — 'pedido'
--    sincroniza disponibilidad/reserva/requirement (GAP 1: reparte entre
--    TODOS los almacenes activos con stock libre, no solo el mejor);
--    'cancelado' libera TODAS las reservas activas del Pedido y cancela
--    sus requirements abiertos; cualquier otro status es no-op limpio.
--    Idempotente en los 3 casos — se puede invocar al confirmar, al
--    editar cantidades, al cancelar, o manualmente para reintentar tras
--    un fallo (ver procurement_sync_status/procurement_sync_error).
--    Si termina sin errores dentro de esta misma transacción, deja
--    procurement_sync_status='ok' como su último paso — si lanza una
--    excepción, TODA la transacción se revierte y es responsabilidad del
--    caller (TS) marcar 'failed' en una llamada aparte.
-- =========================================================================
create or replace function rpc_sync_order_procurement(p_order_id uuid)
returns table (
  catalog_product_id uuid,
  requested_qty integer,
  available_qty integer,
  reserved_qty integer,
  shortage_qty integer,
  requirement_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_business_unit_id uuid;
  v_order_salesperson_id uuid;
  v_status text;
  v_row record;
  v_reservation record;
  v_warehouse record;
  v_current_reserved_total integer;
  v_desired_reserved_total integer;
  v_delta integer;
  v_take integer;
  v_reducible integer;
  v_existing_id uuid;
  v_existing_qty integer;
  v_requirement_id uuid;
  v_requirement_allocated integer;
begin
  select organization_id, business_unit_id, status, salesperson_id
    into v_organization_id, v_business_unit_id, v_status, v_order_salesperson_id
    from orders where id = p_order_id;
  if v_organization_id is null then
    raise exception 'Pedido no encontrado: %', p_order_id;
  end if;

  -- Chequeo de permiso EXPLÍCITO al nivel de esta función — no basta con
  -- confiar en que rpc_reserve_inventory/rpc_adjust_inventory_reservation
  -- lo validen, porque cuando no hay stock que reservar/topar (shortage
  -- puro) esta función nunca las invoca, y sin este chequeo cualquier
  -- miembro de la organización podría crear/modificar
  -- purchase_requirements de un Pedido ajeno. Mismo criterio exacto que
  -- rpc_reserve_inventory (0037/0044/GAP 1).
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not is_organization_member(v_organization_id) then
    raise exception 'Este Pedido no pertenece a tu organización.';
  end if;
  if not current_user_is_admin()
     and v_order_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_reserve_inventory') then
    raise exception 'No tienes permiso para sincronizar el abastecimiento de este Pedido.';
  end if;

  if v_status = 'cancelado' then
    -- Libera TODAS las reservas activas del Pedido (cualquier producto,
    -- cualquier almacén) — reutiliza rpc_reserve_inventory/release sin
    -- copiar su lógica de permisos/eventos.
    for v_reservation in
      select id from inventory_reservations where order_id = p_order_id and released_at is null
    loop
      perform rpc_release_inventory_reservation(v_reservation.id);
    end loop;

    update purchase_requirements
      set status = 'cancelled'
      where order_id = p_order_id and status in ('open', 'partially_allocated');

    update orders set procurement_sync_status = 'ok', procurement_sync_error = null where id = p_order_id;
    return;
  end if;

  if v_status <> 'pedido' then
    -- borrador/cerrado: nada que sincronizar — no-op idempotente, nunca
    -- un error por invocarlo en un momento en que no aplica.
    update orders set procurement_sync_status = 'ok', procurement_sync_error = null where id = p_order_id;
    return;
  end if;

  -- shortage_qty (fn_order_product_shortage) es una función de la demanda
  -- TOTAL contra la oferta TOTAL (on_hand + incoming) menos lo ya
  -- reclamado por OTROS Pedidos — es matemáticamente INDEPENDIENTE de
  -- cuánto de su propia demanda ya reservó este mismo Pedido (reservar no
  -- crea ni destruye disponibilidad física, solo la reasigna). Por eso el
  -- shortage devuelto/guardado abajo es el mismo antes y después de
  -- intentar la reserva — no hace falta recalcularlo. Esta fórmula NO
  -- cambió con GAP 1 (ya agregaba con SUM a través de todos los
  -- almacenes) — el bug vivía solo en cómo se repartía la reserva, abajo.
  for v_row in select * from fn_order_product_shortage(p_order_id)
  loop
    select coalesce(sum(quantity), 0) into v_current_reserved_total
      from inventory_reservations
      where order_id = p_order_id and product_id = v_row.catalog_product_id and released_at is null;

    -- GAP 1: lo máximo reservable para este Pedido+producto es
    -- min(requested_qty, ya_reservado + disponible_real_org_wide) — nunca
    -- limitado a lo que quepa en un solo almacén.
    v_desired_reserved_total := least(v_row.requested_qty, v_current_reserved_total + greatest(v_row.available_qty, 0));

    if v_desired_reserved_total > v_current_reserved_total then
      -- TOP UP: reparte lo que falta entre almacenes activos de la
      -- organización con stock REALMENTE libre para este producto,
      -- ordenados por disponible descendente (MVP determinista, sin
      -- optimización de almacén) hasta cubrir el delta o agotar el
      -- disponible real.
      v_delta := v_desired_reserved_total - v_current_reserved_total;

      for v_warehouse in
        select w.id as warehouse_id,
               (coalesce(sum(im.quantity_delta), 0) - coalesce((
                 select sum(ir.quantity) from inventory_reservations ir
                 where ir.product_id = v_row.catalog_product_id and ir.warehouse_id = w.id and ir.released_at is null
               ), 0))::integer as free_qty
        from warehouses w
        left join inventory_movements im on im.warehouse_id = w.id and im.product_id = v_row.catalog_product_id
        where w.organization_id = v_organization_id and w.active = true
        group by w.id
        having (coalesce(sum(im.quantity_delta), 0) - coalesce((
                 select sum(ir.quantity) from inventory_reservations ir
                 where ir.product_id = v_row.catalog_product_id and ir.warehouse_id = w.id and ir.released_at is null
               ), 0)) > 0
        order by free_qty desc
      loop
        exit when v_delta <= 0;
        v_take := least(v_delta, v_warehouse.free_qty);

        select id, quantity into v_existing_id, v_existing_qty
          from inventory_reservations
          where order_id = p_order_id and product_id = v_row.catalog_product_id
            and warehouse_id = v_warehouse.warehouse_id and released_at is null;

        if v_existing_id is not null then
          perform rpc_adjust_inventory_reservation(v_existing_id, v_existing_qty + v_take);
        else
          perform rpc_reserve_inventory(gen_random_uuid(), p_order_id, v_row.catalog_product_id, v_warehouse.warehouse_id, v_take);
        end if;

        v_delta := v_delta - v_take;
      end loop;
    elsif v_desired_reserved_total < v_current_reserved_total then
      -- SHRINK: reduce empezando por la reserva más reciente (LIFO,
      -- criterio simple y determinista — no hay ganancia real en elegir
      -- "cuál" almacén reducir primero, cualquier orden fijo sirve).
      -- Nunca reduce por debajo de fulfilled_quantity (ya surtido
      -- físicamente) — una reserva ya consumida se salta, no se toca.
      v_delta := v_current_reserved_total - v_desired_reserved_total;

      for v_reservation in
        select id, quantity, fulfilled_quantity
          from inventory_reservations
          where order_id = p_order_id and product_id = v_row.catalog_product_id and released_at is null
          order by created_at desc
      loop
        exit when v_delta <= 0;
        v_reducible := least(v_delta, v_reservation.quantity - v_reservation.fulfilled_quantity);
        if v_reducible <= 0 then
          continue;
        end if;
        if v_reservation.quantity - v_reducible <= 0 then
          perform rpc_release_inventory_reservation(v_reservation.id);
        else
          perform rpc_adjust_inventory_reservation(v_reservation.id, v_reservation.quantity - v_reducible);
        end if;
        v_delta := v_delta - v_reducible;
      end loop;
    end if;

    -- Purchase Requirement: upsert idempotente por (order_id, catalog_product_id).
    -- Alias "pr" obligatorio: catalog_product_id también es un OUT param
    -- de esta función (RETURNS TABLE) — sin alias, Postgres lo reporta
    -- como referencia ambigua (variable plpgsql vs. columna).
    select pr.id, pr.allocated_qty into v_requirement_id, v_requirement_allocated
      from purchase_requirements pr
      where pr.order_id = p_order_id and pr.catalog_product_id = v_row.catalog_product_id and pr.status <> 'cancelled';

    if v_row.shortage_qty <= 0 then
      if v_requirement_id is not null then
        if coalesce(v_requirement_allocated, 0) = 0 then
          delete from purchase_requirement_source_items where purchase_requirement_id = v_requirement_id;
          delete from purchase_requirements where id = v_requirement_id;
          v_requirement_id := null;
        end if;
        -- allocated_qty > 0 (una PO real ya la cubre en parte) → no se
        -- borra ni se reduce por debajo de lo ya asignado; requiere
        -- intervención humana en Compras.
      end if;
    else
      if v_requirement_id is null then
        insert into purchase_requirements (organization_id, business_unit_id, order_id, catalog_product_id, required_qty)
        values (v_organization_id, v_business_unit_id, p_order_id, v_row.catalog_product_id, v_row.shortage_qty)
        returning id into v_requirement_id;
      else
        update purchase_requirements
          set required_qty = greatest(v_row.shortage_qty, coalesce(v_requirement_allocated, 0))
          where id = v_requirement_id;
      end if;

      delete from purchase_requirement_source_items where purchase_requirement_id = v_requirement_id;
      insert into purchase_requirement_source_items (purchase_requirement_id, order_item_id, requested_qty)
        select v_requirement_id, oi.id, oi.quantity
        from order_items oi
        where oi.order_id = p_order_id and oi.catalog_product_id = v_row.catalog_product_id;
    end if;

    catalog_product_id := v_row.catalog_product_id;
    requested_qty := v_row.requested_qty;
    available_qty := v_row.available_qty;
    reserved_qty := v_desired_reserved_total;
    shortage_qty := v_row.shortage_qty;
    requirement_id := v_requirement_id;
    return next;
  end loop;

  update orders set procurement_sync_status = 'ok', procurement_sync_error = null where id = p_order_id;
end;
$$;

-- =========================================================================
-- 7) rpc_allocate_purchase_requirement — SECURITY DEFINER, ADMIN o
--    can_prepare_purchase_orders (misma autoridad que preparar una PO,
--    0045). Registra que una partida de PO ya creada cubre (total o
--    parcialmente) un requirement, y actualiza allocated_qty/status.
--    Valida que la PO y el requirement sean del MISMO Pedido y MISMO
--    producto — con el modelo actual (una PO = un Pedido) esto nunca
--    debería fallar salvo un bug de la capa de aplicación, pero se valida
--    explícitamente en vez de confiar en el caller.
-- =========================================================================
create or replace function rpc_allocate_purchase_requirement(
  p_requirement_id uuid,
  p_purchase_order_item_id uuid,
  p_allocated_qty integer
)
returns purchase_requirements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req purchase_requirements;
  v_poi purchase_order_items;
  v_po purchase_orders;
  v_new_allocated integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() and not current_user_has_capability('can_prepare_purchase_orders') then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación puede asignar una necesidad de compra.';
  end if;

  select * into v_req from purchase_requirements where id = p_requirement_id for update;
  if v_req.id is null then
    raise exception 'Necesidad de compra no encontrada: %', p_requirement_id;
  end if;
  if not is_organization_member(v_req.organization_id) then
    raise exception 'Esta necesidad de compra no pertenece a tu organización.';
  end if;

  select * into v_poi from purchase_order_items where id = p_purchase_order_item_id;
  if v_poi.id is null then
    raise exception 'Partida de Purchase Order no encontrada: %', p_purchase_order_item_id;
  end if;
  select * into v_po from purchase_orders where id = v_poi.purchase_order_id;
  if v_po.organization_id <> v_req.organization_id then
    raise exception 'La Purchase Order no pertenece a tu organización.';
  end if;
  if v_po.order_id <> v_req.order_id then
    raise exception 'La Purchase Order pertenece a un Pedido distinto al de esta necesidad de compra.';
  end if;
  if v_poi.catalog_product_id is distinct from v_req.catalog_product_id then
    raise exception 'La partida de la Purchase Order no corresponde al mismo producto que la necesidad de compra.';
  end if;

  if p_allocated_qty is null or p_allocated_qty <= 0 then
    raise exception 'La cantidad asignada debe ser mayor a cero.';
  end if;

  insert into purchase_requirement_allocations (purchase_requirement_id, purchase_order_item_id, allocated_qty)
  values (p_requirement_id, p_purchase_order_item_id, p_allocated_qty);

  select coalesce(sum(allocated_qty), 0) into v_new_allocated
    from purchase_requirement_allocations where purchase_requirement_id = p_requirement_id;

  if v_new_allocated > v_req.required_qty then
    raise exception 'La cantidad asignada (%) excede lo requerido (%) para esta necesidad de compra.', v_new_allocated, v_req.required_qty;
  end if;

  update purchase_requirements
    set allocated_qty = v_new_allocated,
        supplier_id = coalesce(supplier_id, v_po.supplier_id),
        status = case
          when v_new_allocated >= required_qty then 'allocated'
          when v_new_allocated > 0 then 'partially_allocated'
          else 'open'
        end
    where id = p_requirement_id
    returning * into v_req;

  return v_req;
end;
$$;

commit;
