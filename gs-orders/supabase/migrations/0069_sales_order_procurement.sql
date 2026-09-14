-- =========================================================================
-- THÖREN — 0069: Sales Order → Procurement (Purchase Requisitions)
-- =========================================================================
-- OBJETIVO: cuando una Sales Order está financieramente liberada
-- (fulfillment_release_status released/partially_released, 0068),
-- permitir generar una Purchase Requisition con las líneas que requieren
-- compra, y convertir esa requisición en una o más Purchase Orders reales
-- (reutilizando `purchase_orders`/`purchase_order_items`, 0035/0045/0066
-- — nunca un sistema de compras paralelo). NO implementa Inventory real,
-- reservas de stock, recepción de mercancía, Commissions ni Accounts
-- Receivable — el usuario decide manualmente cuánto requisicionar de cada
-- línea.
--
-- =========================================================================
-- DECISIÓN — purchase_orders.order_id pasa a NULLABLE (cambio de esquema
-- necesario, justificado explícitamente por el propio ticket):
-- =========================================================================
-- El ticket exige "La PO resultante debe usar el módulo purchase_orders
-- existente, no crear otro sistema de compras" — pero
-- purchase_orders.order_id (0035) es NOT NULL y referencia `orders`
-- (Pedidos de fabricación/instalación), un concepto TOTALMENTE
-- independiente de Sales Orders (ver DECISIÓN arquitectónica de 0067/
-- 0068: sin FK entre ambos, confirmada explícitamente por el usuario).
-- Una PO que nace de una Requisición (originada en una Sales Order) no
-- tiene ningún Pedido de origen — por construcción, nunca lo tendrá.
-- Se relaja order_id a NULLABLE (ALTER TABLE, aditivo, sin tocar ninguna
-- fila existente: todo Pedido-originado sigue exactamente igual, con
-- order_id poblado como siempre) y se agrega el vínculo real
-- (purchase_order_items.purchase_requisition_item_id, ver sección 3) para
-- una PO originada en Requisición. rpc_create_purchase_order (Pedido →
-- PO, 0035/0045/0066) NO se toca — sigue exigiendo su propio order_id
-- como siempre. La nueva rpc_convert_requisition_to_purchase_order
-- (sección 9) es el único código que inserta con order_id = NULL.
--
-- =========================================================================
-- CORRECCIÓN POST-APROBACIÓN (auditoría de order_id nullable) — el
-- comentario original aquí afirmaba, de forma imprecisa, que NINGUNA vista
-- de Inventario vería una PO originada en Requisición. Verificado contra
-- el código real de 0036: son DOS funciones distintas con comportamiento
-- DIFERENTE —
--   - rpc_inventory_incoming_by_product() (agregado por producto, usado
--     por fn_order_product_shortage/rpc_sync_order_procurement — el
--     cálculo real de shortage — y por el stat "Incoming" del detalle de
--     producto) NUNCA hace join contra `orders`, solo
--     `purchase_order_items join purchase_orders` — SÍ incluye
--     correctamente una PO originada en Requisición en su suma. Confirmado
--     con test (TEST 20 abajo usa un producto EXCLUSIVO para no toparse
--     con esto: una PO de Requisición YA existente para el mismo producto
--     habría enmascarado el shortage del Pedido de prueba).
--   - rpc_inventory_incoming_detail(product_id) (la tabla "Compras en
--     tránsito" de /inventario/[id], que necesita mostrar el folio del
--     Pedido) sí hace `join orders o on o.id = po.order_id` — esa fila SÍ
--     se excluye de esa tabla puntual para una PO de Requisición, porque
--     no tiene Pedido/folio que mostrar. Aceptado explícitamente sin
--     cambio: el ticket 0069 prohíbe tocar Inventory ("NO Inventory real
--     todavía") — sería un desajuste menor entre el stat agregado
--     "Incoming: N" y la tabla de detalle debajo, documentado aquí para
--     que no se redescubra como bug en una fase futura.
--
-- =========================================================================
-- DECISIÓN — autoridad: se reutiliza can_prepare_purchase_orders
-- (existente, 0040/0045) para TODO el ciclo de vida de una Requisición
-- (crear/editar draft/submit/cancelar/convertir a PO) — el ticket pide
-- explícitamente "Seguir capabilities existentes", a diferencia de 0068
-- (Financial Release) donde ninguna capability existente encajaba.
-- Convertir una requisición a PO es, en esencia, la misma autoridad que
-- ya prepara Purchase Orders manualmente — no se inventa nada nuevo.
--
-- =========================================================================
-- DECISIÓN — visibilidad ampliada de sales_orders/sales_order_items para
-- can_prepare_purchase_orders (mismo patrón que can_view_all_sales/
-- can_manage_sales_order_finance, 0041/0068):
-- =========================================================================
-- Un usuario de Compras (can_prepare_purchase_orders) normalmente NO es
-- el salesperson dueño de la Sales Order que está requisicionando — sin
-- esta ampliación de SELECT, rpc_create_purchase_requisition (SECURITY
-- INVOKER, sin privilegios elevados, mismo criterio que el resto del
-- proyecto desde 0054) no podría leer la Sales Order ni sus líneas para
-- copiar los snapshots. Amplía SOLO lectura — nunca escritura — mismo
-- principio ya usado dos veces.
--
-- =========================================================================
-- DECISIÓN — snapshot independiente en purchase_requisition_items:
-- =========================================================================
-- description_snapshot/uom_snapshot/catalog_product_id se copian de
-- sales_order_items EN CADA escritura de draft (create/update) — nunca se
-- vuelven a leer después. description_snapshot usa
-- sales_order_items.description_snapshot si existe, si no
-- sales_order_items.sku_snapshot (que sí es NOT NULL en origen) — nunca
-- queda vacío.
--
-- =========================================================================
-- DECISIÓN — "convertir a PO" es una sola RPC transaccional (regla del
-- ticket: atomicidad, rollback si falla), reutiliza fn_next_purchase_order_folio
-- (0035) sin tocarla, y usa supplier_product_references (0066) ACTIVAS
-- para el snapshot de proveedor en cada línea — mismo criterio "nunca
-- fallback silencioso al modelo interno" ya establecido.
--
-- Como el resto del proyecto: idempotente (create table if not exists,
-- add column if not exists, drop+create para policies/funciones) y corre
-- completa en una transacción (begin/commit).

begin;

-- =========================================================================
-- 1) purchase_orders — order_id pasa a nullable. Sin tocar ninguna otra
--    columna/constraint/trigger existente.
-- =========================================================================
alter table purchase_orders alter column order_id drop not null;

