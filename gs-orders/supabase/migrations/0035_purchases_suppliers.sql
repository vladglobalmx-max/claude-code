-- =========================================================================
-- THÖREN — Fase 6L: Compras y Proveedores
-- =========================================================================
-- OBJETIVO: capa simple de Compras vinculada a los Pedidos existentes —
-- qué comprar, a qué proveedor, qué partidas, cuándo se ordenó/espera, y
-- qué se ha recibido. NO es un ERP de compras: sin costos, sin precios,
-- sin cuentas por pagar, sin inventario, sin PDF/email/automatizaciones.
-- CERO cambios a Quotes.
--
-- =========================================================================
-- DECISIÓN — `suppliers`, tabla nueva, NO reutiliza `customers` ni `people`
-- =========================================================================
-- `customers` modela a quién LE VENDEMOS; un proveedor es la relación
-- inversa (A QUIÉN LE COMPRAMOS) — semánticamente distinto aunque la forma
-- de los datos (nombre, tax_id, contacto, activo/inactivo) sea parecida.
-- Forzarlo dentro de `customers` con un discriminador tipo `kind` habría
-- mezclado dos ciclos de vida y políticas RLS que hoy son independientes
-- (ver 0018_core_customers.sql) — mismo criterio de "una tabla, un
-- concepto" del resto del proyecto (`business_units` vs `product_types`,
-- `salespeople` vs `people`).
--
-- `people` (0015_core_people.sql) tampoco aplica: es identidad HUMANA
-- INTERNA de la organización (staff/vendedores), con RLS admin-only-SELECT
-- y sin ningún flujo de escritura fuera del bootstrap de usuarios. Un
-- proveedor es una entidad externa: mezclarlo ahí requeriría abrir ese
-- candado deliberado o violar la invariante 1:1 con `user_profiles` que
-- sostiene el resto de `people` (`fn_salesperson_organization_id`, etc.).
--
-- `suppliers` es una tabla nueva, estructuralmente calcada de `customers`
-- (mismo shape de columnas, mismas políticas RLS) — sin cuentas por pagar
-- ni datos bancarios en esta fase, tal como se pidió. "contacto" es UN
-- campo de texto libre en la propia tabla (nombre de la persona de
-- contacto) — no se crea una tabla `supplier_contacts` al estilo
-- `customer_contacts` (0021) porque el enunciado de esta fase solo pide un
-- campo de contacto, no varios contactos con uno primario; agregar esa
-- tabla ahora sería sobreingeniería no pedida.
--
-- =========================================================================
-- DECISIÓN ESTRUCTURAL IMPORTANTE (consultada y confirmada con el usuario
-- antes de implementar) — purchase_order_items.order_item_id SIN FK real
-- =========================================================================
-- rpc_update_order (ver 0034) BORRA y REINSERTA TODAS las filas de
-- order_items en cada edición del Pedido, sin importar si el usuario
-- cambió algo — los `id` de order_items NUNCA son estables entre ediciones
-- (mismo motivo por el que order_item_images se recrea completa en cada
-- edición). Una FK real `purchase_order_items.order_item_id ->
-- order_items(id)`:
--   - con `on delete restrict`: impediría editar un Pedido que ya generó
--     una Purchase Order (el UPDATE fallaría).
--   - con `on delete cascade`: editar el Pedido borraría en silencio el
--     historial de compra/recepción de esa Purchase Order.
--   - con `on delete set null`: sería inofensivo, pero da una falsa
--     sensación de integridad referencial sobre una columna que de todos
--     modos cambia de valor en cada edición del Pedido.
-- Se confirmó con el usuario: `order_item_id` se guarda como un uuid
-- INFORMATIVO, SIN constraint de FK — solo trazabilidad de "de qué línea
-- vino al momento de crear la Purchase Order". La fuente de verdad real es
-- el snapshot operativo copiado en la propia fila (catalog_product_id,
-- modelo, descripción, cantidad, unidad, requisitos) — exactamente el
-- mismo criterio que ya usa el proyecto para `order_items.catalog_product_id`
-- ("trazabilidad únicamente, nunca se vuelve a consultar"). Consecuencia:
-- editar un Pedido NUNCA rompe ni borra sus Purchase Orders ya creadas.
--
-- =========================================================================
-- DECISIÓN — folio propio de Purchase Orders, motor nuevo e independiente
-- =========================================================================
-- Ni Orders (0002, por vendedor, sin organización) ni Quotes (0020, por
-- vendedor × business unit) aplican tal cual: una Purchase Order no
-- pertenece a un vendedor (la crea/gestiona ADMIN — ver DECISIÓN de
-- permisos abajo) ni a una Business Unit propia (se deriva de su Pedido
-- origen). Se crea `purchase_order_sequences`: UNA fila por organización,
-- con su propio prefijo y contador — nunca toca `salespeople.prefix`,
-- `salesperson_quote_sequences`, `fn_next_order_folio` ni
-- `fn_next_quote_folio`. Mismo formato de folio que Orders/Quotes
-- (PREFIJO-AAAADDMM-CONSECUTIVO) por consistencia visual únicamente.
--
-- =========================================================================
-- DECISIÓN — permisos: gestión de Compras es ADMIN-only, VENDEDOR solo ve
-- =========================================================================
-- El enunciado dice "ADMIN: puede ver y gestionar"; para VENDEDOR solo
-- pide "mantener el criterio de visibilidad existente del Pedido origen" —
-- nunca dice que VENDEDOR pueda crear/editar/recibir. Se interpreta:
-- VENDEDOR tiene SELECT (heredado de la visibilidad de su propio Pedido,
-- patrón join-inheritance de order_operational_status_history, 0033) pero
-- NINGÚN insert/update — crear la PO, cambiar su estado y registrar
-- recepción es exclusivamente ADMIN. Documentado aquí como decisión de
-- alcance, no un hallazgo bloqueante — reversible en una fase futura si el
-- usuario decide lo contrario.
--
-- =========================================================================
-- DECISIÓN — Business Unit de una Purchase Order: derivada, no duplicada
-- =========================================================================
-- purchase_orders NO tiene columna business_unit_id propia — se deriva
-- siempre vía order_id -> orders.business_unit_id (el enunciado mismo dice
-- "cuando pueda derivarse del Pedido"). Evita divergencia entre la Business
-- Unit real del Pedido y una copia que podría desactualizarse.
--
-- =========================================================================
-- DECISIÓN — estado de la PO: transiciones manuales vs. automáticas
-- =========================================================================
-- 'recibida' y 'recibida_parcial' SOLO los asigna el motor de recepción
-- (rpc_receive_purchase_order_item, según cantidades recibidas reales) —
-- rpc_update_purchase_order_status rechaza explícitamente que se les
-- asigne a mano, para que el estado nunca contradiga las cantidades reales
-- recibidas. El resto (borrador/ordenada/confirmada/en_transito/cancelada)
-- son transiciones manuales de ADMIN, sin una máquina de estados estricta
-- (el enunciado no la pide) salvo que 'cancelada' es terminal: ninguna PO
-- cancelada admite más cambios de estado ni de recepción.
--
-- AJUSTE FINAL (confirmado por el usuario) — el estado derivado de la
-- recepción debe ser SIEMPRE consistente con las cantidades ACTUALES, sin
-- requerir corrección manual: si se reduce la recepción de vuelta a 0 en
-- TODAS las partidas (ej. corrección de un error), la PO debe regresar
-- automáticamente al estado operativo manual que tenía antes de empezar a
-- recibir — nunca quedarse en 'recibida'/'recibida_parcial' con 0
-- recibido. Para esto se agrega `pre_receiving_status`: la última
-- transición MANUAL (rpc_update_purchase_order_status siempre la
-- actualiza al cambiar el estado); rpc_receive_purchase_order_item la lee
-- para saber a dónde volver cuando el recibido total cae a 0, pero nunca
-- la modifica — solo el motor de transiciones manuales la mantiene.
-- Nace en 'borrador' (mismo valor que `status` al crearse) — no hay hueco
-- posible porque recibir mercancía está bloqueado mientras `status` sigue
-- en 'borrador' (ver rpc_receive_purchase_order_item), así que siempre
-- existe una transición manual real (que actualiza `pre_receiving_status`)
-- antes de que la recepción pueda empezar.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (ver "FUERA DE ALCANCE" del pedido)
-- =========================================================================
-- Sin costos/precios/impuestos, sin cuentas por pagar, sin inventario ni
-- almacenes, sin PDF de PO, sin envío por email, sin archivos adjuntos,
-- sin automatizaciones, y CERO cambios a operational_status del Pedido
-- (no se dispara ni se sugiere ningún cambio automático) ni a Quotes.
-- =========================================================================

