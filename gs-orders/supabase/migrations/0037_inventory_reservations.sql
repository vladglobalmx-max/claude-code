-- =========================================================================
-- THÖREN — Fase 6N: Reservas de Inventario / COMMITTED
-- =========================================================================
-- OBJETIVO: reservas EXPLÍCITAS de inventario desde el Pedido, para que
-- AVAILABLE = ON HAND - COMMITTED deje de ser una fórmula con COMMITTED
-- fijo en 0 (ver DECISIÓN "COMMITTED = 0" en 0036_inventory_mvp.sql — esta
-- migración es exactamente la propuesta documentada ahí).
-- NO se toca la lógica de recepción/Incoming/Kardex de 6M — ya validada en
-- producción. Los únicos cambios sobre objetos de 6M son dos funciones
-- NUEVAS de solo lectura para exponer COMMITTED/AVAILABLE.
--
-- =========================================================================
-- DECISIÓN — reservas EXPLÍCITAS únicamente, nunca automáticas
-- =========================================================================
-- No existe ningún trigger sobre `orders`/`order_items` que cree, ajuste o
-- libere una reserva. La única vía de escritura son tres RPCs
-- (rpc_reserve_inventory / rpc_adjust_inventory_reservation /
-- rpc_release_inventory_reservation), invocadas desde una acción explícita
-- en el detalle del Pedido. Editar el Pedido (que borra/reinserta
-- order_items, ver rpc_update_order 0034) NO libera ni ajusta reservas
-- existentes — si un producto reservado deja de estar en el Pedido, la
-- reserva sigue activa hasta que alguien la libere explícitamente. Esto es
-- intencional (nunca inventar limpieza automática), documentado aquí para
-- que no se lea como un bug.
--
-- =========================================================================
-- DECISIÓN — modelo de datos: fila mutable + ledger de eventos (mismo
-- patrón dual ya usado en el proyecto)
-- =========================================================================
-- `inventory_reservations` mantiene UNA fila por reserva (creada una vez,
-- nunca borrada), con `quantity` mutable y `released_at` como marca de
-- liberación (nunca se hace DELETE — "preferir historial a perder
-- información", requisito #5). Como la fila nunca se borra, un índice
-- único PARCIAL (`where released_at is null`) garantiza como mucho una
-- reserva ACTIVA por (order_id, product_id) sin impedir que existan varias
-- reservas históricas (ya liberadas) para el mismo par a lo largo del
-- tiempo.
-- `inventory_reservation_events` es el ledger insert-only de cada cambio
-- (creada/aumentada/reducida/liberada) con cantidad anterior/nueva —
-- mismo criterio exacto que `order_operational_status_history` (0033):
-- tabla con policy de SELECT únicamente, escrita solo desde dentro de las
-- RPCs (aquí no hace falta trigger porque las 3 RPCs SON el único punto de
-- entrada de escritura, a diferencia de operational_status que se edita
-- desde varios paths de `orders`).
-- Como la fila de `inventory_reservations` nunca se borra (solo se
-- libera), la FK `inventory_reservation_events.reservation_id ... on
-- delete cascade` nunca se dispara en la práctica — a diferencia del caso
-- de purchase_order_items.order_item_id (0035), aquí SÍ es seguro tener
-- una FK real porque el padre nunca desaparece bajo los pies del hijo.
--
-- =========================================================================
-- DECISIÓN — permisos: mismo criterio "propio o admin" que el Pedido
-- (orders_update_own_or_admin), NO admin-only como Compras/Almacenes
-- =========================================================================
-- A diferencia de Compras (gestión ADMIN-only, 0035) y de los movimientos
-- manuales de Inventory (ADMIN-only, 0036), reservar/ajustar/liberar stock
-- es una acción que vive DENTRO del detalle del Pedido y no mueve
-- inventario físico (no toca inventory_movements, no cambia ON HAND ni
-- INCOMING) — es una decisión comercial sobre ESE Pedido, igual en
-- naturaleza a cambiar operational_status (0033), que ya usa el mismo
-- criterio "propio o admin" de `orders_update_own_or_admin`. Por eso
-- VENDEDOR puede reservar/ajustar/liberar sobre los Pedidos que YA le
-- pertenecen (sin ganar acceso nuevo a Pedidos ajenos) y ADMIN sobre
-- cualquiera de su organización. El enunciado de esta fase no especifica
-- lo contrario; se documenta aquí como decisión explícita, fácilmente
-- reversible (es un simple cambio de policy/chequeo, no un cambio de
-- esquema) si se decide restringir a ADMIN-only en el futuro.
--
-- =========================================================================
-- DECISIÓN — COMMITTED/AVAILABLE se exponen vía RPC, mismo patrón que
-- ON HAND/INCOMING (nunca una columna cacheada)
-- =========================================================================
-- `rpc_inventory_committed_levels` es SECURITY DEFINER con filtro explícito
-- de organización — igual razón que `rpc_inventory_incoming_by_product`
-- (0036): la RLS de `inventory_reservations` es más restrictiva
-- (propio-o-admin) que lo que Inventory necesita mostrar (COMMITTED es un
-- hecho de organización, visible a cualquier miembro, igual que ON HAND).
--
-- =========================================================================
-- FUERA DE ALCANCE de esta migración (ver enunciado completo de la fase)
-- =========================================================================
-- Asignación/consumo de inventario al entregar, transferencias entre
-- almacenes, lotes/series, costos/valuación, reservas automáticas, y
-- cualquier cambio a la lógica de recepción/Incoming/Kardex de 6M salvo
-- las dos funciones de lectura nuevas descritas arriba.
-- =========================================================================

begin;

-- =========================================================================
-- 1) inventory_reservations — una fila por reserva; nunca se borra, se
--    libera (released_at). Sin policy de insert/update para
--    `authenticated` — solo las RPCs de la sección 3 escriben aquí.
-- =========================================================================
create table if not exists inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid not null references product_catalog (id) on delete restrict,
  warehouse_id uuid not null references warehouses (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_by_user_id uuid not null,
  created_by_name text not null,
  released_by_user_id uuid,
  released_by_name text,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A lo sumo UNA reserva ACTIVA por producto dentro de un mismo Pedido —
-- "aumentar/reducir" opera sobre esa fila; liberar + volver a reservar crea
-- una fila nueva (la anterior queda como historial, nunca se borra).
create unique index if not exists inventory_reservations_active_unique
  on inventory_reservations (order_id, product_id)
  where released_at is null;

create index if not exists inventory_reservations_organization_idx on inventory_reservations (organization_id);
create index if not exists inventory_reservations_order_idx on inventory_reservations (order_id);
create index if not exists inventory_reservations_product_warehouse_idx
  on inventory_reservations (product_id, warehouse_id)
  where released_at is null;

drop trigger if exists trg_inventory_reservations_updated_at on inventory_reservations;
create trigger trg_inventory_reservations_updated_at
  before update on inventory_reservations
  for each row execute function set_updated_at();

alter table inventory_reservations enable row level security;

drop policy if exists "inventory_reservations_select" on inventory_reservations;
create policy "inventory_reservations_select" on inventory_reservations
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.id = inventory_reservations.order_id
          and o.salesperson_id = current_user_salesperson_id()
      )
    )
  );

