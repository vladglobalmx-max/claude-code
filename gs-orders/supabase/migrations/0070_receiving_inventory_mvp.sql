-- THÖREN 0070 — Receiving + Inventory MVP.
--
-- =========================================================================
-- DECISIÓN DE ALCANCE (autorizada explícitamente por el usuario antes de
-- implementar) — "adaptar el ticket al modelo actual" en vez de construir
-- un segundo sistema paralelo:
-- =========================================================================
-- El ticket original pide crear `warehouses`, `inventory_movements` y un
-- flujo PO -> Recepción -> Goods Receipt -> Inventory Movement -> Stock
-- como si nada de esto existiera. Verificado contra el repo real: NO es
-- así.
--   - `warehouses` (0036) YA existe — mismos campos pedidos
--     (organization_id/code/name/active/created_at/updated_at) más
--     location/notes. NO se recrea.
--   - `inventory_movements` (0036) YA existe como ledger inmutable, ÚNICA
--     fuente de verdad de ON HAND (mismo espíritu exacto que pide el
--     ticket) — columnas equivalentes (product_id en vez de
--     catalog_product_id, movement_type ya incluye 'recepcion_compra',
--     purchase_order_id/purchase_order_item_id ya existen). NO se toca su
--     esquema ni su vocabulario de movement_type.
--   - `rpc_receive_purchase_order_item` (0035/0036/0044) YA implementa,
--     probado y usado en producción: recepción acumulada (no delta),
--     recepciones parciales, bloqueo de over-receipt, bloqueo de PO
--     'borrador'/'cancelada', generación de inventory_movements, y
--     DERIVACIÓN del status de la PO ('recibida'/'recibida_parcial') sin
--     mezclar eso con el status de aprobación (ordenada/confirmada/
--     en_transito siguen intactos como transiciones MANUALES separadas,
--     ver pre_receiving_status) — esto YA es exactamente la regla "NO
--     mezclar approval status con receiving status" del ticket.
--   - `/inventario` + `/inventario/[id]` YA son la "Inventory UI mínima"
--     pedida (vista por producto/almacén/existencia, sin reservas/
--     picking/packing/lotes/costeo) — no se reconstruye.
--
-- LO QUE SÍ TIENE VALOR REAL Y NO EXISTÍA (esto es lo que agrega 0070):
--   1. Un DOCUMENTO de recepción (`goods_receipts`/`goods_receipt_items`)
--      con folio propio, ciclo draft -> posted -> cancelled, y captura de
--      varias líneas en una sola sesión antes de comprometerlas — hoy la
--      recepción es SIEMPRE inmediata línea por línea, sin borrador ni
--      referencia de documento del proveedor. Esto es justo el "folio/
--      documento ligero de recepción" que se autorizó explícitamente.
--   2. Una RPC transaccional (`rpc_post_goods_receipt`) que resuelve TODAS
--      las líneas de una recepción en una sola transacción, delegando el
--      trabajo real de inventario a `rpc_receive_purchase_order_item` YA
--      existente (nunca se duplica su lógica de negativo/over-receipt/
--      warehouse-lock/derivación de status) — un solo mecanismo real por
--      debajo, dos puntos de entrada (el rápido por línea ya existente, y
--      el nuevo por documento). Ver DECISIÓN de UI más abajo sobre cuál
--      se deja visible.
--   3. Una rama de visibilidad para `can_receive_inventory` en
--      `purchase_orders_select`/`purchase_order_items_select` — GAP
--      PRE-EXISTENTE encontrado en la auditoría: ninguna de las dos
--      policies (0035/0041/0069) tenía una rama para
--      `can_receive_inventory`, así que un usuario con SOLO esa capability
--      (sin ser admin, sin ser dueño del Pedido, sin can_view_all_sales/
--      can_prepare_purchase_orders) no podía ver la Purchase Order en
--      absoluto — el propio botón "Recibir mercancía" habría sido
--      inalcanzable para el rol al que está dirigido. Corregido aquí
--      porque es un prerrequisito directo para que 0070 funcione, no un
--      refactor general.
--
-- NO se crea `inventory_balances`: el cálculo en vivo
--     (`rpc_inventory_stock_levels`, SUM sobre inventory_movements) ya es
--     la única fuente de verdad y no hay evidencia de que sea lento a
--     escala MVP — materializarlo introduciría una segunda copia que
--     mantener sincronizada sin necesidad real (el propio ticket lo
--     condicionaba a "si el cálculo en vivo es lento").
-- NO se inventan nuevos movement_type — se reutiliza 'recepcion_compra'
--     tal cual existe.
-- NO se toca `purchase_orders.status` ni sus transiciones — el estado de
--     recepción derivado (recibida/recibida_parcial) ya vive ahí desde
--     0035/0036, reutilizado tal cual por rpc_post_goods_receipt (vía
--     rpc_receive_purchase_order_item).
--
-- =========================================================================
-- DECISIÓN DE UI — consolidar en UN solo punto de entrada:
-- =========================================================================
-- El ticket pide explícitamente "Desde detalle de Purchase Order: botón
-- Recibir mercancía" (un botón, no inputs en línea por partida). Mantener
-- AMBAS UI (el formulario en línea por partida ya existente Y el nuevo
-- flujo de documento) habría sido exactamente el "segundo sistema
-- paralelo" que se pidió evitar, esta vez a nivel de UX en vez de esquema.
-- Se retira `ReceiveItemForm`/su columna de `/compras/[id]` y se reemplaza
-- por el botón "Recibir mercancía" -> `/recepciones/nueva?purchase_order_id=`.
-- La RPC `rpc_receive_purchase_order_item` en sí NO se toca ni se retira —
-- sigue siendo la única pieza que de verdad mueve inventario, ahora
-- invocada exclusivamente desde `rpc_post_goods_receipt`.
--
-- =========================================================================
-- DECISIÓN — cancelar una recepción posted: el ticket ofrece
-- explícitamente la opción MVP de impedirlo ("para MVP puede impedirse
-- cancelar una recepción ya posted si simplifica y mantiene integridad").
-- Se toma esa opción: `rpc_cancel_goods_receipt` solo opera sobre 'draft'.
-- Revertir una recepción posted (movimiento inverso explícito) queda fuera
-- de 0070 — anotado como riesgo/decisión en el reporte final.
--
-- =========================================================================
-- DECISIÓN — autoridad: se reutiliza `can_receive_inventory` (0044,
-- existente) para todo el ciclo de vida de una recepción — el ticket pide
-- "reutilizar capability apropiada", y esta ya es exactamente esa
-- capability. Para "consultar inventario" no se crea ninguna capability
-- nueva: Inventory (inventory_movements_select, 0036) ya es visible a
-- CUALQUIER miembro activo de la organización sin gate de capability —
-- goods_receipts/goods_receipt_items/goods_receipt_events se modelan con
-- el MISMO criterio de visibilidad (documento hermano del ledger, mismo
-- nivel de apertura), en vez de reproducir la lógica de 5 ramas de
-- purchase_orders_select con un capability distinto para cada consulta.
--
-- Como el resto del proyecto: idempotente (create table if not exists,
-- drop+create para policies/funciones) y corre completa en una
-- transacción (begin/commit).

begin;

-- =========================================================================
-- 1) goods_receipt_sequences — motor de receipt_number, mismo patrón que
--    purchase_order_sequences/purchase_requisition_sequences (0069), CON
--    el endurecimiento de auditoría de 0069 aplicado desde el día uno:
--    REVOKE PUBLIC + GRANT authenticated explícitos en fn_next_goods_receipt_number
--    (el guard `is_organization_member(p_organization_id)` interno ya
--    bastaba —confirmado idéntico en fn_next_purchase_order_folio/
--    fn_next_purchase_requisition_number— pero se agrega la capa de
--    permisos de Postgres como defensa en profundidad adicional, tal como
--    pide explícitamente el checklist de SECURITY DEFINER de este ticket).
-- =========================================================================
create table if not exists goods_receipt_sequences (
  organization_id uuid primary key references organizations (id) on delete restrict,
  prefix text not null default 'GR'
    constraint goods_receipt_sequences_prefix_format check (prefix = upper(prefix))
    constraint goods_receipt_sequences_prefix_charset check (prefix ~ '^[A-Z0-9-]+$')
    constraint goods_receipt_sequences_prefix_length check (char_length(prefix) between 1 and 20),
  sequence_current integer not null default 0 check (sequence_current >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table goods_receipt_sequences enable row level security;

drop policy if exists "goods_receipt_sequences_select_admin" on goods_receipt_sequences;
create policy "goods_receipt_sequences_select_admin" on goods_receipt_sequences
  for select using (is_organization_admin(organization_id));

create or replace function fn_next_goods_receipt_number(
  p_organization_id uuid,
  p_date date
) returns table (receipt_number text, sequence_number integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_seq integer;
  v_date_part text;
begin
  if not is_organization_member(p_organization_id) then
    raise exception 'fn_next_goods_receipt_number: no tienes permiso para generar un número de recepción de esta organización.';
  end if;

  insert into goods_receipt_sequences (organization_id)
    values (p_organization_id)
    on conflict (organization_id) do nothing;

  update goods_receipt_sequences
    set sequence_current = sequence_current + 1
    where organization_id = p_organization_id
    returning sequence_current, prefix into v_seq, v_prefix;

  v_date_part := to_char(p_date, 'YYYY') || to_char(p_date, 'DD') || to_char(p_date, 'MM');
  return query select v_prefix || '-' || v_date_part || '-' || lpad(v_seq::text, 3, '0'), v_seq;
end;
$$;

revoke all on function fn_next_goods_receipt_number(uuid, date) from public;
grant execute on function fn_next_goods_receipt_number(uuid, date) to authenticated;

-- =========================================================================
-- 2) goods_receipts — encabezado del documento de recepción.
-- =========================================================================
create table if not exists goods_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  receipt_number text not null,
  sequence_number integer not null,
  purchase_order_id uuid not null references purchase_orders (id) on delete restrict,
  warehouse_id uuid not null references warehouses (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'posted', 'cancelled')),
  received_at date not null default current_date,
  received_by uuid not null references auth.users (id) on delete restrict,
  supplier_document_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists goods_receipts_number_unique on goods_receipts (organization_id, receipt_number);
create index if not exists goods_receipts_organization_idx on goods_receipts (organization_id);
create index if not exists goods_receipts_purchase_order_idx on goods_receipts (purchase_order_id);
create index if not exists goods_receipts_status_idx on goods_receipts (status);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_goods_receipts_updated_at') then
    create trigger trg_goods_receipts_updated_at
      before update on goods_receipts
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 3) goods_receipt_items — líneas. purchase_order_item_id NOT NULL: toda
--    línea de recepción viene de una partida real de la PO de esta
--    recepción (validado en trigger, sección 8). catalog_product_id se
--    copia de esa partida (regla 12 — línea libre soportada, nunca
--    inventa un producto para ella).
-- =========================================================================
create table if not exists goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references goods_receipts (id) on delete cascade,
  purchase_order_item_id uuid not null references purchase_order_items (id) on delete restrict,
  catalog_product_id uuid references product_catalog (id) on delete set null,
  description_snapshot text not null constraint goods_receipt_items_description_not_blank check (btrim(description_snapshot) <> ''),
  uom_snapshot text,
  quantity_received integer not null check (quantity_received > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goods_receipt_items_unique_po_item unique (goods_receipt_id, purchase_order_item_id)
);