begin;

-- =========================================================================
-- 1) suppliers — catálogo de proveedores por organización
-- =========================================================================
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  name text not null
    constraint suppliers_name_not_blank check (btrim(name) <> ''),
  tax_id text,
  contact_name text,
  email text,
  phone text,
  preferred_currency text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_organization_idx on suppliers (organization_id);
create index if not exists suppliers_name_idx on suppliers (lower(name));

drop trigger if exists trg_suppliers_updated_at on suppliers;
create trigger trg_suppliers_updated_at
  before update on suppliers
  for each row execute function set_updated_at();

alter table suppliers enable row level security;

drop policy if exists "suppliers_select_member" on suppliers;
create policy "suppliers_select_member" on suppliers
  for select using (
    is_organization_admin(organization_id)
    or (is_organization_member(organization_id) and active = true)
  );

drop policy if exists "suppliers_insert_member" on suppliers;
create policy "suppliers_insert_member" on suppliers
  for insert with check (is_organization_member(organization_id));

drop policy if exists "suppliers_update_admin" on suppliers;
create policy "suppliers_update_admin" on suppliers
  for update using (is_organization_admin(organization_id))
  with check (is_organization_admin(organization_id));

-- Sin policy de DELETE — mismo criterio que customers/business_units:
-- desactivar (active = false) es el único mecanismo, nunca borrado físico.

