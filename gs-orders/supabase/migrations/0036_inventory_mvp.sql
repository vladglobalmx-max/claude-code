-- =========================================================================
-- THÖREN — Fase 6M: Inventory MVP
-- =========================================================================
-- OBJETIVO: primer módulo real de Inventory, conectado con Product
-- Catalog, Orders, Purchasing y las recepciones de Purchase Orders (0035).
-- Modelo de la Master Vision:
--   ON HAND    = existencia física real (SUMA de movimientos, nunca un
--                contador editable — ver DECISIÓN "ledger" abajo).
--   COMMITTED  = inventario comprometido/reservado.
--   AVAILABLE  = ON HAND - COMMITTED.
--   INCOMING   = comprado pero no recibido (derivado de Purchasing).
-- Fuera de alcance: costos, valuación, FIFO/LIFO, lotes, ubicaciones
-- internas, transferencias, picking/packing, consumo automático al
-- completar un Pedido, forecast, reorder point, AI Advisor, contabilidad,
-- cambios a Quotes.
--
-- =========================================================================
-- DECISIÓN — ON HAND es un LEDGER (inventory_movements), nunca un contador
-- =========================================================================
-- Se decidió explícitamente NO mantener una columna "stock actual" en
-- ninguna tabla — eso duplicaría datos que ya pueden resolverse sumando
-- movimientos ("no dupliques datos que puedan resolverse mediante
-- relaciones", regla explícita de esta fase). ON HAND por producto ×
-- almacén = SUM(quantity_delta) de `inventory_movements` — única fuente
-- de verdad, igual criterio que folios/secuencias en fases previas: nunca
-- se confía en un valor cacheado, siempre se deriva. Esto también resuelve
-- trazabilidad (requisito #3) gratis: cada delta ES el historial.
-- No existe una tabla/vista "current stock": la agregación se expone vía
-- funciones de solo lectura (`rpc_inventory_stock_levels`), siguiendo el
-- patrón ya establecido del proyecto de exponer datos vía RPC en vez de
-- introducir un nuevo primitivo (vistas SQL no se usan en ningún otro
-- lugar del proyecto).
--
-- =========================================================================
-- DECISIÓN — inventory_movements es INSERT-only, sin policy de INSERT
-- =========================================================================
-- Mismo criterio que `order_operational_status_history` (0033): "un solo
-- escritor confiable, nunca el cliente directo". La tabla solo tiene
-- policy de SELECT para `authenticated` — todos los INSERT ocurren dentro
-- de funciones SECURITY DEFINER (`rpc_create_inventory_movement`,
-- `rpc_receive_purchase_order_item`) que ya revalidan rol/organización
-- explícitamente antes de escribir. Sin policy de UPDATE/DELETE en
-- absoluto: los movimientos son inmutables por diseño (requisito #3/#10)
-- — una corrección siempre es un movimiento NUEVO compensatorio, nunca una
-- edición del historial.
--
-- =========================================================================
-- DECISIÓN — visibilidad: Inventory es una vista de ORGANIZACIÓN, no de
-- vendedor
-- =========================================================================
-- A diferencia de Purchase Orders (visibilidad heredada del Pedido dueño),
-- el enunciado de esta fase dice "VENDEDOR: solo lectura dentro de los
-- límites actuales de organización/permisos" — sin mencionar restricción
-- por Pedido/vendedor propietario. Inventory es un hecho físico de la
-- organización (cuánto hay en el almacén), no de quién vendió qué: ADMIN y
-- VENDEDOR ven los MISMOS movimientos/existencias de su organización;
-- solo ADMIN puede escribir (gestionar almacenes, registrar movimientos
-- manuales, recibir compras).
--
-- Consecuencia técnica importante: `rpc_inventory_incoming_by_product` e
-- `rpc_inventory_incoming_detail` agregan sobre `purchase_order_items`,
-- cuya RLS SÍ restringe a VENDEDOR a los Pedidos que posee (0035). Si esas
-- funciones corrieran como INVOKER, un VENDEDOR vería un INCOMING
-- incompleto/incorrecto (solo sus propios Pedidos) — inconsistente con
-- "Inventory es de organización". Por eso ambas son SECURITY DEFINER, con
-- el filtro `organization_id = current_user_organization_id()` puesto
-- EXPLÍCITAMENTE dentro de la función (nunca confiando en RLS) para
-- garantizar cero fuga cross-org pese a bypassear la RLS de
-- purchase_order_items.
--
-- =========================================================================
-- DECISIÓN — COMMITTED = 0 en esta fase, arquitectura preparada para 6N
-- =========================================================================
-- Se investigó Orders (`status`/`operational_status`) y NO existe ningún
-- concepto de "confirmado/pagado, listo para surtir" ni ninguna noción de
-- reserva hoy. El enunciado pide explícitamente NO asumir que todo Order
-- confirmado reserva stock, y NO inventar reservas automáticas. No se creó
-- ninguna tabla de reservas en esta fase — construir una sin las reglas de
-- negocio reales (¿qué operational_status dispara la reserva? ¿se libera
-- al completarse o al cancelarse? ¿puede un VENDEDOR reservar
-- manualmente?) sería inventar un modelo no pedido y potencialmente
-- incorrecto. AVAILABLE = ON HAND - COMMITTED se implementa ya con la
-- fórmula real; COMMITTED es literalmente `0` (constante, documentado como
-- tal, nunca una cifra inventada) hasta que 6N defina el modelo de
-- reservas explícitas.
--
-- PROPUESTA para 6N (a discutir con el usuario, no implementada aquí):
-- una tabla `inventory_reservations` (organization_id, product_id,
-- order_id, order_item_id, quantity, created_by, created_at) poblada por
-- una ACCIÓN EXPLÍCITA ("Reservar stock para este Pedido"), nunca
-- automática por cambio de operational_status — evita el riesgo de
-- reservar contra un Pedido que después se cancela o cuyas cantidades
-- cambian. COMMITTED = SUM(quantity) de esa tabla por producto; se
-- libera con otra acción explícita ("Liberar reserva") o al completar el
-- Pedido (a decidir con el usuario). Requiere decisión de negocio sobre
-- si aplica por almacén específico o solo a nivel producto/organización.
--
-- =========================================================================
-- DECISIÓN — warehouses: RLS calcada de business_units, pero con INSERT
-- también ADMIN-only
-- =========================================================================
-- `business_units` (0014) no tiene NINGUNA policy de escritura (solo se
-- crean vía bootstrap/migración) — no aplica tal cual porque el enunciado
-- pide "ADMIN gestiona almacenes" (sí necesita una pantalla real de alta).
-- A diferencia de `customers`/`suppliers` (cualquier miembro activo puede
-- crear), aquí el INSERT también es ADMIN-only — el enunciado dice
-- "gestiona" sin abrir la creación a VENDEDOR, y un almacén es
-- infraestructura operativa, no un catálogo comercial de alta frecuente.
--
-- =========================================================================
-- DECISIÓN — recepción de PO ahora exige almacén, y queda fijo por partida
-- =========================================================================
-- rpc_receive_purchase_order_item (0035) gana un tercer parámetro
-- `p_warehouse_id` (se DROP+CREATE porque cambia la firma). Una vez que
-- una partida registra su primer movimiento de inventario, su almacén de
-- recepción queda fijo (se valida contra `inventory_movements` de esa
-- misma partida, no se duplica un campo "warehouse" en
-- purchase_order_items) — repartir una sola partida entre varios almacenes
-- está fuera de alcance de esta fase (mismo criterio que "no
-- transferencias/ubicaciones internas").
--
-- IDEMPOTENCIA (requisito #4, ejemplo obligatorio): el movimiento se
-- calcula como delta = cantidad_nueva - quantity_received actual (NO un
-- valor absoluto) y solo se inserta si delta ≠ 0 — reejecutar la misma
-- recepción (delta = 0) nunca genera un movimiento nuevo, disminuir la
-- cantidad genera un movimiento compensatorio negativo
-- ('correccion_recepcion'), sin borrar nunca los movimientos anteriores.
-- Se usa `select ... for update` sobre la partida para que dos llamadas
-- concurrentes con el mismo valor nuevo no calculen el mismo delta dos
-- veces (transaccional de verdad, no solo "en la práctica").
-- Una línea manual sin catalog_product_id (0029) NO genera movimiento de
-- inventario — no hay producto de catálogo que rastrear.
--
-- =========================================================================
-- FUERA DE ALCANCE de esta migración (ver enunciado completo de la fase)
-- =========================================================================
-- Costos/valuación/FIFO-LIFO, lotes/series, ubicaciones internas,
-- transferencias entre almacenes, picking/packing, envíos, consumo
-- automático de inventario al completar un Pedido, forecast/reorder
-- point/safety stock/ABC, AI Inventory Advisor, contabilidad/facturas/
-- pagos, cambios a Quotes.
-- =========================================================================

begin;

-- =========================================================================
-- 1) warehouses — catálogo de almacenes por organización
-- =========================================================================
create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  name text not null
    constraint warehouses_name_not_blank check (btrim(name) <> ''),
  code text not null
    constraint warehouses_code_not_blank check (btrim(code) <> ''),
  location text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouses_org_code_unique unique (organization_id, code)
);

create index if not exists warehouses_organization_idx on warehouses (organization_id);

drop trigger if exists trg_warehouses_updated_at on warehouses;
create trigger trg_warehouses_updated_at
  before update on warehouses
  for each row execute function set_updated_at();

alter table warehouses enable row level security;

drop policy if exists "warehouses_select_member" on warehouses;
create policy "warehouses_select_member" on warehouses
  for select using (
    is_organization_admin(organization_id)
    or (is_organization_member(organization_id) and active = true)
  );

drop policy if exists "warehouses_insert_admin" on warehouses;
create policy "warehouses_insert_admin" on warehouses
  for insert with check (is_organization_admin(organization_id));

drop policy if exists "warehouses_update_admin" on warehouses;
create policy "warehouses_update_admin" on warehouses
  for update using (is_organization_admin(organization_id))
  with check (is_organization_admin(organization_id));

-- Sin policy de DELETE — desactivar (active = false) es el único
-- mecanismo, nunca borrado físico.

-- =========================================================================
-- 2) inventory_movements — ledger inmutable, única fuente de verdad de
--    ON HAND (ver DECISIÓN arriba). Solo lo escriben funciones SECURITY
--    DEFINER; ninguna policy de insert/update/delete para `authenticated`.
-- =========================================================================
create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  product_id uuid not null references product_catalog (id) on delete restrict,
  warehouse_id uuid not null references warehouses (id) on delete restrict,
  quantity_delta integer not null check (quantity_delta <> 0),
  movement_type text not null check (movement_type in (
    'recepcion_compra', 'entrada_manual', 'salida_manual',
    'ajuste_positivo', 'ajuste_negativo', 'correccion_recepcion'
  )),
  -- Trazabilidad a la compra de origen — NULL para movimientos manuales.
  purchase_order_id uuid references purchase_orders (id) on delete restrict,
  purchase_order_item_id uuid references purchase_order_items (id) on delete restrict,
  reference text,
  notes text,
  created_by_user_id uuid not null,
  -- Snapshot del nombre de quien registró el movimiento — mismo criterio
  -- que order_operational_status_history.changed_by_name (0033): el
  -- historial no debe cambiar de "autor" si el usuario se renombra después.
  created_by_name text not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint inventory_movements_type_sign check (
    (movement_type in ('entrada_manual', 'ajuste_positivo', 'recepcion_compra') and quantity_delta > 0)
    or
    (movement_type in ('salida_manual', 'ajuste_negativo', 'correccion_recepcion') and quantity_delta < 0)
  ),
  constraint inventory_movements_po_reference check (
    (movement_type in ('recepcion_compra', 'correccion_recepcion')
      and purchase_order_id is not null and purchase_order_item_id is not null)
    or
    (movement_type in ('entrada_manual', 'salida_manual', 'ajuste_positivo', 'ajuste_negativo')
      and purchase_order_id is null and purchase_order_item_id is null)
  )
);

create index if not exists inventory_movements_organization_idx on inventory_movements (organization_id);
create index if not exists inventory_movements_product_warehouse_idx on inventory_movements (product_id, warehouse_id);
create index if not exists inventory_movements_poi_idx on inventory_movements (purchase_order_item_id);
create index if not exists inventory_movements_created_at_idx on inventory_movements (created_at desc);

alter table inventory_movements enable row level security;

drop policy if exists "inventory_movements_select" on inventory_movements;
create policy "inventory_movements_select" on inventory_movements
  for select using (current_user_active() and is_organization_member(organization_id));

-- Sin policy de insert/update/delete — ver DECISIÓN arriba.

-- =========================================================================
-- 3) rpc_inventory_stock_levels — ON HAND agregado por producto × almacén.
--    SECURITY INVOKER (default): la RLS de inventory_movements ya es
--    uniforme por organización (ADMIN y VENDEDOR ven lo mismo, ver
--    DECISIÓN de visibilidad), así que no hace falta bypassearla.
-- =========================================================================
create or replace function rpc_inventory_stock_levels(p_product_id uuid default null)
returns table (product_id uuid, warehouse_id uuid, on_hand integer)
language sql
stable
as $$
  select im.product_id, im.warehouse_id, sum(im.quantity_delta)::integer as on_hand
  from inventory_movements im
  where p_product_id is null or im.product_id = p_product_id
  group by im.product_id, im.warehouse_id;