-- =========================================================================
-- 2) purchase_requisition_sequences — motor de requisition_number, mismo
--    patrón que purchase_order_sequences/sales_order_sequences.
-- =========================================================================
create table if not exists purchase_requisition_sequences (
  organization_id uuid primary key references organizations (id) on delete restrict,
  prefix text not null default 'PR'
    constraint purchase_requisition_sequences_prefix_format check (prefix = upper(prefix))
    constraint purchase_requisition_sequences_prefix_charset check (prefix ~ '^[A-Z0-9-]+$')
    constraint purchase_requisition_sequences_prefix_length check (char_length(prefix) between 1 and 20),
  sequence_current integer not null default 0 check (sequence_current >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table purchase_requisition_sequences enable row level security;

drop policy if exists "purchase_requisition_sequences_select_admin" on purchase_requisition_sequences;
create policy "purchase_requisition_sequences_select_admin" on purchase_requisition_sequences
  for select using (is_organization_admin(organization_id));

create or replace function fn_next_purchase_requisition_number(
  p_organization_id uuid,
  p_date date
) returns table (requisition_number text, sequence_number integer)
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
    raise exception 'fn_next_purchase_requisition_number: no tienes permiso para generar un número de requisición de esta organización.';
  end if;

  insert into purchase_requisition_sequences (organization_id)
    values (p_organization_id)
    on conflict (organization_id) do nothing;

  update purchase_requisition_sequences
    set sequence_current = sequence_current + 1
    where organization_id = p_organization_id
    returning sequence_current, prefix into v_seq, v_prefix;

  v_date_part := to_char(p_date, 'YYYY') || to_char(p_date, 'DD') || to_char(p_date, 'MM');
  return query select v_prefix || '-' || v_date_part || '-' || lpad(v_seq::text, 3, '0'), v_seq;
end;
$$;

-- =========================================================================
-- 3) purchase_requisitions — encabezado.
-- =========================================================================
create table if not exists purchase_requisitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  requisition_number text not null,
  sequence_number integer not null,
  sales_order_id uuid not null references sales_orders (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'partially_ordered', 'ordered', 'cancelled')),
  requested_by uuid not null references auth.users (id) on delete restrict,
  requested_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists purchase_requisitions_number_unique on purchase_requisitions (organization_id, requisition_number);
create index if not exists purchase_requisitions_organization_idx on purchase_requisitions (organization_id);
create index if not exists purchase_requisitions_sales_order_idx on purchase_requisitions (sales_order_id);
create index if not exists purchase_requisitions_status_idx on purchase_requisitions (status);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_purchase_requisitions_updated_at') then
    create trigger trg_purchase_requisitions_updated_at
      before update on purchase_requisitions
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 4) purchase_requisition_items — líneas. sales_order_item_id NOT NULL:
--    toda línea de requisición viene de una línea real de la Sales Order
--    de origen (regla 3 del ticket). catalog_product_id se copia de esa
--    línea (nunca elegido independientemente) — nullable, línea libre
--    soportada (regla 7).
-- =========================================================================
create table if not exists purchase_requisition_items (
  id uuid primary key default gen_random_uuid(),
  purchase_requisition_id uuid not null references purchase_requisitions (id) on delete cascade,
  sales_order_item_id uuid not null references sales_order_items (id) on delete restrict,
  catalog_product_id uuid references product_catalog (id) on delete set null,
  description_snapshot text not null constraint purchase_requisition_items_description_not_blank check (btrim(description_snapshot) <> ''),
  uom_snapshot text,
  quantity_required integer not null check (quantity_required > 0),
  quantity_ordered integer not null default 0 check (quantity_ordered >= 0),
  preferred_supplier_id uuid references suppliers (id) on delete set null,
  supplier_product_reference_id uuid references supplier_product_references (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_requisition_items_ordered_not_exceed_required check (quantity_ordered <= quantity_required)
);

create index if not exists purchase_requisition_items_requisition_idx on purchase_requisition_items (purchase_requisition_id);
create index if not exists purchase_requisition_items_sales_order_item_idx on purchase_requisition_items (sales_order_item_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_purchase_requisition_items_updated_at') then
    create trigger trg_purchase_requisition_items_updated_at
      before update on purchase_requisition_items
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 5) purchase_requisition_events — historial mínimo, inmutable (solo
--    INSERT). Mismo criterio que sales_order_financial_events (0068): sin
--    infraestructura de audit log genérico reutilizable, se crea un
--    historial por dominio, no uno global.
-- =========================================================================
create table if not exists purchase_requisition_events (
  id uuid primary key default gen_random_uuid(),
  purchase_requisition_id uuid not null references purchase_requisitions (id) on delete cascade,
  event_type text not null check (event_type in ('created', 'submitted', 'cancelled', 'converted_to_po')),
  purchase_order_id uuid references purchase_orders (id) on delete set null,
  notes text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists purchase_requisition_events_requisition_idx on purchase_requisition_events (purchase_requisition_id);

-- =========================================================================
-- 6) purchase_order_items — vínculo mínimo hacia la partida de requisición
--    de origen (nullable: NULL para toda PO originada en un Pedido, como
--    siempre).
-- =========================================================================
alter table purchase_order_items
  add column if not exists purchase_requisition_item_id uuid references purchase_requisition_items (id) on delete set null;

create index if not exists purchase_order_items_purchase_requisition_item_idx on purchase_order_items (purchase_requisition_item_id);

-- =========================================================================
-- 7) Trigger: inmutabilidad de identidad de purchase_requisitions
--    (requisition_number/sequence_number/organization_id/sales_order_id)
--    — siempre, sin excepción de status.
-- =========================================================================
create or replace function trg_prevent_purchase_requisition_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.requisition_number is distinct from old.requisition_number then
    raise exception 'El número de una requisición de compra no se puede modificar (%).', old.requisition_number;
  end if;
  if new.sequence_number is distinct from old.sequence_number then
    raise exception 'El consecutivo de una requisición de compra no se puede modificar.';
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'La organización de una requisición de compra no se puede modificar.';
  end if;
  if new.sales_order_id is distinct from old.sales_order_id then
    raise exception 'La Sales Order de origen de una requisición de compra no se puede modificar.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_requisitions_prevent_identity_change on purchase_requisitions;
create trigger trg_purchase_requisitions_prevent_identity_change
  before update on purchase_requisitions
  for each row execute function trg_prevent_purchase_requisition_identity_change();

-- =========================================================================
-- 8) Trigger: elegibilidad de la Sales Order de origen (regla 1) + cross-org
--    (regla 2) — SOLO en INSERT (nunca revalida retroactivamente una
--    requisición ya creada si la Sales Order cambia de estado después,
--    mismo criterio que POs aprobadas nunca se revalidan, 0066/0067).
--    SECURITY INVOKER — sales_orders ya es visible para
--    can_prepare_purchase_orders (sección 11), sin necesitar privilegios
--    elevados (mismo razonamiento que 0054 para Quotes).
-- =========================================================================
create or replace function trg_check_purchase_requisition_eligible()
returns trigger
language plpgsql
as $$
declare
  v_so_org uuid;
  v_so_status text;
  v_so_release text;