-- =========================================================================
-- 2) purchase_order_sequences — motor de folio propio, una fila por
--    organización. Solo lo escribe fn_next_purchase_order_folio()
--    (SECURITY DEFINER) — sin policy de insert/update/delete para
--    `authenticated`, mismo criterio de "solo un escritor" que
--    order_operational_status_history (0033).
-- =========================================================================
create table if not exists purchase_order_sequences (
  organization_id uuid primary key references organizations (id) on delete restrict,
  prefix text not null default 'OC'
    constraint purchase_order_sequences_prefix_format check (prefix = upper(prefix))
    constraint purchase_order_sequences_prefix_charset check (prefix ~ '^[A-Z0-9-]+$')
    constraint purchase_order_sequences_prefix_length check (char_length(prefix) between 1 and 20),
  sequence_current integer not null default 0 check (sequence_current >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table purchase_order_sequences enable row level security;

drop policy if exists "purchase_order_sequences_select_admin" on purchase_order_sequences;
create policy "purchase_order_sequences_select_admin" on purchase_order_sequences
  for select using (is_organization_admin(organization_id));

create or replace function fn_next_purchase_order_folio(
  p_organization_id uuid,
  p_po_date date
) returns table (folio text, sequence_number integer)
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
    raise exception 'fn_next_purchase_order_folio: no tienes permiso para generar un folio de esta organización.';
  end if;

  insert into purchase_order_sequences (organization_id)
    values (p_organization_id)
    on conflict (organization_id) do nothing;

  update purchase_order_sequences
    set sequence_current = sequence_current + 1
    where organization_id = p_organization_id
    returning sequence_current, prefix into v_seq, v_prefix;

  v_date_part := to_char(p_po_date, 'YYYY') || to_char(p_po_date, 'DD') || to_char(p_po_date, 'MM');
  return query select v_prefix || '-' || v_date_part || '-' || lpad(v_seq::text, 3, '0'), v_seq;
end;
$$;

-- =========================================================================
-- 3) purchase_orders — cabecera de la orden de compra
-- =========================================================================
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  order_id uuid not null references orders (id) on delete restrict,
  supplier_id uuid not null references suppliers (id) on delete restrict,
  folio text not null,
  sequence_number integer not null,
  po_date date not null default current_date,
  supplier_commitment_date date,
  estimated_reception_date date,
  supplier_reference text,
  notes text,
  status text not null default 'borrador'
    check (status in (
      'borrador', 'ordenada', 'confirmada', 'en_transito',
      'recibida_parcial', 'recibida', 'cancelada'
    )),
  -- AJUSTE FINAL — última transición MANUAL de `status` (ver DECISIÓN
  -- arriba). La mantiene rpc_update_purchase_order_status en cada cambio;
  -- rpc_receive_purchase_order_item la lee (nunca la escribe) para volver
  -- aquí cuando el recibido total de todas las partidas cae a 0.
  pre_receiving_status text not null default 'borrador'
    check (pre_receiving_status in ('borrador', 'ordenada', 'confirmada', 'en_transito', 'cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists purchase_orders_folio_unique
  on purchase_orders (organization_id, folio);
create index if not exists purchase_orders_order_idx on purchase_orders (order_id);
create index if not exists purchase_orders_supplier_idx on purchase_orders (supplier_id);
create index if not exists purchase_orders_organization_idx on purchase_orders (organization_id);
create index if not exists purchase_orders_status_idx on purchase_orders (status);

drop trigger if exists trg_purchase_orders_updated_at on purchase_orders;
create trigger trg_purchase_orders_updated_at
  before update on purchase_orders
  for each row execute function set_updated_at();

-- folio/sequence_number/organization_id/order_id/supplier_id son
-- "identidad" de la PO — inmutables una vez creada, mismo criterio que
-- folio/sequence_number/salesperson_id/order_date en Orders (0002) y
-- folio/sequence_number/salesperson_id/business_unit_id/quote_date en
-- Quotes (0020).
create or replace function trg_prevent_purchase_order_folio_change()
returns trigger
language plpgsql
as $$
begin
  if new.folio is distinct from old.folio
     or new.sequence_number is distinct from old.sequence_number
     or new.organization_id is distinct from old.organization_id
     or new.order_id is distinct from old.order_id
     or new.supplier_id is distinct from old.supplier_id then
    raise exception 'No se puede modificar el folio, la organización, el Pedido origen o el proveedor de una Purchase Order ya creada.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_orders_prevent_folio_change on purchase_orders;
create trigger trg_purchase_orders_prevent_folio_change
  before update on purchase_orders
  for each row execute function trg_prevent_purchase_order_folio_change();

alter table purchase_orders enable row level security;

-- SELECT: ADMIN ve todas las de su organización; VENDEDOR solo las de
-- Pedidos que le pertenecen — patrón join-inheritance idéntico a
-- order_operational_status_history_via_order (0033).
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
    )
  );

-- INSERT/UPDATE: solo ADMIN gestiona Compras (ver DECISIÓN de permisos).
drop policy if exists "purchase_orders_insert_admin" on purchase_orders;
create policy "purchase_orders_insert_admin" on purchase_orders
  for insert with check (current_user_active() and is_organization_admin(organization_id));

drop policy if exists "purchase_orders_update_admin" on purchase_orders;
create policy "purchase_orders_update_admin" on purchase_orders
  for update using (current_user_active() and is_organization_admin(organization_id))
  with check (current_user_active() and is_organization_admin(organization_id));

-- Sin policy de DELETE — cancelar (status = 'cancelada') es el único
-- mecanismo, nunca borrado físico.

-- =========================================================================
-- 4) purchase_order_items — partidas de la orden de compra, snapshot
--    operativo de order_items (nunca se vuelve a consultar order_items
--    después de creada la PO). order_item_id es informativo, SIN FK real
--    — ver DECISIÓN ESTRUCTURAL arriba.
-- =========================================================================
create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders (id) on delete cascade,
  order_item_id uuid,
  position integer not null default 0,
  catalog_product_id uuid references product_catalog (id) on delete set null,
  model text not null,
  description text,
  color text,
  unit text,
  customer_requirements text,
  quantity_ordered integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0
    check (quantity_received >= 0 and quantity_received <= quantity_ordered),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_order_items_po_idx on purchase_order_items (purchase_order_id);