create index if not exists goods_receipt_items_receipt_idx on goods_receipt_items (goods_receipt_id);
create index if not exists goods_receipt_items_po_item_idx on goods_receipt_items (purchase_order_item_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_goods_receipt_items_updated_at') then
    create trigger trg_goods_receipt_items_updated_at
      before update on goods_receipt_items
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 4) goods_receipt_events — historial mínimo, inmutable (solo INSERT).
--    Mismo criterio que sales_order_financial_events (0068)/
--    purchase_requisition_events (0069): sin infraestructura de audit log
--    genérica, historial por dominio. Complementa (no reemplaza) el ledger
--    real de inventory_movements, que ya trae su propia trazabilidad.
-- =========================================================================
create table if not exists goods_receipt_events (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references goods_receipts (id) on delete cascade,
  event_type text not null check (event_type in ('created', 'posted', 'cancelled')),
  notes text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists goods_receipt_events_receipt_idx on goods_receipt_events (goods_receipt_id);

-- =========================================================================
-- 5) Trigger: inmutabilidad de identidad de goods_receipts
--    (receipt_number/sequence_number/organization_id/purchase_order_id)
--    — siempre, sin excepción de status. warehouse_id/received_at/
--    supplier_document_number/notes SÍ son editables mientras 'draft'
--    (ver rpc_update_goods_receipt).
-- =========================================================================
create or replace function trg_prevent_goods_receipt_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.receipt_number is distinct from old.receipt_number then
    raise exception 'El número de una recepción de mercancía no se puede modificar (%).', old.receipt_number;
  end if;
  if new.sequence_number is distinct from old.sequence_number then
    raise exception 'El consecutivo de una recepción de mercancía no se puede modificar.';
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'La organización de una recepción de mercancía no se puede modificar.';
  end if;
  if new.purchase_order_id is distinct from old.purchase_order_id then
    raise exception 'La Purchase Order de origen de una recepción de mercancía no se puede modificar.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_goods_receipts_prevent_identity_change on goods_receipts;