-- Sin policy de insert/update/delete — ver DECISIÓN de permisos arriba.

-- =========================================================================
-- 2) inventory_reservation_events — ledger insert-only de cada cambio de
--    una reserva (creada/aumentada/reducida/liberada). Misma visibilidad
--    que inventory_reservations. Sin policy de insert/update/delete.
-- =========================================================================
create table if not exists inventory_reservation_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references inventory_reservations (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete restrict,
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid not null references product_catalog (id) on delete restrict,
  warehouse_id uuid not null references warehouses (id) on delete restrict,
  event_type text not null check (event_type in ('creada', 'aumentada', 'reducida', 'liberada')),
  previous_quantity integer,
  new_quantity integer not null,
  changed_by_user_id uuid not null,
  changed_by_name text not null,
  changed_at timestamptz not null default clock_timestamp()
);

create index if not exists inventory_reservation_events_reservation_idx
  on inventory_reservation_events (reservation_id, changed_at desc);
create index if not exists inventory_reservation_events_order_idx on inventory_reservation_events (order_id);

alter table inventory_reservation_events enable row level security;

drop policy if exists "inventory_reservation_events_select" on inventory_reservation_events;
create policy "inventory_reservation_events_select" on inventory_reservation_events
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.id = inventory_reservation_events.order_id
          and o.salesperson_id = current_user_salesperson_id()
      )
    )
  );