create index if not exists purchase_order_items_catalog_product_idx on purchase_order_items (catalog_product_id);

drop trigger if exists trg_purchase_order_items_updated_at on purchase_order_items;
create trigger trg_purchase_order_items_updated_at
  before update on purchase_order_items
  for each row execute function set_updated_at();

alter table purchase_order_items enable row level security;

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
        )
    )
  );

drop policy if exists "purchase_order_items_insert_admin" on purchase_order_items;
create policy "purchase_order_items_insert_admin" on purchase_order_items
  for insert with check (
    current_user_active() and exists (
      select 1 from purchase_orders po
      where po.id = purchase_order_items.purchase_order_id
        and is_organization_admin(po.organization_id)
    )
  );

-- UPDATE: necesario para rpc_receive_purchase_order_item (registrar
-- quantity_received). No hay edición de las demás columnas desde la UI en
-- esta fase, pero la policy no distingue columna — el guard real vive en
-- la RPC (ver sección 6).
drop policy if exists "purchase_order_items_update_admin" on purchase_order_items;
create policy "purchase_order_items_update_admin" on purchase_order_items
  for update using (
    current_user_active() and exists (
      select 1 from purchase_orders po
      where po.id = purchase_order_items.purchase_order_id
        and is_organization_admin(po.organization_id)
    )
  )
  with check (
    current_user_active() and exists (
      select 1 from purchase_orders po
      where po.id = purchase_order_items.purchase_order_id
        and is_organization_admin(po.organization_id)
    )
  );