$$;

-- =========================================================================
-- 4) rpc_inventory_incoming_by_product / rpc_inventory_incoming_detail —
--    INCOMING derivado de Purchase Orders activas (nunca una copia
--    manual). SECURITY DEFINER con filtro explícito de organización — ver
--    DECISIÓN de visibilidad arriba (purchase_order_items tiene RLS más
--    restrictiva que lo que Inventory debe mostrar).
-- =========================================================================
create or replace function rpc_inventory_incoming_by_product()
returns table (product_id uuid, incoming integer)
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
    select poi.catalog_product_id, sum(poi.quantity_ordered - poi.quantity_received)::integer
    from purchase_order_items poi
    join purchase_orders po on po.id = poi.purchase_order_id
    where po.organization_id = v_organization_id
      and po.status <> 'cancelada'
      and poi.catalog_product_id is not null
    group by poi.catalog_product_id;
end;
$$;

create or replace function rpc_inventory_incoming_detail(p_product_id uuid)
returns table (
  purchase_order_id uuid,
  purchase_order_folio text,
  supplier_id uuid,
  supplier_name text,
  order_id uuid,
  order_folio text,
  quantity_pending integer,
  supplier_commitment_date date,
  estimated_reception_date date
)
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
    select po.id, po.folio, s.id, s.name, o.id, o.folio,
           (poi.quantity_ordered - poi.quantity_received)::integer,
           po.supplier_commitment_date, po.estimated_reception_date
    from purchase_order_items poi
    join purchase_orders po on po.id = poi.purchase_order_id
    join suppliers s on s.id = po.supplier_id
    join orders o on o.id = po.order_id
    where poi.catalog_product_id = p_product_id
      and po.organization_id = v_organization_id
      and po.status <> 'cancelada'
      and poi.quantity_ordered > poi.quantity_received
    order by po.created_at desc;