-- Sin policy de insert/update/delete — solo las RPCs de abajo escriben aquí.

-- =========================================================================
-- 3) RPCs de escritura — SECURITY DEFINER (las tablas de arriba no tienen
--    policy de insert/update para `authenticated`). El chequeo de permiso
--    "propio o admin" y todas las validaciones de negocio (cross-org,
--    producto del Pedido, cantidad <= AVAILABLE) se hacen explícitamente
--    dentro de cada función, nunca delegadas a RLS.
-- =========================================================================

-- rpc_reserve_inventory — crea una reserva NUEVA. Falla si ya existe una
-- reserva activa para ese (order_id, product_id) — en ese caso se debe usar
-- rpc_adjust_inventory_reservation.
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
  if not current_user_is_admin() and v_order_salesperson_id <> current_user_salesperson_id() then
    raise exception 'No tienes permiso para reservar inventario sobre este Pedido.';
  end if;

  -- Validación de forma (cantidad) antes que las de negocio/pertenencia,
  -- para que un valor inválido siempre se reporte igual sin importar el
  -- producto/almacén elegidos.
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

  if exists (
    select 1 from inventory_reservations
    where order_id = p_order_id and product_id = p_product_id and released_at is null
  ) then
    raise exception 'Ya existe una reserva activa para este producto en este Pedido; ajústala en vez de crear una nueva.';
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

-- rpc_adjust_inventory_reservation — cambia la cantidad de una reserva
-- ACTIVA existente (aumentar o reducir). p_quantity es un valor ABSOLUTO
-- (no un delta) — mismo criterio que rpc_receive_purchase_order_item.
-- Reenviar el mismo valor actual es idempotente: no genera evento nuevo.
create or replace function rpc_adjust_inventory_reservation(
  p_reservation_id uuid,
  p_quantity integer
)
returns inventory_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation inventory_reservations;
  v_order_salesperson_id uuid;
  v_committed_others integer;
  v_on_hand integer;
  v_available integer;
  v_event_type text;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_previous_quantity integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  select * into v_reservation
    from inventory_reservations where id = p_reservation_id and released_at is null
    for update;
  if v_reservation.id is null then
    raise exception 'Reserva activa no encontrada: %', p_reservation_id;
  end if;

  if not is_organization_member(v_reservation.organization_id) then
    raise exception 'Esta reserva no pertenece a tu organización.';
  end if;
  select salesperson_id into v_order_salesperson_id from orders where id = v_reservation.order_id;
  if not current_user_is_admin() and v_order_salesperson_id <> current_user_salesperson_id() then
    raise exception 'No tienes permiso para ajustar esta reserva.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero; usa liberar para quitar la reserva por completo.';
  end if;

  v_previous_quantity := v_reservation.quantity;
  if p_quantity = v_previous_quantity then
    return v_reservation;
  end if;

  select coalesce(sum(quantity), 0) into v_committed_others
    from inventory_reservations
    where product_id = v_reservation.product_id
      and warehouse_id = v_reservation.warehouse_id
      and released_at is null
      and id <> v_reservation.id;
  select coalesce(sum(quantity_delta), 0) into v_on_hand
    from inventory_movements
    where product_id = v_reservation.product_id and warehouse_id = v_reservation.warehouse_id;
  v_available := v_on_hand - v_committed_others;

  if p_quantity > v_available then
    raise exception 'No hay suficiente disponible en ese almacén (disponible: %, solicitado: %).', v_available, p_quantity;
  end if;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;
  v_event_type := case when p_quantity > v_previous_quantity then 'aumentada' else 'reducida' end;

  update inventory_reservations set quantity = p_quantity
    where id = v_reservation.id
    returning * into v_reservation;

  insert into inventory_reservation_events (
    reservation_id, organization_id, order_id, product_id, warehouse_id,
    event_type, previous_quantity, new_quantity, changed_by_user_id, changed_by_name
  ) values (
    v_reservation.id, v_reservation.organization_id, v_reservation.order_id, v_reservation.product_id, v_reservation.warehouse_id,
    v_event_type, v_previous_quantity, p_quantity, v_user_id, coalesce(v_user_name, '—')
  );

  return v_reservation;