-- Sin policy de DELETE — una PO en borrador con partidas equivocadas se
-- cancela y se vuelve a crear; no hay edición de partidas una vez creada
-- (fuera de alcance de esta fase).

-- =========================================================================
-- 5) rpc_create_purchase_order — crea la PO + sus partidas, en una sola
--    transacción. Solo ADMIN (ver DECISIÓN de permisos). SECURITY INVOKER:
--    corre como el usuario que llama, la RLS de arriba es la que
--    finalmente autoriza cada INSERT — mismo criterio que
--    rpc_create_order/rpc_create_quote.
-- =========================================================================
create or replace function rpc_create_purchase_order(
  p_purchase_order_id uuid,
  p_purchase_order jsonb,
  p_items jsonb default '[]'::jsonb
)
returns purchase_orders
language plpgsql
as $$
declare
  v_po purchase_orders;
  v_organization_id uuid;
  v_order_id uuid;
  v_order_organization_id uuid;
  v_supplier_id uuid;
  v_po_date date;
  v_folio_result record;
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
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  if not current_user_is_admin() then
    raise exception 'Solo un administrador puede crear una Purchase Order.';
  end if;

  v_organization_id := current_user_organization_id();

  v_order_id := nullif(p_purchase_order->>'order_id', '')::uuid;
  if v_order_id is null then
    raise exception 'Debe indicarse el Pedido de origen.';
  end if;

  select organization_id into v_order_organization_id from orders where id = v_order_id;
  if v_order_organization_id is null or v_order_organization_id <> v_organization_id then
    raise exception 'El Pedido de origen no existe o no pertenece a tu organización.';
  end if;

  v_supplier_id := nullif(p_purchase_order->>'supplier_id', '')::uuid;
  if not exists (
    select 1 from suppliers where id = v_supplier_id and organization_id = v_organization_id and active = true
  ) then
    raise exception 'El proveedor seleccionado no existe, no pertenece a tu organización, o está inactivo.';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Debe incluir al menos una partida.';
  end if;

  v_po_date := coalesce(nullif(p_purchase_order->>'po_date', '')::date, current_date);

  select * into v_folio_result from fn_next_purchase_order_folio(v_organization_id, v_po_date);

  insert into purchase_orders (
    id, organization_id, order_id, supplier_id, folio, sequence_number, po_date,
    supplier_commitment_date, estimated_reception_date, supplier_reference, notes, status
  )
  values (
    p_purchase_order_id, v_organization_id, v_order_id, v_supplier_id,
    v_folio_result.folio, v_folio_result.sequence_number, v_po_date,
    nullif(p_purchase_order->>'supplier_commitment_date', '')::date,
    nullif(p_purchase_order->>'estimated_reception_date', '')::date,
    nullif(p_purchase_order->>'supplier_reference', ''),
    nullif(p_purchase_order->>'notes', ''),
    'borrador'
  )
  returning * into v_po;

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
      where id = v_order_item_id and order_id = v_order_id;

    if v_src_model is null then
      raise exception 'La partida % no pertenece al Pedido de origen.', v_order_item_id;
    end if;

    insert into purchase_order_items (
      purchase_order_id, order_item_id, position, catalog_product_id,
      model, description, color, unit, customer_requirements, quantity_ordered
    )
    values (
      v_po.id, v_order_item_id, v_position, v_src_catalog_product_id,
      v_src_model, v_src_description, v_src_color, v_src_unit, v_src_customer_requirements, v_quantity_ordered
    );

    v_position := v_position + 1;
  end loop;

  return v_po;