end;
$$;

-- =========================================================================
-- 5) rpc_create_inventory_movement — entradas/salidas/ajustes manuales.
--    Solo ADMIN. Bloquea cualquier operación que deje ON HAND negativo
--    (requisito #5/#10).
-- =========================================================================
create or replace function rpc_create_inventory_movement(
  p_movement_id uuid,
  p_movement jsonb
)
returns inventory_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_movement_type text;
  v_quantity integer;
  v_delta integer;
  v_current_on_hand integer;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_row inventory_movements;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() then
    raise exception 'Solo un administrador puede registrar movimientos manuales de inventario.';
  end if;

  v_organization_id := current_user_organization_id();

  v_product_id := nullif(p_movement->>'product_id', '')::uuid;
  if not exists (select 1 from product_catalog where id = v_product_id and organization_id = v_organization_id) then
    raise exception 'El producto seleccionado no existe o no pertenece a tu organización.';
  end if;

  v_warehouse_id := nullif(p_movement->>'warehouse_id', '')::uuid;
  if not exists (
    select 1 from warehouses where id = v_warehouse_id and organization_id = v_organization_id and active = true
  ) then
    raise exception 'El almacén seleccionado no existe, no pertenece a tu organización, o está inactivo.';
  end if;

  v_movement_type := p_movement->>'movement_type';
  if v_movement_type not in ('entrada_manual', 'salida_manual', 'ajuste_positivo', 'ajuste_negativo') then
    raise exception '"%" no es un tipo de movimiento manual válido.', v_movement_type;
  end if;

  v_quantity := nullif(p_movement->>'quantity', '')::integer;
  if v_quantity is null or v_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero.';
  end if;

  v_delta := case when v_movement_type in ('entrada_manual', 'ajuste_positivo') then v_quantity else -v_quantity end;

  if v_delta < 0 then
    select coalesce(sum(quantity_delta), 0) into v_current_on_hand
      from inventory_movements
      where product_id = v_product_id and warehouse_id = v_warehouse_id;
    if v_current_on_hand + v_delta < 0 then
      raise exception 'La operación dejaría On Hand negativo en ese almacén (actual: %, solicitado: %).', v_current_on_hand, -v_delta;
    end if;
  end if;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

  insert into inventory_movements (
    id, organization_id, product_id, warehouse_id, quantity_delta, movement_type,
    reference, notes, created_by_user_id, created_by_name
  ) values (
    p_movement_id, v_organization_id, v_product_id, v_warehouse_id, v_delta, v_movement_type,
    nullif(p_movement->>'reference', ''), nullif(p_movement->>'notes', ''),
    v_user_id, coalesce(v_user_name, '—')
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- =========================================================================
-- 6) rpc_receive_purchase_order_item — se DROP+CREATE porque cambia de
--    firma (gana p_warehouse_id). Ahora también SECURITY DEFINER: escribe
--    en inventory_movements, que no tiene policy de insert para
--    `authenticated` (ver DECISIÓN arriba) — el chequeo de rol/organización
--    sigue siendo explícito dentro de la función, nunca delegado a RLS.
-- =========================================================================
drop function if exists rpc_receive_purchase_order_item(uuid, integer);

create or replace function rpc_receive_purchase_order_item(
  p_purchase_order_item_id uuid,
  p_quantity_received integer,
  p_warehouse_id uuid
)
returns purchase_order_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item purchase_order_items;
  v_po_id uuid;
  v_po_status text;
  v_po_organization_id uuid;
  v_quantity_ordered integer;
  v_previous_received integer;
  v_product_id uuid;
  v_delta integer;
  v_total_items integer;
  v_fully_received_items integer;
  v_any_received_items integer;
  v_existing_warehouse_id uuid;
  v_current_on_hand integer;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_movement_type text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() then
    raise exception 'Solo un administrador puede registrar recepción de mercancía.';
  end if;

  -- `for update` — evita que dos llamadas concurrentes con el mismo valor
  -- nuevo calculen el mismo delta dos veces (idempotencia real, no solo
  -- "en la práctica").
  select purchase_order_id, quantity_ordered, quantity_received, catalog_product_id
    into v_po_id, v_quantity_ordered, v_previous_received, v_product_id
    from purchase_order_items where id = p_purchase_order_item_id
    for update;
  if v_po_id is null then
    raise exception 'Partida de Purchase Order no encontrada: %', p_purchase_order_item_id;
  end if;

  select status, organization_id into v_po_status, v_po_organization_id from purchase_orders where id = v_po_id;
  if v_po_status = 'borrador' then
    raise exception 'No se puede registrar recepción de una Purchase Order en borrador — primero debe marcarse como Ordenada.';
  end if;
  if v_po_status = 'cancelada' then
    raise exception 'No se puede registrar recepción de una Purchase Order cancelada.';
  end if;

  if p_quantity_received < 0 or p_quantity_received > v_quantity_ordered then
    raise exception 'La cantidad recibida (%) no puede ser negativa ni mayor a la cantidad ordenada (%).', p_quantity_received, v_quantity_ordered;
  end if;

  -- THÖREN Fase 6M — una línea manual sin catalog_product_id (0029) no
  -- tiene producto de catálogo que rastrear: no genera movimiento.
  if v_product_id is not null then
    if p_warehouse_id is null or not exists (
      select 1 from warehouses where id = p_warehouse_id and organization_id = v_po_organization_id and active = true
    ) then
      raise exception 'Debes seleccionar un almacén activo de tu organización para registrar la recepción.';
    end if;

    select warehouse_id into v_existing_warehouse_id
      from inventory_movements where purchase_order_item_id = p_purchase_order_item_id limit 1;
    if v_existing_warehouse_id is not null and v_existing_warehouse_id <> p_warehouse_id then
      raise exception 'Esta partida ya se recibió en otro almacén; no se puede cambiar el almacén de recepción.';
    end if;

    v_delta := p_quantity_received - v_previous_received;

    if v_delta <> 0 then
      if v_delta < 0 then
        select coalesce(sum(quantity_delta), 0) into v_current_on_hand
          from inventory_movements where product_id = v_product_id and warehouse_id = p_warehouse_id;
        if v_current_on_hand + v_delta < 0 then
          raise exception 'La corrección dejaría On Hand negativo en ese almacén (actual: %, ajuste: %).', v_current_on_hand, v_delta;
        end if;
        v_movement_type := 'correccion_recepcion';
      else
        v_movement_type := 'recepcion_compra';
      end if;

      select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

      insert into inventory_movements (
        organization_id, product_id, warehouse_id, quantity_delta, movement_type,
        purchase_order_id, purchase_order_item_id, created_by_user_id, created_by_name
      ) values (
        v_po_organization_id, v_product_id, p_warehouse_id, v_delta, v_movement_type,
        v_po_id, p_purchase_order_item_id, v_user_id, coalesce(v_user_name, '—')
      );
    end if;
    -- v_delta = 0 (reejecutar la misma recepción) -> ningún movimiento nuevo.
  end if;

  update purchase_order_items set quantity_received = p_quantity_received
    where id = p_purchase_order_item_id
    returning * into v_item;

  select
    count(*),
    count(*) filter (where quantity_received >= quantity_ordered),
    count(*) filter (where quantity_received > 0)
    into v_total_items, v_fully_received_items, v_any_received_items
    from purchase_order_items where purchase_order_id = v_po_id;

  if v_total_items > 0 and v_fully_received_items = v_total_items then
    update purchase_orders set status = 'recibida' where id = v_po_id;
  elsif v_any_received_items > 0 then
    update purchase_orders set status = 'recibida_parcial' where id = v_po_id;
  else
    update purchase_orders set status = pre_receiving_status where id = v_po_id;
  end if;

  return v_item;
end;
$$;

commit;