end;
$$;

-- rpc_release_inventory_reservation — libera (released_at = ahora) una
-- reserva activa. Nunca la borra — el historial de cuánto se reservó y por
-- cuánto tiempo se conserva.
create or replace function rpc_release_inventory_reservation(
  p_reservation_id uuid
)
returns inventory_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation inventory_reservations;
  v_order_salesperson_id uuid;
  v_user_id uuid := auth.uid();
  v_user_name text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  select * into v_reservation
    from inventory_reservations where id = p_reservation_id and released_at is null
    for update;
  if v_reservation.id is null then
    raise exception 'Reserva activa no encontrada: %', p_reservation_id;
  end if;

  if not is_organization_member(v_reservation.organization_id) then
    raise exception 'Esta reserva no pertenece a tu organización.';
  end if;
  select salesperson_id into v_order_salesperson_id from orders where id = v_reservation.order_id;
  if not current_user_is_admin() and v_order_salesperson_id <> current_user_salesperson_id() then
    raise exception 'No tienes permiso para liberar esta reserva.';
  end if;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

  update inventory_reservations
    set released_at = clock_timestamp(), released_by_user_id = v_user_id, released_by_name = coalesce(v_user_name, '—')
    where id = v_reservation.id
    returning * into v_reservation;

  insert into inventory_reservation_events (
    reservation_id, organization_id, order_id, product_id, warehouse_id,
    event_type, previous_quantity, new_quantity, changed_by_user_id, changed_by_name
  ) values (
    v_reservation.id, v_reservation.organization_id, v_reservation.order_id, v_reservation.product_id, v_reservation.warehouse_id,
    'liberada', v_reservation.quantity, v_reservation.quantity, v_user_id, coalesce(v_user_name, '—')
  );

  return v_reservation;
end;
$$;

-- =========================================================================
-- 4) rpc_inventory_committed_levels — COMMITTED agregado por producto ×
--    almacén = SUMA de reservas ACTIVAS. SECURITY DEFINER con filtro
--    explícito de organización — ver DECISIÓN de visibilidad arriba.
-- =========================================================================
create or replace function rpc_inventory_committed_levels(p_product_id uuid default null)
returns table (product_id uuid, warehouse_id uuid, committed integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid := current_user_organization_id();
begin
  if v_organization_id is null then
    return;
  end if;

  return query
    select ir.product_id, ir.warehouse_id, sum(ir.quantity)::integer
    from inventory_reservations ir
    where ir.organization_id = v_organization_id
      and ir.released_at is null
      and (p_product_id is null or ir.product_id = p_product_id)
    group by ir.product_id, ir.warehouse_id;
end;
$$;

commit;