create trigger trg_goods_receipts_prevent_identity_change
  before update on goods_receipts
  for each row execute function trg_prevent_goods_receipt_identity_change();

-- =========================================================================
-- 6) Trigger: elegibilidad al crear (regla 1/2) — SOLO en INSERT, nunca
--    revalida retroactivamente si la PO cambia de estado después (mismo
--    criterio que 0066/0067/0069). rpc_post_goods_receipt (sección 15)
--    revalida la PO OTRA VEZ en vivo al postear — esa es la autoridad real
--    para el momento que de verdad importa.
-- =========================================================================
create or replace function trg_check_goods_receipt_eligible()
returns trigger
language plpgsql
as $$
declare
  v_po_org uuid;
  v_po_status text;
  v_wh_org uuid;
  v_wh_active boolean;
begin
  select organization_id, status into v_po_org, v_po_status
    from purchase_orders where id = new.purchase_order_id;
  if v_po_org is null then
    raise exception 'goods_receipts: Purchase Order % no existe o no es visible para tu usuario.', new.purchase_order_id;
  end if;
  if new.organization_id is distinct from v_po_org then
    raise exception 'goods_receipts: organization_id (%) no coincide con la organización de la Purchase Order (%).', new.organization_id, v_po_org;
  end if;
  if v_po_status = 'borrador' then
    raise exception 'No se puede recibir mercancía contra una Purchase Order todavía en borrador.';
  end if;
  if v_po_status = 'cancelada' then
    raise exception 'No se puede recibir mercancía contra una Purchase Order cancelada.';
  end if;

  select organization_id, active into v_wh_org, v_wh_active from warehouses where id = new.warehouse_id;
  if v_wh_org is null then
    raise exception 'goods_receipts: Almacén % no existe.', new.warehouse_id;
  end if;
  if v_wh_org is distinct from new.organization_id then
    raise exception 'El almacén seleccionado no pertenece a tu organización.';
  end if;
  if not v_wh_active then
    raise exception 'El almacén seleccionado está inactivo.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_goods_receipts_eligible on goods_receipts;