end;
$$;

-- =========================================================================
-- 6) rpc_update_purchase_order_status — transiciones manuales de estado.
--    'recibida'/'recibida_parcial' están explícitamente prohibidos aquí:
--    solo los asigna rpc_receive_purchase_order_item, según cantidades
--    reales (ver DECISIÓN arriba). 'cancelada' es terminal.
-- =========================================================================
create or replace function rpc_update_purchase_order_status(
  p_purchase_order_id uuid,
  p_status text
)
returns purchase_orders
language plpgsql
as $$
declare
  v_po purchase_orders;
  v_current_status text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() then
    raise exception 'Solo un administrador puede cambiar el estado de una Purchase Order.';
  end if;

  if p_status not in ('borrador', 'ordenada', 'confirmada', 'en_transito', 'cancelada') then
    raise exception '"%" no es un estado asignable manualmente — Recibida/Recibida parcial se calculan automáticamente según la recepción registrada.', p_status;
  end if;

  select status into v_current_status from purchase_orders where id = p_purchase_order_id;
  if v_current_status is null then
    raise exception 'Purchase Order no encontrada: %', p_purchase_order_id;
  end if;
  if v_current_status = 'cancelada' then
    raise exception 'No se puede modificar una Purchase Order cancelada.';
  end if;

  -- AJUSTE FINAL — pre_receiving_status siempre refleja la última
  -- transición MANUAL, para que rpc_receive_purchase_order_item sepa a
  -- dónde volver si el recibido total cae a 0 (ver DECISIÓN arriba).
  update purchase_orders set status = p_status, pre_receiving_status = p_status
    where id = p_purchase_order_id
    returning * into v_po;

  return v_po;
end;
$$;