begin
  select organization_id, status, fulfillment_release_status
    into v_so_org, v_so_status, v_so_release
    from sales_orders where id = new.sales_order_id;

  if v_so_org is null then
    raise exception 'purchase_requisitions: Sales Order % no existe o no es visible para tu usuario.', new.sales_order_id;
  end if;
  if new.organization_id is distinct from v_so_org then
    raise exception 'purchase_requisitions: organization_id (%) no coincide con la organización de la Sales Order (%).', new.organization_id, v_so_org;
  end if;
  if v_so_status = 'draft' then
    raise exception 'No se puede crear una requisición de compra a partir de una Sales Order en draft.';
  end if;
  if v_so_release not in ('released', 'partially_released') then
    raise exception 'Solo una Sales Order liberada (released o partially_released) puede originar una requisición de compra — estado actual de liberación: %.', v_so_release;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_purchase_requisitions_eligible on purchase_requisitions;
create trigger trg_purchase_requisitions_eligible
  before insert on purchase_requisitions
  for each row execute function trg_check_purchase_requisition_eligible();

-- =========================================================================
-- 9) Trigger: máquina de estados de purchase_requisitions.
-- =========================================================================
create or replace function trg_purchase_requisition_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('submitted', 'cancelled'))
      or (old.status = 'submitted' and new.status in ('partially_ordered', 'ordered', 'cancelled'))
      or (old.status = 'partially_ordered' and new.status in ('ordered', 'cancelled'))
    ) then
      raise exception 'Transición de estado inválida para una requisición de compra: % -> %.', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_requisitions_status_transition on purchase_requisitions;
create trigger trg_purchase_requisitions_status_transition
  before update on purchase_requisitions
  for each row execute function trg_purchase_requisition_status_transition();

-- =========================================================================
-- 10) Triggers de purchase_requisition_items:
--     a) validación completa por línea (regla 3/4/6/8/9) — dispara solo
--        cuando sales_order_item_id/quantity_required cambian (nunca en
--        el UPDATE de solo quantity_ordered que hace la conversión).
--     b) congelamiento fuera de "draft": solo quantity_ordered puede
--        cambiar una vez la requisición sale de draft (regla "submitted
--        no editable libremente") — el UPDATE de la conversión SOLO toca
--        quantity_ordered, así que nunca choca con este guard.
-- =========================================================================
create or replace function trg_check_purchase_requisition_item_quantity()
returns trigger
language plpgsql
as $$
declare
  v_req_org uuid;
  v_req_sales_order_id uuid;
  v_so_item_sales_order_id uuid;
  v_so_item_quantity integer;
  v_so_item_catalog_product_id uuid;
  v_already_requisitioned integer;
  v_ref_catalog_product_id uuid;
  v_ref_supplier_id uuid;
  v_ref_active boolean;
  v_supplier_org uuid;
  v_supplier_active boolean;
begin
  select organization_id, sales_order_id into v_req_org, v_req_sales_order_id
    from purchase_requisitions where id = new.purchase_requisition_id;
  if v_req_sales_order_id is null then
    raise exception 'purchase_requisition_items: requisición % no encontrada.', new.purchase_requisition_id;
  end if;

  select sales_order_id, quantity, catalog_product_id
    into v_so_item_sales_order_id, v_so_item_quantity, v_so_item_catalog_product_id
    from sales_order_items where id = new.sales_order_item_id;
  if v_so_item_sales_order_id is null then
    raise exception 'purchase_requisition_items: línea de Sales Order % no encontrada.', new.sales_order_item_id;
  end if;
  if v_so_item_sales_order_id <> v_req_sales_order_id then
    raise exception 'La línea de Sales Order % no pertenece a la Sales Order de esta requisición.', new.sales_order_item_id;
  end if;
  if new.catalog_product_id is distinct from v_so_item_catalog_product_id then
    raise exception 'catalog_product_id de la partida de requisición debe coincidir con el de su línea de Sales Order de origen.';
  end if;

  -- Regla 6: acumulado requisicionado (quantity_required) de esta MISMA
  -- línea de Sales Order, a través de TODAS las requisiciones activas
  -- (cancelled se excluye — cancelar libera el cupo), nunca puede superar
  -- la cantidad real de la línea.
  select coalesce(sum(pri.quantity_required), 0) into v_already_requisitioned
    from purchase_requisition_items pri
    join purchase_requisitions pr on pr.id = pri.purchase_requisition_id
    where pri.sales_order_item_id = new.sales_order_item_id
      and pr.status <> 'cancelled'
      and pri.id <> new.id;

  if v_already_requisitioned + new.quantity_required > v_so_item_quantity then
    raise exception
      'La línea de Sales Order % ya tiene % unidad(es) requisicionada(s) (de % en total) — no se puede requisicionar % más.',
      new.sales_order_item_id, v_already_requisitioned, v_so_item_quantity, new.quantity_required;
  end if;

  -- Regla 8/9: referencia de proveedor sugerida, nunca inactiva, nunca
  -- inconsistente con el producto/proveedor.
  if new.supplier_product_reference_id is not null then
    select spr.catalog_product_id, spr.supplier_id, spr.active
      into v_ref_catalog_product_id, v_ref_supplier_id, v_ref_active
      from supplier_product_references spr where spr.id = new.supplier_product_reference_id;
    if v_ref_catalog_product_id is null then
      raise exception 'La referencia de proveedor % no existe.', new.supplier_product_reference_id;
    end if;
    if not v_ref_active then
      raise exception 'No se puede usar una referencia de proveedor inactiva.';
    end if;
    if v_ref_catalog_product_id is distinct from new.catalog_product_id then
      raise exception 'La referencia de proveedor seleccionada no corresponde al producto de esta línea.';
    end if;
    if new.preferred_supplier_id is distinct from v_ref_supplier_id then
      raise exception 'preferred_supplier_id debe coincidir con el proveedor de la referencia seleccionada.';
    end if;
  end if;

  if new.preferred_supplier_id is not null then
    select organization_id, active into v_supplier_org, v_supplier_active
      from suppliers where id = new.preferred_supplier_id;
    if v_supplier_org is null then
      raise exception 'El proveedor sugerido % no existe.', new.preferred_supplier_id;
    end if;
    if v_supplier_org <> v_req_org then
      raise exception 'El proveedor sugerido no pertenece a tu organización.';
    end if;
    if not v_supplier_active then
      raise exception 'El proveedor sugerido está inactivo.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_purchase_requisition_items_check_quantity on purchase_requisition_items;
create trigger trg_purchase_requisition_items_check_quantity
  before insert or update of sales_order_item_id, quantity_required, catalog_product_id, preferred_supplier_id, supplier_product_reference_id
  on purchase_requisition_items
  for each row execute function trg_check_purchase_requisition_item_quantity();

create or replace function trg_purchase_requisition_item_freeze()
returns trigger
language plpgsql
as $$
declare
  v_req_status text;
begin
  select status into v_req_status from purchase_requisitions where id = new.purchase_requisition_id;
  if v_req_status <> 'draft' then
    if new.sales_order_item_id is distinct from old.sales_order_item_id
      or new.catalog_product_id is distinct from old.catalog_product_id
      or new.description_snapshot is distinct from old.description_snapshot
      or new.uom_snapshot is distinct from old.uom_snapshot
      or new.quantity_required is distinct from old.quantity_required
      or new.preferred_supplier_id is distinct from old.preferred_supplier_id
      or new.supplier_product_reference_id is distinct from old.supplier_product_reference_id
      or new.notes is distinct from old.notes
    then
      raise exception 'No se puede modificar una línea de requisición fuera de status draft (actual: %) — solo quantity_ordered cambia, vía conversión a Purchase Order.', v_req_status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_requisition_items_freeze on purchase_requisition_items;
create trigger trg_purchase_requisition_items_freeze
  before update on purchase_requisition_items
  for each row execute function trg_purchase_requisition_item_freeze();

-- =========================================================================
-- 11) RLS — sales_orders/sales_order_items: se amplía SOLO lectura para
--     can_prepare_purchase_orders (ver DECISIÓN arriba). Reemplaza las
--     policies de 0068 agregando una rama más.
-- =========================================================================
drop policy if exists "sales_orders_select_own_or_admin" on sales_orders;
create policy "sales_orders_select_own_or_admin" on sales_orders
  for select using (
    is_organization_admin(organization_id)
    or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
    or (is_organization_member(organization_id) and current_user_has_capability('can_view_all_sales'))
    or (is_organization_member(organization_id) and current_user_has_capability('can_manage_sales_order_finance'))
    or (is_organization_member(organization_id) and current_user_has_capability('can_prepare_purchase_orders'))
  );