create trigger trg_goods_receipts_eligible
  before insert on goods_receipts
  for each row execute function trg_check_goods_receipt_eligible();

-- =========================================================================
-- 7) Trigger: máquina de estados de goods_receipts. draft -> posted |
--    cancelled; ambos terminales (rule 8: "una recepción posted debe ser
--    inmutable" — ni siquiera puede volver a 'draft' ni cancelarse desde
--    aquí; rpc_cancel_goods_receipt además solo opera sobre 'draft').
-- =========================================================================
create or replace function trg_goods_receipt_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (old.status = 'draft' and new.status in ('posted', 'cancelled')) then
      raise exception 'Transición de estado inválida para una recepción de mercancía: % -> %.', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_goods_receipts_status_transition on goods_receipts;
create trigger trg_goods_receipts_status_transition
  before update on goods_receipts
  for each row execute function trg_goods_receipt_status_transition();

-- =========================================================================
-- 8) Triggers de goods_receipt_items:
--    a) validación por línea: pertenencia a la MISMA PO de la recepción,
--       consistencia de catalog_product_id con la partida de origen, y
--       tope "no exceder lo ordenado" usando purchase_order_items.
--       quantity_received actual (regla 4) — validación de UX en draft;
--       la autoridad real es rpc_post_goods_receipt ->
--       rpc_receive_purchase_order_item, que revalida esto mismo en vivo
--       al momento de postear (dos recepciones draft simultáneas para la
--       misma partida pueden ambas pasar este check; solo UNA podrá
--       postear dentro del remanente real — comportamiento esperado,
--       documentado en el reporte).
--    b) congelamiento total fuera de 'draft' (regla 8): ninguna columna
--       de una línea de recepción cambia, y tampoco se puede borrar, una
--       vez que la recepción sale de draft — a diferencia de
--       purchase_requisition_items (0069), aquí no existe una columna que
--       legítimamente siga cambiando después (quantity_received de la
--       recepción NUNCA se re-edita tras postear), así que el freeze es
--       total, no parcial.
-- =========================================================================
create or replace function trg_check_goods_receipt_item_quantity()
returns trigger
language plpgsql
as $$
declare
  v_gr_po_id uuid;
  v_poi_po_id uuid;
  v_poi_catalog_product_id uuid;
  v_poi_quantity_ordered integer;
  v_poi_quantity_received integer;
begin
  select purchase_order_id into v_gr_po_id from goods_receipts where id = new.goods_receipt_id;
  if v_gr_po_id is null then
    raise exception 'goods_receipt_items: recepción % no encontrada.', new.goods_receipt_id;
  end if;

  select purchase_order_id, catalog_product_id, quantity_ordered, quantity_received
    into v_poi_po_id, v_poi_catalog_product_id, v_poi_quantity_ordered, v_poi_quantity_received
    from purchase_order_items where id = new.purchase_order_item_id;
  if v_poi_po_id is null then
    raise exception 'goods_receipt_items: partida % no encontrada.', new.purchase_order_item_id;
  end if;
  if v_poi_po_id <> v_gr_po_id then
    raise exception 'La partida % no pertenece a la Purchase Order de esta recepción.', new.purchase_order_item_id;
  end if;
  if new.catalog_product_id is distinct from v_poi_catalog_product_id then
    raise exception 'catalog_product_id de la línea de recepción debe coincidir con el de su partida de origen.';
  end if;

  if v_poi_quantity_received + new.quantity_received > v_poi_quantity_ordered then
    raise exception
      'La partida % ya tiene % unidad(es) recibida(s) (de % ordenadas) — esta recepción no puede agregar % más.',
      new.purchase_order_item_id, v_poi_quantity_received, v_poi_quantity_ordered, new.quantity_received;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_goods_receipt_items_check_quantity on goods_receipt_items;