-- =========================================================================
-- 7) rpc_update_purchase_order_details — edición de los campos operativos
--    de cabecera (fechas/referencia/notas). folio/proveedor/Pedido origen
--    son inmutables (ver trigger, sección 3); el estado se cambia con la
--    RPC anterior, nunca aquí.
-- =========================================================================
create or replace function rpc_update_purchase_order_details(
  p_purchase_order_id uuid,
  p_purchase_order jsonb
)
returns purchase_orders
language plpgsql
as $$
declare
  v_po purchase_orders;
  v_current_status text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() then
    raise exception 'Solo un administrador puede editar una Purchase Order.';
  end if;

  select status into v_current_status from purchase_orders where id = p_purchase_order_id;
  if v_current_status is null then
    raise exception 'Purchase Order no encontrada: %', p_purchase_order_id;
  end if;
  if v_current_status = 'cancelada' then
    raise exception 'No se puede modificar una Purchase Order cancelada.';
  end if;

  update purchase_orders set
    supplier_commitment_date = nullif(p_purchase_order->>'supplier_commitment_date', '')::date,
    estimated_reception_date = nullif(p_purchase_order->>'estimated_reception_date', '')::date,
    supplier_reference = nullif(p_purchase_order->>'supplier_reference', ''),
    notes = nullif(p_purchase_order->>'notes', '')
  where id = p_purchase_order_id
  returning * into v_po;

  return v_po;
end;
$$;

-- =========================================================================
-- 8) rpc_receive_purchase_order_item — registra la cantidad recibida
--    ACUMULADA (valor absoluto, no delta) de una partida, y recalcula el
--    estado de la PO. Nunca permite recibido > ordenado (también
--    protegido por el CHECK de la tabla, sección 4 — defensa en
--    profundidad). Bloqueado en 'borrador' (aún no se ha ordenado nada al
--    proveedor) y en 'cancelada' (terminal). AJUSTE FINAL: el estado
--    resultante SIEMPRE es consistente con las cantidades actuales — si
--    el recibido total cae a 0 (ej. se corrige un error), la PO vuelve
--    automáticamente a `pre_receiving_status` (su última transición
--    manual), sin requerir intervención de un ADMIN.
-- =========================================================================
create or replace function rpc_receive_purchase_order_item(
  p_purchase_order_item_id uuid,
  p_quantity_received integer
)
returns purchase_order_items
language plpgsql
as $$
declare
  v_item purchase_order_items;
  v_po_id uuid;
  v_po_status text;
  v_quantity_ordered integer;
  v_total_items integer;
  v_fully_received_items integer;
  v_any_received_items integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() then
    raise exception 'Solo un administrador puede registrar recepción de mercancía.';
  end if;

  select purchase_order_id, quantity_ordered into v_po_id, v_quantity_ordered
    from purchase_order_items where id = p_purchase_order_item_id;
  if v_po_id is null then
    raise exception 'Partida de Purchase Order no encontrada: %', p_purchase_order_item_id;
  end if;

  select status into v_po_status from purchase_orders where id = v_po_id;
  if v_po_status = 'borrador' then
    raise exception 'No se puede registrar recepción de una Purchase Order en borrador — primero debe marcarse como Ordenada.';
  end if;
  if v_po_status = 'cancelada' then
    raise exception 'No se puede registrar recepción de una Purchase Order cancelada.';
  end if;

  if p_quantity_received < 0 or p_quantity_received > v_quantity_ordered then
    raise exception 'La cantidad recibida (%) no puede ser negativa ni mayor a la cantidad ordenada (%).', p_quantity_received, v_quantity_ordered;
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
    -- Todas las partidas quedaron en 0 recibido — regresa al estado
    -- operativo manual previo (nunca se queda en 'recibida'/'recibida_parcial'
    -- con 0 recibido real). pre_receiving_status nunca es NULL (default
    -- 'borrador' + siempre sincronizado por rpc_update_purchase_order_status),
    -- así que siempre hay un valor válido al que volver.
    update purchase_orders set status = pre_receiving_status where id = v_po_id;
  end if;

  return v_item;
end;
$$;

commit;