drop policy if exists "sales_order_items_select_own_or_admin" on sales_order_items;
create policy "sales_order_items_select_own_or_admin" on sales_order_items
  for select using (
    exists (
      select 1 from sales_orders so
      where so.id = sales_order_items.sales_order_id
        and (
          is_organization_admin(so.organization_id)
          or (is_organization_member(so.organization_id) and so.salesperson_id = current_user_salesperson_id())
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_view_all_sales'))
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_manage_sales_order_finance'))
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_prepare_purchase_orders'))
        )
    )
  );

-- =========================================================================
-- 12) RLS — purchase_requisitions / purchase_requisition_items /
--     purchase_requisition_events. Autoridad uniforme: admin O
--     can_prepare_purchase_orders (escritura); + can_view_all_sales (solo
--     lectura, mismo patrón ya establecido).
-- =========================================================================
alter table purchase_requisitions enable row level security;

drop policy if exists "purchase_requisitions_select" on purchase_requisitions;
create policy "purchase_requisitions_select" on purchase_requisitions
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (
      current_user_is_admin()
      or current_user_has_capability('can_prepare_purchase_orders')
      or current_user_has_capability('can_view_all_sales')
    )
  );

drop policy if exists "purchase_requisitions_insert" on purchase_requisitions;
create policy "purchase_requisitions_insert" on purchase_requisitions
  for insert with check (
    current_user_active()
    and is_organization_member(organization_id)
    and status = 'draft'
    and (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders'))
  );

drop policy if exists "purchase_requisitions_update" on purchase_requisitions;
create policy "purchase_requisitions_update" on purchase_requisitions
  for update using (
    current_user_active()
    and is_organization_member(organization_id)
    and (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders'))
  )
  with check (
    current_user_active()
    and is_organization_member(organization_id)
    and (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders'))
  );

alter table purchase_requisition_items enable row level security;

drop policy if exists "purchase_requisition_items_select" on purchase_requisition_items;
create policy "purchase_requisition_items_select" on purchase_requisition_items
  for select using (
    exists (
      select 1 from purchase_requisitions pr
      where pr.id = purchase_requisition_items.purchase_requisition_id
        and is_organization_member(pr.organization_id)
        and (
          current_user_is_admin()
          or current_user_has_capability('can_prepare_purchase_orders')
          or current_user_has_capability('can_view_all_sales')
        )
    )
  );

drop policy if exists "purchase_requisition_items_insert_draft" on purchase_requisition_items;
create policy "purchase_requisition_items_insert_draft" on purchase_requisition_items
  for insert with check (
    exists (
      select 1 from purchase_requisitions pr
      where pr.id = purchase_requisition_items.purchase_requisition_id
        and is_organization_member(pr.organization_id)
        and pr.status = 'draft'
        and (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders'))
    )
  );

-- UPDATE sin restricción de status en RLS a propósito: la conversión a PO
-- necesita actualizar quantity_ordered fuera de draft. El congelamiento
-- real de las demás columnas lo impone trg_purchase_requisition_items_freeze
-- (sección 10) — misma división de responsabilidades que
-- trg_sales_order_financial_guard (0068).
drop policy if exists "purchase_requisition_items_update" on purchase_requisition_items;
create policy "purchase_requisition_items_update" on purchase_requisition_items
  for update using (
    exists (
      select 1 from purchase_requisitions pr
      where pr.id = purchase_requisition_items.purchase_requisition_id
        and is_organization_member(pr.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders'))
    )
  )
  with check (
    exists (
      select 1 from purchase_requisitions pr
      where pr.id = purchase_requisition_items.purchase_requisition_id
        and is_organization_member(pr.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders'))
    )
  );

drop policy if exists "purchase_requisition_items_delete_draft" on purchase_requisition_items;
create policy "purchase_requisition_items_delete_draft" on purchase_requisition_items
  for delete using (
    exists (
      select 1 from purchase_requisitions pr
      where pr.id = purchase_requisition_items.purchase_requisition_id
        and is_organization_member(pr.organization_id)
        and pr.status = 'draft'
        and (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders'))
    )
  );

alter table purchase_requisition_events enable row level security;

drop policy if exists "purchase_requisition_events_select" on purchase_requisition_events;
create policy "purchase_requisition_events_select" on purchase_requisition_events
  for select using (
    exists (
      select 1 from purchase_requisitions pr
      where pr.id = purchase_requisition_events.purchase_requisition_id
        and is_organization_member(pr.organization_id)
        and (
          current_user_is_admin()
          or current_user_has_capability('can_prepare_purchase_orders')
          or current_user_has_capability('can_view_all_sales')
        )
    )
  );

drop policy if exists "purchase_requisition_events_insert" on purchase_requisition_events;
create policy "purchase_requisition_events_insert" on purchase_requisition_events
  for insert with check (
    exists (
      select 1 from purchase_requisitions pr
      where pr.id = purchase_requisition_events.purchase_requisition_id
        and is_organization_member(pr.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders'))
    )
  );

-- =========================================================================
-- 13) RLS — purchase_orders / purchase_order_items: rama ADICIONAL de
--     SELECT para "dueño vía Sales Order de la requisición de origen" —
--     necesaria porque una PO originada en Requisición tiene order_id
--     NULL (la rama "vía Pedido" existente nunca la habría alcanzado).
--     Reemplaza las policies de 0041, agregando una rama más — el resto
--     queda carácter por carácter igual.
--
--     HALLAZGO EMPÍRICO — una referencia cruzada directa (subconsulta
--     correlacionada) desde purchase_orders_select hacia
--     purchase_order_items (para llegar a la Sales Order de la
--     requisición) completa un CICLO real de políticas: la policy de
--     purchase_order_items YA referenciaba purchase_orders (para su
--     propia rama "vía Pedido"). Postgres lo detecta como "infinite
--     recursion detected in policy for relation purchase_orders" —
--     confirmado contra Postgres real al probar 0069. Se resuelve con dos
--     funciones SECURITY DEFINER pequeñas (mismo criterio ya usado en el
--     proyecto para romper un problema de visibilidad RLS, ver 0020/0054):
--     al ser SECURITY DEFINER y pertenecer al dueño del esquema (exento
--     de RLS sobre sus propias tablas), la lectura interna NO vuelve a
--     evaluar la policy de la tabla referenciada — el ciclo nunca se
--     completa. Ninguna amplía autorización (no deciden quién puede
--     escribir nada): solo resuelven un dato (el salesperson dueño, vía
--     la cadena real) para que la policy lo compare.
-- =========================================================================
-- THÖREN 0069 revisión post-aprobación — AUDITORÍA DE SEGURIDAD: estas dos
-- funciones son SECURITY DEFINER (bypass deliberado de RLS, ver HALLAZGO
-- EMPÍRICO arriba) y reciben un id ARBITRARIO como parámetro (no una
-- identidad del usuario actual, a diferencia de is_organization_member/
-- current_user_*). Sin la condición `= current_user_organization_id()`
-- añadida aquí, cualquier usuario autenticado de CUALQUIER organización
-- podría invocarlas directamente vía PostgREST (`rpc/fn_...`) con el id de
-- una Purchase Order/línea de requisición AJENA y obtener de vuelta el
-- salesperson_id real de otra organización — Postgres otorga EXECUTE a
-- PUBLIC por default y este proyecto nunca revoca ese default para
-- funciones (solo lo hace una vez, para rpc_provision_organization en
-- 0052) — confirmado que ninguna otra función en el proyecto acepta un id
-- ajeno arbitrario y devuelve un dato real derivado de otra fila sin
-- validar organización, así que este patrón es nuevo y exigía el cierre
-- explícito: (a) el propio WHERE ahora exige que la fila resuelta
-- pertenezca a current_user_organization_id() — devuelve NULL en
-- cualquier otro caso, igual que si el id no existiera; (b) REVOKE/GRANT
-- explícitos abajo, limitando la ejecución directa a `authenticated`
-- (nunca `anon`) — defensa en profundidad, la policy que las usa ya limita
-- el resultado útil a la propia organización de todas formas.
create or replace function fn_purchase_order_requisition_owner_salesperson(p_purchase_order_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select so.salesperson_id
  from purchase_order_items poi
  join purchase_orders po on po.id = poi.purchase_order_id
  join purchase_requisition_items pri on pri.id = poi.purchase_requisition_item_id
  join purchase_requisitions pr on pr.id = pri.purchase_requisition_id
  join sales_orders so on so.id = pr.sales_order_id
  where poi.purchase_order_id = p_purchase_order_id
    and po.organization_id = current_user_organization_id()
  limit 1;
$$;

revoke all on function fn_purchase_order_requisition_owner_salesperson(uuid) from public;
grant execute on function fn_purchase_order_requisition_owner_salesperson(uuid) to authenticated;

create or replace function fn_requisition_item_owner_salesperson(p_purchase_requisition_item_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select so.salesperson_id
  from purchase_requisition_items pri
  join purchase_requisitions pr on pr.id = pri.purchase_requisition_id
  join sales_orders so on so.id = pr.sales_order_id
  where pri.id = p_purchase_requisition_item_id
    and pr.organization_id = current_user_organization_id();
$$;

revoke all on function fn_requisition_item_owner_salesperson(uuid) from public;
grant execute on function fn_requisition_item_owner_salesperson(uuid) to authenticated;

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
        )
    )
  );

-- =========================================================================
-- 14) rpc_create_purchase_requisition — SECURITY INVOKER. Crea encabezado
--     + líneas en una transacción. organization_id/requested_by SIEMPRE
--     resueltos server-side.
-- =========================================================================
create or replace function rpc_create_purchase_requisition(
  p_requisition_id uuid,
  p_requisition jsonb,
  p_items jsonb default '[]'::jsonb
)
returns purchase_requisitions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_req purchase_requisitions;
  v_organization_id uuid;
  v_sales_order_id uuid := nullif(p_requisition->>'sales_order_id', '')::uuid;
  v_notes text := nullif(p_requisition->>'notes', '');
  v_number_result record;
  v_item jsonb;
  v_sales_order_item_id uuid;
  v_quantity_required integer;
  v_preferred_supplier_id uuid;
  v_supplier_product_reference_id uuid;
  v_item_notes text;
  v_so_sku text;
  v_so_description text;
  v_so_uom text;
  v_so_catalog_product_id uuid;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders')) then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación de Compras puede crear una requisición de compra.';
  end if;
  if v_sales_order_id is null then
    raise exception 'Debe indicarse la Sales Order de origen.';
  end if;

  v_organization_id := current_user_organization_id();

  select * into v_number_result from fn_next_purchase_requisition_number(v_organization_id, current_date);

  insert into purchase_requisitions (
    id, organization_id, requisition_number, sequence_number, sales_order_id, status, requested_by, notes
  ) values (
    p_requisition_id, v_organization_id, v_number_result.requisition_number, v_number_result.sequence_number,
    v_sales_order_id, 'draft', auth.uid(), v_notes
  )
  returning * into v_req;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_sales_order_item_id := nullif(v_item->>'sales_order_item_id', '')::uuid;
    v_quantity_required := nullif(v_item->>'quantity_required', '')::integer;
    v_preferred_supplier_id := nullif(v_item->>'preferred_supplier_id', '')::uuid;
    v_supplier_product_reference_id := nullif(v_item->>'supplier_product_reference_id', '')::uuid;
    v_item_notes := nullif(v_item->>'notes', '');

    if v_sales_order_item_id is null then
      raise exception 'Cada línea debe indicar de qué línea de la Sales Order proviene.';
    end if;
    if v_quantity_required is null or v_quantity_required <= 0 then
      raise exception 'La cantidad requerida de cada línea debe ser mayor a cero.';
    end if;

    select catalog_product_id, sku_snapshot, description_snapshot, uom_snapshot
      into v_so_catalog_product_id, v_so_sku, v_so_description, v_so_uom
      from sales_order_items where id = v_sales_order_item_id and sales_order_id = v_sales_order_id;
    if v_so_sku is null then
      raise exception 'La línea % no pertenece a la Sales Order de origen.', v_sales_order_item_id;
    end if;

    -- Regla 8: sugerencia automática SOLO si el cliente no mandó nada;
    -- si mandó una referencia sin proveedor, se deriva el proveedor de
    -- ella (nunca se inventa un valor inconsistente).
    if v_supplier_product_reference_id is not null and v_preferred_supplier_id is null then
      select supplier_id into v_preferred_supplier_id from supplier_product_references where id = v_supplier_product_reference_id;
    elsif v_supplier_product_reference_id is null and v_preferred_supplier_id is null and v_so_catalog_product_id is not null then
      select id, supplier_id into v_supplier_product_reference_id, v_preferred_supplier_id
        from supplier_product_references
        where catalog_product_id = v_so_catalog_product_id and active = true and preferred = true
        limit 1;
    end if;

    insert into purchase_requisition_items (
      purchase_requisition_id, sales_order_item_id, catalog_product_id,
      description_snapshot, uom_snapshot, quantity_required, quantity_ordered,
      preferred_supplier_id, supplier_product_reference_id, notes
    ) values (
      v_req.id, v_sales_order_item_id, v_so_catalog_product_id,
      coalesce(v_so_description, v_so_sku), v_so_uom, v_quantity_required, 0,
      v_preferred_supplier_id, v_supplier_product_reference_id, v_item_notes
    );
  end loop;

  insert into purchase_requisition_events (purchase_requisition_id, event_type, created_by)
    values (v_req.id, 'created', auth.uid());

  return v_req;
end;
$$;

-- =========================================================================
-- 15) rpc_update_purchase_requisition — SECURITY INVOKER. Solo mientras
--     status = 'draft' (verificado dentro del RPC, además de RLS/trigger).
--     Reemplaza notas + set completo de líneas en la MISMA transacción
--     (DELETE + INSERT, nunca por separado desde la app).
-- =========================================================================
create or replace function rpc_update_purchase_requisition(
  p_requisition_id uuid,
  p_requisition jsonb,
  p_items jsonb default '[]'::jsonb
)
returns purchase_requisitions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_req purchase_requisitions;
  v_current_status text;
  v_notes text := nullif(p_requisition->>'notes', '');
  v_item jsonb;
  v_sales_order_item_id uuid;
  v_quantity_required integer;
  v_preferred_supplier_id uuid;
  v_supplier_product_reference_id uuid;
  v_item_notes text;
  v_so_sku text;
  v_so_description text;
  v_so_uom text;
  v_so_catalog_product_id uuid;
begin
  select status into v_current_status from purchase_requisitions where id = p_requisition_id for update;
  if v_current_status is null then
    raise exception 'rpc_update_purchase_requisition: Requisición % no encontrada.', p_requisition_id;
  end if;
  if v_current_status <> 'draft' then
    raise exception 'rpc_update_purchase_requisition: la requisición % no está en draft (status actual: %); su contenido no puede editarse.', p_requisition_id, v_current_status;
  end if;

  update purchase_requisitions set notes = v_notes where id = p_requisition_id returning * into v_req;

  delete from purchase_requisition_items where purchase_requisition_id = p_requisition_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_sales_order_item_id := nullif(v_item->>'sales_order_item_id', '')::uuid;
    v_quantity_required := nullif(v_item->>'quantity_required', '')::integer;
    v_preferred_supplier_id := nullif(v_item->>'preferred_supplier_id', '')::uuid;
    v_supplier_product_reference_id := nullif(v_item->>'supplier_product_reference_id', '')::uuid;
    v_item_notes := nullif(v_item->>'notes', '');

    if v_sales_order_item_id is null then
      raise exception 'Cada línea debe indicar de qué línea de la Sales Order proviene.';
    end if;
    if v_quantity_required is null or v_quantity_required <= 0 then
      raise exception 'La cantidad requerida de cada línea debe ser mayor a cero.';
    end if;

    select catalog_product_id, sku_snapshot, description_snapshot, uom_snapshot
      into v_so_catalog_product_id, v_so_sku, v_so_description, v_so_uom
      from sales_order_items where id = v_sales_order_item_id and sales_order_id = v_req.sales_order_id;
    if v_so_sku is null then
      raise exception 'La línea % no pertenece a la Sales Order de origen.', v_sales_order_item_id;
    end if;

    if v_supplier_product_reference_id is not null and v_preferred_supplier_id is null then
      select supplier_id into v_preferred_supplier_id from supplier_product_references where id = v_supplier_product_reference_id;
    elsif v_supplier_product_reference_id is null and v_preferred_supplier_id is null and v_so_catalog_product_id is not null then
      select id, supplier_id into v_supplier_product_reference_id, v_preferred_supplier_id
        from supplier_product_references
        where catalog_product_id = v_so_catalog_product_id and active = true and preferred = true
        limit 1;
    end if;

    insert into purchase_requisition_items (
      purchase_requisition_id, sales_order_item_id, catalog_product_id,
      description_snapshot, uom_snapshot, quantity_required, quantity_ordered,
      preferred_supplier_id, supplier_product_reference_id, notes
    ) values (
      p_requisition_id, v_sales_order_item_id, v_so_catalog_product_id,
      coalesce(v_so_description, v_so_sku), v_so_uom, v_quantity_required, 0,
      v_preferred_supplier_id, v_supplier_product_reference_id, v_item_notes
    );
  end loop;

  return v_req;
end;
$$;

-- =========================================================================
-- 16) rpc_submit_purchase_requisition — SECURITY INVOKER. draft -> submitted.
-- =========================================================================
create or replace function rpc_submit_purchase_requisition(p_requisition_id uuid)
returns purchase_requisitions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_req purchase_requisitions;
  v_item_count integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders')) then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación de Compras puede enviar una requisición de compra.';
  end if;

  select * into v_req from purchase_requisitions where id = p_requisition_id for update;
  if v_req.id is null then
    raise exception 'rpc_submit_purchase_requisition: Requisición % no encontrada.', p_requisition_id;
  end if;
  if not is_organization_member(v_req.organization_id) then
    raise exception 'Esta requisición no pertenece a tu organización.';
  end if;
  if v_req.status <> 'draft' then
    raise exception 'Solo se puede enviar una requisición que esté en draft (status actual: %).', v_req.status;
  end if;

  select count(*) into v_item_count from purchase_requisition_items where purchase_requisition_id = p_requisition_id;
  if v_item_count = 0 then
    raise exception 'No puedes enviar una requisición de compra sin líneas.';
  end if;

  update purchase_requisitions set status = 'submitted' where id = p_requisition_id returning * into v_req;

  insert into purchase_requisition_events (purchase_requisition_id, event_type, created_by)
    values (p_requisition_id, 'submitted', auth.uid());

  return v_req;
end;
$$;

-- =========================================================================
-- 17) rpc_cancel_purchase_requisition — SECURITY INVOKER. Cancelación
--     explícita desde cualquier status no terminal.
-- =========================================================================
create or replace function rpc_cancel_purchase_requisition(p_requisition_id uuid)
returns purchase_requisitions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_req purchase_requisitions;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders')) then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación de Compras puede cancelar una requisición de compra.';
  end if;

  select * into v_req from purchase_requisitions where id = p_requisition_id for update;
  if v_req.id is null then
    raise exception 'rpc_cancel_purchase_requisition: Requisición % no encontrada.', p_requisition_id;
  end if;
  if not is_organization_member(v_req.organization_id) then
    raise exception 'Esta requisición no pertenece a tu organización.';
  end if;
  if v_req.status not in ('draft', 'submitted', 'partially_ordered') then
    raise exception 'No se puede cancelar una requisición de compra en status % (ya es un estado terminal).', v_req.status;
  end if;

  update purchase_requisitions set status = 'cancelled' where id = p_requisition_id returning * into v_req;

  insert into purchase_requisition_events (purchase_requisition_id, event_type, created_by)
    values (p_requisition_id, 'cancelled', auth.uid());

  return v_req;
end;
$$;

-- =========================================================================
-- 18) rpc_convert_requisition_to_purchase_order — SECURITY INVOKER. Crea
--     UNA Purchase Order (reutilizando purchase_orders/purchase_order_items
--     tal cual, order_id = NULL) a partir de un subconjunto de líneas de
--     la requisición, todas hacia el MISMO proveedor. Actualiza
--     quantity_ordered y recalcula el status de la requisición — todo en
--     UNA transacción: si cualquier validación falla, la requisición
--     (incluido quantity_ordered) queda exactamente como estaba.
-- =========================================================================
create or replace function rpc_convert_requisition_to_purchase_order(
  p_purchase_order_id uuid,
  p_requisition_id uuid,
  p_supplier_id uuid,
  p_requisition_item_ids uuid[],
  p_purchase_order jsonb default '{}'::jsonb
)
returns purchase_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_req purchase_requisitions;
  v_organization_id uuid;
  v_po purchase_orders;
  v_po_date date := coalesce(nullif(p_purchase_order->>'po_date', '')::date, current_date);
  v_folio_result record;
  v_item_id uuid;
  v_pri purchase_requisition_items;
  v_remaining integer;
  v_position integer := 0;
  v_ref_sku text;
  v_ref_model text;
  v_ref_description text;
  v_ref_uom text;
  v_total_required integer;
  v_total_ordered integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders')) then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación de Compras puede convertir una requisición en Purchase Order.';
  end if;

  select * into v_req from purchase_requisitions where id = p_requisition_id for update;
  if v_req.id is null then
    raise exception 'rpc_convert_requisition_to_purchase_order: Requisición % no encontrada.', p_requisition_id;
  end if;
  v_organization_id := current_user_organization_id();
  if v_req.organization_id <> v_organization_id then
    raise exception 'Esta requisición no pertenece a tu organización.';
  end if;
  if v_req.status not in ('submitted', 'partially_ordered') then
    raise exception 'Solo se puede convertir a Purchase Order una requisición submitted o partially_ordered (status actual: %).', v_req.status;
  end if;

  if not exists (select 1 from suppliers where id = p_supplier_id and organization_id = v_organization_id and active = true) then
    raise exception 'El proveedor seleccionado no existe, no pertenece a tu organización, o está inactivo.';
  end if;

  if p_requisition_item_ids is null or array_length(p_requisition_item_ids, 1) is null then
    raise exception 'Debes seleccionar al menos una línea de la requisición para convertir.';
  end if;

  select * into v_folio_result from fn_next_purchase_order_folio(v_organization_id, v_po_date);

  insert into purchase_orders (
    id, organization_id, order_id, supplier_id, folio, sequence_number, po_date,
    supplier_commitment_date, estimated_reception_date, supplier_reference, notes, status
  )
  values (
    p_purchase_order_id, v_organization_id, null, p_supplier_id,
    v_folio_result.folio, v_folio_result.sequence_number, v_po_date,
    nullif(p_purchase_order->>'supplier_commitment_date', '')::date,
    nullif(p_purchase_order->>'estimated_reception_date', '')::date,
    nullif(p_purchase_order->>'supplier_reference', ''),
    nullif(p_purchase_order->>'notes', ''),
    'borrador'
  )
  returning * into v_po;

  foreach v_item_id in array p_requisition_item_ids
  loop
    select * into v_pri from purchase_requisition_items where id = v_item_id and purchase_requisition_id = p_requisition_id for update;
    if v_pri.id is null then
      raise exception 'La línea % no pertenece a esta requisición.', v_item_id;
    end if;

    v_remaining := v_pri.quantity_required - v_pri.quantity_ordered;
    if v_remaining <= 0 then
      raise exception 'La línea % de la requisición ya está completamente ordenada.', v_item_id;
    end if;

    -- Referencia de proveedor ACTIVA para (producto, proveedor elegido) —
    -- nunca inactiva, nunca fallback silencioso al modelo interno (mismo
    -- criterio que 0066).
    v_ref_sku := null; v_ref_model := null; v_ref_description := null; v_ref_uom := null;
    if v_pri.catalog_product_id is not null then
      select supplier_sku, supplier_model, supplier_description, supplier_uom
        into v_ref_sku, v_ref_model, v_ref_description, v_ref_uom
        from supplier_product_references
        where catalog_product_id = v_pri.catalog_product_id and supplier_id = p_supplier_id and active = true
        limit 1;
    end if;

    insert into purchase_order_items (
      purchase_order_id, order_item_id, position, catalog_product_id,
      model, description, unit, quantity_ordered,
      purchase_requisition_item_id,
      supplier_sku_snapshot, supplier_model_snapshot, supplier_description_snapshot, supplier_uom_snapshot
    )
    values (
      v_po.id, null, v_position, v_pri.catalog_product_id,
      v_pri.description_snapshot, null, v_pri.uom_snapshot, v_remaining,
      v_pri.id,
      v_ref_sku, v_ref_model, v_ref_description, v_ref_uom
    );

    update purchase_requisition_items set quantity_ordered = quantity_ordered + v_remaining where id = v_pri.id;

    v_position := v_position + 1;
  end loop;

  select sum(quantity_required), sum(quantity_ordered) into v_total_required, v_total_ordered
    from purchase_requisition_items where purchase_requisition_id = p_requisition_id;

  update purchase_requisitions
    set status = case when v_total_ordered >= v_total_required then 'ordered' else 'partially_ordered' end
    where id = p_requisition_id;

  insert into purchase_requisition_events (purchase_requisition_id, event_type, purchase_order_id, created_by)
    values (p_requisition_id, 'converted_to_po', v_po.id, auth.uid());

  return v_po;
end;
$$;

-- =========================================================================
-- 19) rpc_replace_purchase_order_items — AUDITORÍA POST-APROBACIÓN 0069:
--     reemplaza la versión VIGENTE (0066), que asumía implícitamente
--     purchase_orders.order_id NOT NULL. Con order_id ahora nullable (ver
--     sección 1), una Purchase Order originada en Requisición tenía
--     v_po.order_id = NULL — el WHERE `order_id = v_po.order_id` sobre
--     order_items nunca compara verdadero contra NULL, así que CUALQUIER
--     order_item_id enviado fallaba con "La partida % no pertenece al
--     Pedido de origen" DESPUÉS de ya haber borrado las partidas reales
--     (ligadas a la Requisición vía purchase_requisition_item_id) —
--     Postgres revierte la transacción completa al lanzar la excepción, así
--     que no había pérdida de datos real, pero el fallo dependía de un
--     efecto colateral de NULL en vez de una validación explícita. Se
--     agrega un guard explícito al inicio: las partidas de una PO
--     originada en Requisición NUNCA se editan por esta vía (se gestionan
--     exclusivamente desde la propia Requisición) — mismo criterio que la
--     UI (ver DECISIÓN en compras/[id]/page.tsx, canEditItems ahora exige
--     que exista un Pedido de origen). Resto de la función: carácter por
--     carácter igual a 0066.
-- =========================================================================
create or replace function rpc_replace_purchase_order_items(
  p_purchase_order_id uuid,
  p_items jsonb
)
returns setof purchase_order_items
language plpgsql
as $$
declare
  v_po purchase_orders;
  v_is_admin boolean;
  v_can_prepare boolean;
  v_item jsonb;
  v_position integer;
  v_order_item_id uuid;
  v_quantity_ordered integer;
  v_src_model text;
  v_src_description text;
  v_src_catalog_product_id uuid;
  v_src_color text;
  v_src_unit text;
  v_src_customer_requirements text;
  v_snap_sku text;
  v_snap_model text;
  v_snap_description text;
  v_snap_uom text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  v_is_admin := current_user_is_admin();
  v_can_prepare := current_user_has_capability('can_prepare_purchase_orders');

  if not v_is_admin and not v_can_prepare then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación puede editar las partidas de una Purchase Order.';
  end if;

  select * into v_po from purchase_orders where id = p_purchase_order_id for update;
  if v_po.id is null then
    raise exception 'Purchase Order no encontrada: %', p_purchase_order_id;
  end if;
  if not is_organization_member(v_po.organization_id) then
    raise exception 'Esta Purchase Order no pertenece a tu organización.';
  end if;

  -- THÖREN 0069 — guard nuevo (ver DECISIÓN de cabecera de esta sección).
  if v_po.order_id is null then
    raise exception 'Esta Purchase Order proviene de una Requisición de Compra — sus partidas no se editan por esta vía.';
  end if;

  -- SIEMPRE borrador, para admin y preparador por igual (ver DECISIÓN de
  -- cabecera: editar partidas nunca aplica fuera de preparación).
  if v_po.status <> 'borrador' then
    raise exception 'Solo se pueden editar las partidas de una Purchase Order mientras está en borrador.';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Debe incluir al menos una partida.';
  end if;

  delete from purchase_order_items where purchase_order_id = p_purchase_order_id;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_order_item_id := nullif(v_item->>'order_item_id', '')::uuid;
    v_quantity_ordered := nullif(v_item->>'quantity_ordered', '')::integer;

    if v_order_item_id is null then
      raise exception 'Cada partida debe indicar de qué línea del Pedido proviene.';
    end if;
    if v_quantity_ordered is null or v_quantity_ordered <= 0 then
      raise exception 'La cantidad ordenada de cada partida debe ser mayor a cero.';
    end if;

    select model, description, catalog_product_id, color, unit, customer_requirements
      into v_src_model, v_src_description, v_src_catalog_product_id, v_src_color, v_src_unit, v_src_customer_requirements
      from order_items
      where id = v_order_item_id and order_id = v_po.order_id;

    if v_src_model is null then
      raise exception 'La partida % no pertenece al Pedido de origen.', v_order_item_id;
    end if;

    v_snap_sku := null;
    v_snap_model := null;
    v_snap_description := null;
    v_snap_uom := null;
    if v_src_catalog_product_id is not null then
      select supplier_sku, supplier_model, supplier_description, supplier_uom
        into v_snap_sku, v_snap_model, v_snap_description, v_snap_uom
        from supplier_product_references
        where catalog_product_id = v_src_catalog_product_id
          and supplier_id = v_po.supplier_id
          and active = true;
    end if;

    insert into purchase_order_items (
      purchase_order_id, order_item_id, position, catalog_product_id,
      model, description, color, unit, customer_requirements, quantity_ordered,
      supplier_sku_snapshot, supplier_model_snapshot, supplier_description_snapshot, supplier_uom_snapshot
    )
    values (
      p_purchase_order_id, v_order_item_id, v_position, v_src_catalog_product_id,
      v_src_model, v_src_description, v_src_color, v_src_unit, v_src_customer_requirements, v_quantity_ordered,
      v_snap_sku, v_snap_model, v_snap_description, v_snap_uom
    );

    v_position := v_position + 1;
  end loop;

  return query select * from purchase_order_items where purchase_order_id = p_purchase_order_id order by position;
end;
$$;

-- =========================================================================
-- 20) rpc_allocate_purchase_requirement — AUDITORÍA POST-APROBACIÓN 0069:
--     reemplaza la versión VIGENTE (0064). Ese RPC liga una "necesidad de
--     compra" (purchase_requirements, siempre originada en un Pedido, con
--     order_id NOT NULL) a una partida de una Purchase Order EXISTENTE, y
--     valida que ambas pertenezcan al MISMO Pedido con
--     `if v_po.order_id <> v_req.order_id then raise exception ...`. Con
--     order_id ahora nullable, si v_po.order_id es NULL (PO originada en
--     Requisición) esa comparación evalúa a NULL (no a verdadero) en SQL de
--     tres valores — un `if NULL then` en PL/pgSQL se trata como FALSO, así
--     que la validación se SALTABA en silencio en vez de rechazar: una
--     necesidad de compra de un Pedido podía terminar asignada a la partida
--     de una PO sin relación real con ese Pedido. Fix: `is null or <>` —
--     resto de la función carácter por carácter igual a 0064.
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
  -- THÖREN 0069 — fix (ver DECISIÓN de cabecera de esta sección): `is null or`.
  if v_po.order_id is null or v_po.order_id <> v_req.order_id then
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