create trigger trg_goods_receipt_items_check_quantity
  before insert or update of purchase_order_item_id, quantity_received, catalog_product_id
  on goods_receipt_items
  for each row execute function trg_check_goods_receipt_item_quantity();

create or replace function trg_goods_receipt_item_freeze()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from goods_receipts where id = coalesce(new.goods_receipt_id, old.goods_receipt_id);
  if v_status <> 'draft' then
    raise exception 'No se puede modificar ni eliminar una línea de recepción de mercancía fuera de status draft (actual: %).', v_status;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_goods_receipt_items_freeze on goods_receipt_items;
create trigger trg_goods_receipt_items_freeze
  before update or delete on goods_receipt_items
  for each row execute function trg_goods_receipt_item_freeze();

-- =========================================================================
-- 9) RLS — goods_receipts / goods_receipt_items / goods_receipt_events.
--    SELECT abierto a cualquier miembro activo de la organización (mismo
--    criterio exacto que inventory_movements_select, 0036 — "Inventory es
--    una vista de organización, no de vendedor/Pedido propio", y un
--    documento de recepción es del mismo nivel que su propio ledger).
--    Escritura (insert/update mientras draft) exige can_receive_inventory
--    o admin. Sin policy de DELETE (cancelar es el único mecanismo, mismo
--    criterio que purchase_orders/purchase_requisitions).
-- =========================================================================
alter table goods_receipts enable row level security;

drop policy if exists "goods_receipts_select" on goods_receipts;
create policy "goods_receipts_select" on goods_receipts
  for select using (current_user_active() and is_organization_member(organization_id));

drop policy if exists "goods_receipts_insert" on goods_receipts;
create policy "goods_receipts_insert" on goods_receipts
  for insert with check (
    current_user_active()
    and is_organization_member(organization_id)
    and status = 'draft'
    and (current_user_is_admin() or current_user_has_capability('can_receive_inventory'))
  );

drop policy if exists "goods_receipts_update" on goods_receipts;
create policy "goods_receipts_update" on goods_receipts
  for update using (
    current_user_active()
    and is_organization_member(organization_id)
    and (current_user_is_admin() or current_user_has_capability('can_receive_inventory'))
  )
  with check (
    current_user_active()
    and is_organization_member(organization_id)
    and (current_user_is_admin() or current_user_has_capability('can_receive_inventory'))
  );

alter table goods_receipt_items enable row level security;

drop policy if exists "goods_receipt_items_select" on goods_receipt_items;
create policy "goods_receipt_items_select" on goods_receipt_items
  for select using (
    exists (
      select 1 from goods_receipts gr
      where gr.id = goods_receipt_items.goods_receipt_id
        and current_user_active() and is_organization_member(gr.organization_id)
    )
  );

drop policy if exists "goods_receipt_items_insert_draft" on goods_receipt_items;
create policy "goods_receipt_items_insert_draft" on goods_receipt_items
  for insert with check (
    exists (
      select 1 from goods_receipts gr
      where gr.id = goods_receipt_items.goods_receipt_id
        and is_organization_member(gr.organization_id)
        and gr.status = 'draft'
        and (current_user_is_admin() or current_user_has_capability('can_receive_inventory'))
    )
  );

-- UPDATE sin restricción de status en RLS a propósito (mismo criterio que
-- purchase_requisition_items_update, 0069): el congelamiento real fuera de
-- 'draft' lo impone trg_goods_receipt_items_freeze (sección 8) — sin esta
-- policy, un intento de UPDATE sobre una línea posteada afectaría 0 filas
-- en silencio (RLS lo filtraría antes de que el trigger pueda dar un
-- mensaje claro de "recepción inmutable").
drop policy if exists "goods_receipt_items_update" on goods_receipt_items;
create policy "goods_receipt_items_update" on goods_receipt_items
  for update using (
    exists (
      select 1 from goods_receipts gr
      where gr.id = goods_receipt_items.goods_receipt_id
        and is_organization_member(gr.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_receive_inventory'))
    )
  )
  with check (
    exists (
      select 1 from goods_receipts gr
      where gr.id = goods_receipt_items.goods_receipt_id
        and is_organization_member(gr.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_receive_inventory'))
    )
  );

drop policy if exists "goods_receipt_items_delete_draft" on goods_receipt_items;
create policy "goods_receipt_items_delete_draft" on goods_receipt_items
  for delete using (
    exists (
      select 1 from goods_receipts gr
      where gr.id = goods_receipt_items.goods_receipt_id
        and is_organization_member(gr.organization_id)
        and gr.status = 'draft'
        and (current_user_is_admin() or current_user_has_capability('can_receive_inventory'))
    )
  );

alter table goods_receipt_events enable row level security;

drop policy if exists "goods_receipt_events_select" on goods_receipt_events;
create policy "goods_receipt_events_select" on goods_receipt_events
  for select using (
    exists (
      select 1 from goods_receipts gr
      where gr.id = goods_receipt_events.goods_receipt_id
        and current_user_active() and is_organization_member(gr.organization_id)
    )
  );

drop policy if exists "goods_receipt_events_insert" on goods_receipt_events;
create policy "goods_receipt_events_insert" on goods_receipt_events
  for insert with check (
    exists (
      select 1 from goods_receipts gr
      where gr.id = goods_receipt_events.goods_receipt_id
        and is_organization_member(gr.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_receive_inventory'))
    )
  );

-- =========================================================================
-- 10) RLS — purchase_orders / purchase_order_items: GAP PRE-EXISTENTE
--     (ver DECISIÓN de cabecera) — se agrega la rama can_receive_inventory
--     que nunca existió. Reemplaza las policies de 0069, agregando una
--     rama más — el resto queda carácter por carácter igual.
-- =========================================================================
drop policy if exists "purchase_orders_select" on purchase_orders;
create policy "purchase_orders_select" on purchase_orders
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.id = purchase_orders.order_id
          and o.salesperson_id = current_user_salesperson_id()
      )
      or fn_purchase_order_requisition_owner_salesperson(purchase_orders.id) = current_user_salesperson_id()
      or current_user_has_capability('can_view_all_sales')
      or current_user_has_capability('can_receive_inventory')
    )
  );

drop policy if exists "purchase_order_items_select" on purchase_order_items;
create policy "purchase_order_items_select" on purchase_order_items
  for select using (
    current_user_active() and exists (
      select 1 from purchase_orders po
      where po.id = purchase_order_items.purchase_order_id
        and is_organization_member(po.organization_id)
        and (
          current_user_is_admin()
          or exists (
            select 1 from orders o
            where o.id = po.order_id
              and o.salesperson_id = current_user_salesperson_id()
          )
          or fn_requisition_item_owner_salesperson(purchase_order_items.purchase_requisition_item_id) = current_user_salesperson_id()
          or current_user_has_capability('can_view_all_sales')
          or current_user_has_capability('can_receive_inventory')
        )
    )
  );

-- =========================================================================
-- 11) rpc_create_goods_receipt — SECURITY INVOKER. Crea encabezado +
--     líneas en una transacción. organization_id/received_by SIEMPRE
--     resueltos server-side. Snapshot de catalog_product_id/description/
--     uom SIEMPRE copiado de la partida de PO de origen en este momento
--     (MASTER DATA vs SNAPSHOT, mismo patrón que 0066/0067/0069) — nunca
--     vuelto a leer después.
-- =========================================================================
create or replace function rpc_create_goods_receipt(
  p_goods_receipt_id uuid,
  p_goods_receipt jsonb,
  p_items jsonb default '[]'::jsonb
)
returns goods_receipts
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_gr goods_receipts;
  v_organization_id uuid;
  v_purchase_order_id uuid := nullif(p_goods_receipt->>'purchase_order_id', '')::uuid;
  v_warehouse_id uuid := nullif(p_goods_receipt->>'warehouse_id', '')::uuid;
  v_received_at date := coalesce(nullif(p_goods_receipt->>'received_at', '')::date, current_date);
  v_supplier_document_number text := nullif(p_goods_receipt->>'supplier_document_number', '');
  v_notes text := nullif(p_goods_receipt->>'notes', '');
  v_number_result record;
  v_item jsonb;
  v_poi_id uuid;
  v_qty integer;
  v_poi_catalog_product_id uuid;
  v_poi_model text;
  v_poi_description text;
  v_poi_unit text;
  v_poi_po_id uuid;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_receive_inventory')) then
    raise exception 'Solo un administrador o un usuario con autoridad de recepción de inventario puede crear una recepción de mercancía.';
  end if;
  if v_purchase_order_id is null then
    raise exception 'Debe indicarse la Purchase Order de origen.';
  end if;
  if v_warehouse_id is null then
    raise exception 'Debe indicarse el almacén de recepción.';
  end if;

  v_organization_id := current_user_organization_id();

  select * into v_number_result from fn_next_goods_receipt_number(v_organization_id, v_received_at);

  insert into goods_receipts (
    id, organization_id, receipt_number, sequence_number, purchase_order_id, warehouse_id,
    status, received_at, received_by, supplier_document_number, notes
  ) values (
    p_goods_receipt_id, v_organization_id, v_number_result.receipt_number, v_number_result.sequence_number,
    v_purchase_order_id, v_warehouse_id, 'draft', v_received_at, auth.uid(), v_supplier_document_number, v_notes
  )
  returning * into v_gr;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_poi_id := nullif(v_item->>'purchase_order_item_id', '')::uuid;
    v_qty := nullif(v_item->>'quantity_received', '')::integer;

    if v_poi_id is null then
      raise exception 'Cada línea debe indicar de qué partida de la Purchase Order proviene.';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'La cantidad recibida de cada línea debe ser mayor a cero.';
    end if;

    select purchase_order_id, catalog_product_id, model, description, unit
      into v_poi_po_id, v_poi_catalog_product_id, v_poi_model, v_poi_description, v_poi_unit
      from purchase_order_items where id = v_poi_id;
    if v_poi_po_id is null then
      raise exception 'La partida % no existe.', v_poi_id;
    end if;
    if v_poi_po_id <> v_purchase_order_id then
      raise exception 'La partida % no pertenece a la Purchase Order de esta recepción.', v_poi_id;
    end if;

    insert into goods_receipt_items (
      goods_receipt_id, purchase_order_item_id, catalog_product_id, description_snapshot, uom_snapshot, quantity_received
    ) values (
      v_gr.id, v_poi_id, v_poi_catalog_product_id, coalesce(v_poi_description, v_poi_model), v_poi_unit, v_qty
    );
  end loop;

  insert into goods_receipt_events (goods_receipt_id, event_type, created_by)
    values (v_gr.id, 'created', auth.uid());

  return v_gr;
end;
$$;

-- =========================================================================
-- 12) rpc_update_goods_receipt — SECURITY INVOKER. Solo mientras
--     status = 'draft' (verificado dentro del RPC, además de RLS/trigger).
--     Reemplaza almacén/fecha/documento del proveedor/notas + set completo
--     de líneas en la MISMA transacción (DELETE + INSERT).
-- =========================================================================
create or replace function rpc_update_goods_receipt(
  p_goods_receipt_id uuid,
  p_goods_receipt jsonb,
  p_items jsonb default '[]'::jsonb
)
returns goods_receipts
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_gr goods_receipts;
  v_current_status text;
  v_warehouse_id uuid := nullif(p_goods_receipt->>'warehouse_id', '')::uuid;
  v_received_at date := coalesce(nullif(p_goods_receipt->>'received_at', '')::date, current_date);
  v_supplier_document_number text := nullif(p_goods_receipt->>'supplier_document_number', '');
  v_notes text := nullif(p_goods_receipt->>'notes', '');
  v_item jsonb;
  v_poi_id uuid;
  v_qty integer;
  v_poi_catalog_product_id uuid;
  v_poi_model text;
  v_poi_description text;
  v_poi_unit text;
  v_poi_po_id uuid;
begin
  select status into v_current_status from goods_receipts where id = p_goods_receipt_id for update;
  if v_current_status is null then
    raise exception 'rpc_update_goods_receipt: Recepción % no encontrada.', p_goods_receipt_id;
  end if;
  if v_current_status <> 'draft' then
    raise exception 'rpc_update_goods_receipt: la recepción % no está en draft (status actual: %); su contenido no puede editarse.', p_goods_receipt_id, v_current_status;
  end if;
  if v_warehouse_id is null then
    raise exception 'Debe indicarse el almacén de recepción.';
  end if;

  update goods_receipts
    set warehouse_id = v_warehouse_id,
        received_at = v_received_at,
        supplier_document_number = v_supplier_document_number,
        notes = v_notes
    where id = p_goods_receipt_id
    returning * into v_gr;

  delete from goods_receipt_items where goods_receipt_id = p_goods_receipt_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_poi_id := nullif(v_item->>'purchase_order_item_id', '')::uuid;
    v_qty := nullif(v_item->>'quantity_received', '')::integer;

    if v_poi_id is null then
      raise exception 'Cada línea debe indicar de qué partida de la Purchase Order proviene.';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'La cantidad recibida de cada línea debe ser mayor a cero.';
    end if;

    select purchase_order_id, catalog_product_id, model, description, unit
      into v_poi_po_id, v_poi_catalog_product_id, v_poi_model, v_poi_description, v_poi_unit
      from purchase_order_items where id = v_poi_id;
    if v_poi_po_id is null then
      raise exception 'La partida % no existe.', v_poi_id;
    end if;
    if v_poi_po_id <> v_gr.purchase_order_id then
      raise exception 'La partida % no pertenece a la Purchase Order de esta recepción.', v_poi_id;
    end if;

    insert into goods_receipt_items (
      goods_receipt_id, purchase_order_item_id, catalog_product_id, description_snapshot, uom_snapshot, quantity_received
    ) values (
      p_goods_receipt_id, v_poi_id, v_poi_catalog_product_id, coalesce(v_poi_description, v_poi_model), v_poi_unit, v_qty
    );
  end loop;

  return v_gr;
end;
$$;

-- =========================================================================
-- 13) rpc_cancel_goods_receipt — SECURITY INVOKER. SOLO 'draft' -> 'cancelled'
--     (ver DECISIÓN de cabecera: MVP impide cancelar una recepción posted).
-- =========================================================================
create or replace function rpc_cancel_goods_receipt(p_goods_receipt_id uuid)
returns goods_receipts
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_gr goods_receipts;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_receive_inventory')) then
    raise exception 'Solo un administrador o un usuario con autoridad de recepción de inventario puede cancelar una recepción de mercancía.';
  end if;

  select * into v_gr from goods_receipts where id = p_goods_receipt_id for update;
  if v_gr.id is null then
    raise exception 'rpc_cancel_goods_receipt: Recepción % no encontrada.', p_goods_receipt_id;
  end if;
  if not is_organization_member(v_gr.organization_id) then
    raise exception 'Esta recepción no pertenece a tu organización.';
  end if;
  if v_gr.status <> 'draft' then
    raise exception 'Solo se puede cancelar una recepción en draft (status actual: %) — una recepción posteada es inmutable.', v_gr.status;
  end if;

  update goods_receipts set status = 'cancelled' where id = p_goods_receipt_id returning * into v_gr;

  insert into goods_receipt_events (goods_receipt_id, event_type, created_by)
    values (p_goods_receipt_id, 'cancelled', auth.uid());

  return v_gr;
end;
$$;

-- =========================================================================
-- 14) rpc_post_goods_receipt — SECURITY INVOKER. Postea TODAS las líneas
--     en UNA transacción, delegando el trabajo real (ledger + balance +
--     derivación de status de PO) línea por línea a
--     rpc_receive_purchase_order_item YA existente (0035/0036/0044) —
--     nunca se duplica esa lógica. `p_quantity_received` de esa RPC es
--     ACUMULADO (no delta): se calcula como quantity_received actual de
--     la partida + lo que aporta ESTA recepción, así que recepciones
--     parciales sucesivas (regla 3) funcionan sin cambio adicional.
--     Idempotente respecto a doble POST (regla 6 del ticket): una
--     recepción que ya no está en 'draft' se rechaza explícitamente en
--     vez de reprocesarse — ver DECISIÓN de cabecera. Si CUALQUIER línea
--     falla (over-receipt, PO cancelada entretanto, stock negativo, etc.),
--     la excepción revierte TODA la transacción — incluidas las líneas ya
--     procesadas en este mismo loop (semántica estándar de Postgres, sin
--     manejo especial).
-- =========================================================================
create or replace function rpc_post_goods_receipt(p_goods_receipt_id uuid)
returns goods_receipts
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_gr goods_receipts;
  v_po purchase_orders;
  v_item goods_receipt_items;
  v_current_received integer;
  v_new_cumulative integer;
  v_item_count integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_receive_inventory')) then
    raise exception 'Solo un administrador o un usuario con autoridad de recepción de inventario puede postear una recepción de mercancía.';
  end if;

  select * into v_gr from goods_receipts where id = p_goods_receipt_id for update;
  if v_gr.id is null then
    raise exception 'rpc_post_goods_receipt: Recepción % no encontrada.', p_goods_receipt_id;
  end if;
  if not is_organization_member(v_gr.organization_id) then
    raise exception 'Esta recepción no pertenece a tu organización.';
  end if;
  if v_gr.status <> 'draft' then
    raise exception 'Esta recepción ya fue procesada (status actual: %) — no se puede postear dos veces.', v_gr.status;
  end if;

  -- Revalidación EN VIVO de la PO (regla 1/2) — puede haber cambiado desde
  -- que se creó el draft.
  select * into v_po from purchase_orders where id = v_gr.purchase_order_id for update;
  if v_po.id is null or v_po.organization_id <> v_gr.organization_id then
    raise exception 'La Purchase Order de esta recepción no existe o no pertenece a tu organización.';
  end if;
  if v_po.status = 'cancelada' then
    raise exception 'No se puede postear una recepción contra una Purchase Order cancelada.';
  end if;
  if v_po.status = 'borrador' then
    raise exception 'No se puede postear una recepción contra una Purchase Order todavía en borrador.';
  end if;

  select count(*) into v_item_count from goods_receipt_items where goods_receipt_id = p_goods_receipt_id;
  if v_item_count = 0 then
    raise exception 'No se puede postear una recepción sin líneas.';
  end if;

  for v_item in select * from goods_receipt_items where goods_receipt_id = p_goods_receipt_id order by created_at
  loop
    select quantity_received into v_current_received
      from purchase_order_items where id = v_item.purchase_order_item_id for update;
    v_new_cumulative := coalesce(v_current_received, 0) + v_item.quantity_received;

    perform rpc_receive_purchase_order_item(v_item.purchase_order_item_id, v_new_cumulative, v_gr.warehouse_id);
  end loop;

  update goods_receipts set status = 'posted' where id = p_goods_receipt_id returning * into v_gr;

  insert into goods_receipt_events (goods_receipt_id, event_type, created_by)
    values (p_goods_receipt_id, 'posted', auth.uid());

  return v_gr;
end;
$$;

commit;
