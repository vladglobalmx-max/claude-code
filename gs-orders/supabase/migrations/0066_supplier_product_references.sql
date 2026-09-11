-- =========================================================================
-- THÖREN — Supplier Product References: separar modelo interno vs.
-- referencia del proveedor
-- =========================================================================
-- PROBLEMA REAL: THÖREN identifica sus productos con su propio SKU/modelo
-- (product_catalog.sku/model) — ej. TLLTPB140R. El proveedor que surte ese
-- producto lo identifica con SU PROPIO código (ej. Top Tree = P7075R),
-- que puede no coincidir en absoluto y puede ser distinto por cada
-- proveedor del mismo producto. Hoy no existe ninguna estructura que
-- capture esto — verificado exhaustivamente (0009/0019/0030 de
-- product_catalog, 0035 de suppliers/purchase_orders/purchase_order_items,
-- 0045, 0064): ni una columna, ni una tabla, ni un campo "preferred" a
-- nivel producto. `purchase_orders.supplier_reference` (0035) es el
-- número de confirmación/PO del proveedor sobre TODA la orden, no un
-- código por producto — no reutilizable aquí.
--
-- MASTER DATA vs. TRANSACTION SNAPSHOT (corrección arquitectónica
-- explícita de esta fase): la referencia de un proveedor para un
-- producto puede cambiar con el tiempo (ej. Top Tree renombra P7075R a
-- P7075R-V2 seis meses después). Una Purchase Order YA CREADA/APROBADA
-- nunca debe cambiar retroactivamente lo que se le envió al proveedor en
-- esa transacción — por eso:
--   1) supplier_product_references es el MAESTRO vivo (esta migración,
--      sección 1) — la referencia ACTUAL de cada proveedor para cada
--      producto, editable en cualquier momento desde Catálogo.
--   2) purchase_order_items gana columnas *_snapshot (sección 2) — una
--      COPIA congelada de esa referencia, tomada en el momento exacto de
--      crear/reemplazar las partidas de la PO (rpc_create_purchase_order/
--      rpc_replace_purchase_order_items, secciones 3/4). Nunca se
--      recalculan solas si el maestro cambia después.
--
-- FUERA DE ALCANCE (pedido explícito): NO se construye PDF de Purchase
-- Order (no existe ninguno hoy — confirmado, no hay ni carpeta
-- `(print)/compras`). NO se permite cambiar purchase_orders.supplier_id
-- (verificado: ninguna RPC existente lo modifica hoy — no se agrega esa
-- capacidad). NO hay conversión de unidades (`supplier_uom` es
-- puramente informativo — inventario/shortage/recepción siguen
-- operando 100% en la unidad interna). NO hay automatización de compras
-- basada en `preferred` — solo se guarda el dato.
-- =========================================================================

begin;

-- =========================================================================
-- 1) supplier_product_references — MAESTRO. Relación N:M real entre
--    product_catalog y suppliers (1 producto -> N proveedores, cada uno
--    con su propio código). Sin organization_id propio — mismo patrón
--    exacto que product_business_units (0019): tabla de junction pura,
--    tenancy resuelto vía product_catalog.organization_id en RLS + un
--    trigger explícito que además exige que coincida con la del
--    proveedor (nunca confiar solo en RLS/UI para cross-org, pedido
--    explícito).
-- =========================================================================
create table if not exists supplier_product_references (
  id uuid primary key default gen_random_uuid(),
  catalog_product_id uuid not null references product_catalog (id) on delete cascade,
  supplier_id uuid not null references suppliers (id) on delete cascade,
  supplier_sku text,
  supplier_model text,
  supplier_description text,
  -- THÖREN — informativo únicamente (ver DECISIÓN arriba): ningún cálculo
  -- de inventario/shortage/recepción lo lee ni lo convierte.
  supplier_uom text,
  preferred boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Como mucho UNA relación por (producto, proveedor) — si cambia el
  -- código, se EDITA esta fila, nunca se crea una segunda.
  constraint supplier_product_references_unique unique (catalog_product_id, supplier_id),
  -- Una referencia sin ningún código (ni SKU ni modelo del proveedor) no
  -- sirve para nada — debe traer al menos uno de los dos.
  constraint supplier_product_references_has_reference
    check (coalesce(btrim(supplier_sku), '') <> '' or coalesce(btrim(supplier_model), '') <> ''),
  -- Una referencia INACTIVA nunca puede ser la preferida — evita que la
  -- UI muestre "preferido" sobre algo que ya no aplica.
  constraint supplier_product_references_preferred_requires_active
    check (not preferred or active)
);

-- A lo sumo UN proveedor preferido por producto — combinado con el CHECK
-- de arriba (preferred implica active), garantiza a lo sumo un preferido
-- y siempre activo, sin necesidad de un trigger aparte.
create unique index if not exists supplier_product_references_preferred_unique
  on supplier_product_references (catalog_product_id) where preferred;

create index if not exists supplier_product_references_catalog_product_idx
  on supplier_product_references (catalog_product_id);
create index if not exists supplier_product_references_supplier_idx
  on supplier_product_references (supplier_id);

drop trigger if exists trg_supplier_product_references_updated_at on supplier_product_references;
create trigger trg_supplier_product_references_updated_at
  before update on supplier_product_references
  for each row execute function set_updated_at();

-- Cross-org: el producto y el proveedor de una misma fila SIEMPRE deben
-- pertenecer a la misma organización — mismo criterio que
-- trg_check_custom_field_definition_bu_org (0055), adaptado: aquí ninguna
-- de las dos columnas es la organización misma, así que se resuelven
-- ambas por join antes de comparar.
create or replace function trg_check_supplier_product_reference_org()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_product_org uuid;
  v_supplier_org uuid;
begin
  select organization_id into v_product_org from product_catalog where id = new.catalog_product_id;
  select organization_id into v_supplier_org from suppliers where id = new.supplier_id;
  if v_product_org is distinct from v_supplier_org then
    raise exception
      'supplier_product_references: el producto % (organización %) y el proveedor % (organización %) pertenecen a organizaciones distintas.',
      new.catalog_product_id, v_product_org, new.supplier_id, v_supplier_org;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_supplier_product_references_org on supplier_product_references;
create trigger trg_supplier_product_references_org
  before insert or update of catalog_product_id, supplier_id on supplier_product_references
  for each row execute function trg_check_supplier_product_reference_org();

alter table supplier_product_references enable row level security;

drop policy if exists "supplier_product_references_select" on supplier_product_references;
create policy "supplier_product_references_select" on supplier_product_references
  for select using (
    exists (
      select 1 from product_catalog pc
      where pc.id = catalog_product_id and is_organization_member(pc.organization_id)
    )
  );

drop policy if exists "supplier_product_references_admin_write" on supplier_product_references;
create policy "supplier_product_references_admin_write" on supplier_product_references
  for all using (
    exists (
      select 1 from product_catalog pc
      where pc.id = catalog_product_id and is_organization_admin(pc.organization_id)
    )
  )
  with check (
    exists (
      select 1 from product_catalog pc
      where pc.id = catalog_product_id and is_organization_admin(pc.organization_id)
    )
  );

-- =========================================================================
-- 2) purchase_order_items — columnas SNAPSHOT, aditivas y nullable. NUNCA
--    se tocan catalog_product_id/model (identidad interna), cantidades,
--    costos, recepción ni inventario — ver DECISIÓN de cabecera.
-- =========================================================================
alter table purchase_order_items
  add column if not exists supplier_sku_snapshot text,
  add column if not exists supplier_model_snapshot text,
  add column if not exists supplier_description_snapshot text,
  add column if not exists supplier_uom_snapshot text;

-- =========================================================================
-- 3) rpc_create_purchase_order — reemplaza la versión VIGENTE (0045).
--    Único cambio real: por cada partida con catalog_product_id NOT NULL,
--    resuelve supplier_product_references (mismo producto + supplier_id
--    de ESTA PO + active=true) y copia sus 4 campos a snapshot. Sin
--    referencia activa -> snapshots NULL, la creación del borrador NUNCA
--    se bloquea por esto (ver DECISIÓN de bloqueo, sección 5). Jamás cae
--    al modelo interno como sustituto.
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
  v_snap_sku text;
  v_snap_model text;
  v_snap_description text;
  v_snap_uom text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  if not current_user_is_admin() and not current_user_has_capability('can_prepare_purchase_orders') then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación puede crear una Purchase Order.';
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

    -- THÖREN — Supplier Product References (0066): snapshot de la
    -- referencia ACTIVA de ESTE proveedor para este producto, tomada
    -- aquí y nunca recalculada sola. Partida sin catalog_product_id
    -- (manual/no catalogada) o sin referencia activa -> snapshots NULL.
    v_snap_sku := null;
    v_snap_model := null;
    v_snap_description := null;
    v_snap_uom := null;
    if v_src_catalog_product_id is not null then
      select supplier_sku, supplier_model, supplier_description, supplier_uom
        into v_snap_sku, v_snap_model, v_snap_description, v_snap_uom
        from supplier_product_references
        where catalog_product_id = v_src_catalog_product_id
          and supplier_id = v_supplier_id
          and active = true;
    end if;

    insert into purchase_order_items (
      purchase_order_id, order_item_id, position, catalog_product_id,
      model, description, color, unit, customer_requirements, quantity_ordered,
      supplier_sku_snapshot, supplier_model_snapshot, supplier_description_snapshot, supplier_uom_snapshot
    )
    values (
      v_po.id, v_order_item_id, v_position, v_src_catalog_product_id,
      v_src_model, v_src_description, v_src_color, v_src_unit, v_src_customer_requirements, v_quantity_ordered,
      v_snap_sku, v_snap_model, v_snap_description, v_snap_uom
    );

    v_position := v_position + 1;
  end loop;

  return v_po;
end;
$$;

-- =========================================================================
-- 4) rpc_replace_purchase_order_items — reemplaza la versión VIGENTE
--    (0045). Mismo cambio que rpc_create_purchase_order: resuelve y
--    copia el snapshot de supplier_product_references para el
--    supplier_id ACTUAL de la PO (v_po.supplier_id — inmutable, ver
--    DECISIÓN de cabecera: no hay "cambio de proveedor" que resolver).
--    Esta RPC (ya existente, sin cambio de disponibilidad/autoridad) es
--    la vía para refrescar snapshots de una PO en borrador después de
--    corregir el maestro — nunca ocurre solo.
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
-- 5) rpc_update_purchase_order_status — reemplaza la versión VIGENTE
--    (0045). Único cambio real: en la transición borrador -> cualquier
--    estado distinto de 'cancelada' (el propio comentario original de
--    0045 la llama "el momento de aprobación/emisión"), bloquea si
--    alguna partida CATALOGADA (catalog_product_id NOT NULL) no tiene
--    snapshot de referencia del proveedor (ni SKU ni modelo) — nunca se
--    emite con el modelo interno disfrazado de código del proveedor.
--    Líneas libres (catalog_product_id NULL) NUNCA bloquean. Corre
--    ÚNICAMENTE en esta transición — una PO que ya salió de borrador
--    antes de esta migración jamás se revalida retroactivamente (su
--    status actual ya no es 'borrador', esta rama nunca se ejecuta para
--    ella otra vez).
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
  v_is_admin boolean;
  v_can_prepare boolean;
  v_can_approve boolean;
  v_missing_models text[];
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  v_is_admin := current_user_is_admin();
  v_can_prepare := current_user_has_capability('can_prepare_purchase_orders');
  v_can_approve := current_user_has_capability('can_approve_purchase_orders');

  if not v_is_admin and not v_can_prepare and not v_can_approve then
    raise exception 'No tienes autoridad para cambiar el estado de una Purchase Order.';
  end if;

  if p_status not in ('ordenada', 'confirmada', 'en_transito', 'cancelada') then
    raise exception '"%" no es un estado asignable manualmente — "borrador" solo se asigna al crear la Purchase Order (nunca se regresa a él), y "Recibida"/"Recibida parcial" se calculan automáticamente según la recepción registrada.', p_status;
  end if;

  select status into v_current_status from purchase_orders where id = p_purchase_order_id for update;
  if v_current_status is null then
    raise exception 'Purchase Order no encontrada: %', p_purchase_order_id;
  end if;
  if v_current_status = 'cancelada' then
    raise exception 'No se puede modificar una Purchase Order cancelada.';
  end if;

  if v_current_status = 'borrador' then
    if p_status = 'cancelada' then
      -- Cancelar un borrador es parte de la autoridad de PREPARACIÓN
      -- (nunca se comprometió nada con el proveedor todavía).
      if not (v_is_admin or v_can_prepare or v_can_approve) then
        raise exception 'No tienes autoridad para cancelar esta Purchase Order.';
      end if;
    else
      -- Sacarla de borrador (ordenada/confirmada/en_transito) ES el
      -- momento de aprobación/emisión — can_prepare_purchase_orders NO
      -- alcanza para esto, sin importar que haya podido crear/editar el
      -- borrador.
      if not (v_is_admin or v_can_approve) then
        raise exception 'Solo un administrador o un usuario con autoridad de aprobación puede sacar una Purchase Order de borrador.';
      end if;

      -- THÖREN — Supplier Product References (0066): bloqueo de
      -- aprobación/emisión si falta la referencia del proveedor en
      -- alguna partida catalogada.
      select array_agg(coalesce(nullif(btrim(model), ''), 'sin modelo') order by position)
        into v_missing_models
        from purchase_order_items
        where purchase_order_id = p_purchase_order_id
          and catalog_product_id is not null
          and supplier_sku_snapshot is null
          and supplier_model_snapshot is null;

      if coalesce(array_length(v_missing_models, 1), 0) > 0 then
        raise exception 'Falta referencia del proveedor para: %', array_to_string(v_missing_models, ', ');
      end if;
    end if;
  else
    -- Ya salió de borrador (ordenada/confirmada/en_transito/
    -- recibida_parcial/recibida) — cualquier transición manual desde aquí,
    -- incluida cancelar, es administración posterior exclusiva de
    -- aprobación. can_prepare_purchase_orders pierde TODA autoridad de
    -- status en cuanto la PO deja borrador.
    if not (v_is_admin or v_can_approve) then
      raise exception 'Solo un administrador o un usuario con autoridad de aprobación puede modificar el estado de una Purchase Order que ya salió de borrador.';
    end if;
  end if;

  update purchase_orders set status = p_status, pre_receiving_status = p_status
    where id = p_purchase_order_id
    returning * into v_po;

  return v_po;
end;
$$;

-- =========================================================================
-- 6) rpc_replace_supplier_product_references — SECURITY INVOKER (mismo
--    criterio que rpc_replace_purchase_order_items, 0045). Reemplaza el
--    conjunto COMPLETO de referencias de proveedor de UN producto dentro
--    de UNA sola invocación de función = una sola transacción implícita:
--    valida TODO el set (organización/producto, proveedores de la misma
--    organización, duplicados, SKU/modelo, preferido único/activo) ANTES
--    de tocar la tabla; si cualquier validación o el propio INSERT falla
--    después, TODA la función se revierte — el DELETE ya ejecutado dentro
--    de la misma transacción se deshace también, el producto conserva su
--    set anterior intacto, nunca queda vacío ni a medias.
--
--    Corrige el gap real: la Server Action original hacía
--    supabase.from(...).delete() + .insert() como dos llamadas
--    PostgREST separadas — cada una su PROPIA transacción — así que un
--    INSERT fallido después de un DELETE exitoso dejaba al producto SIN
--    ninguna referencia. Esta RPC es ahora la única vía de escritura que
--    usa updateSupplierProductReferences (catalogo/actions.ts).
-- =========================================================================
create or replace function rpc_replace_supplier_product_references(
  p_catalog_product_id uuid,
  p_references jsonb
)
returns setof supplier_product_references
language plpgsql
as $$
declare
  v_organization_id uuid;
  v_product_org uuid;
  v_ref jsonb;
  v_supplier_id uuid;
  v_supplier_sku text;
  v_supplier_model text;
  v_preferred boolean;
  v_active boolean;
  v_seen_suppliers uuid[] := '{}';
  v_preferred_count integer := 0;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() then
    raise exception 'Solo un administrador puede editar las referencias de proveedor de un producto.';
  end if;

  v_organization_id := current_user_organization_id();

  select organization_id into v_product_org from product_catalog where id = p_catalog_product_id;
  if v_product_org is null or v_product_org <> v_organization_id then
    raise exception 'El producto no existe o no pertenece a tu organización.';
  end if;

  -- Validar el set COMPLETO antes de tocar nada — igual criterio que
  -- classifyProductRows/rpc_create_purchase_order: cualquier fila
  -- inválida bloquea TODO el reemplazo, nunca un resultado parcial.
  for v_ref in select * from jsonb_array_elements(coalesce(p_references, '[]'::jsonb))
  loop
    v_supplier_id := nullif(v_ref->>'supplier_id', '')::uuid;
    if v_supplier_id is null then
      raise exception 'Cada referencia debe indicar un proveedor.';
    end if;
    if v_supplier_id = any(v_seen_suppliers) then
      raise exception 'No puedes repetir el mismo proveedor dos veces para este producto.';
    end if;
    v_seen_suppliers := array_append(v_seen_suppliers, v_supplier_id);

    if not exists (select 1 from suppliers where id = v_supplier_id and organization_id = v_organization_id) then
      raise exception 'Uno de los proveedores seleccionados no existe o no pertenece a tu organización.';
    end if;

    v_supplier_sku := nullif(btrim(coalesce(v_ref->>'supplier_sku', '')), '');
    v_supplier_model := nullif(btrim(coalesce(v_ref->>'supplier_model', '')), '');
    if v_supplier_sku is null and v_supplier_model is null then
      raise exception 'Cada referencia necesita al menos el SKU o el modelo del proveedor.';
    end if;

    v_preferred := coalesce((v_ref->>'preferred')::boolean, false);
    v_active := coalesce((v_ref->>'active')::boolean, true);
    if v_preferred and not v_active then
      raise exception 'Una referencia preferida no puede estar inactiva.';
    end if;
    if v_preferred then
      v_preferred_count := v_preferred_count + 1;
    end if;
  end loop;

  if v_preferred_count > 1 then
    raise exception 'Solo puede haber un proveedor preferido por producto.';
  end if;

  delete from supplier_product_references where catalog_product_id = p_catalog_product_id;

  for v_ref in select * from jsonb_array_elements(coalesce(p_references, '[]'::jsonb))
  loop
    insert into supplier_product_references (
      catalog_product_id, supplier_id, supplier_sku, supplier_model,
      supplier_description, supplier_uom, preferred, active
    ) values (
      p_catalog_product_id,
      (v_ref->>'supplier_id')::uuid,
      nullif(btrim(coalesce(v_ref->>'supplier_sku', '')), ''),
      nullif(btrim(coalesce(v_ref->>'supplier_model', '')), ''),
      nullif(btrim(coalesce(v_ref->>'supplier_description', '')), ''),
      nullif(btrim(coalesce(v_ref->>'supplier_uom', '')), ''),
      coalesce((v_ref->>'preferred')::boolean, false),
      coalesce((v_ref->>'active')::boolean, true)
    );
  end loop;

  return query select * from supplier_product_references where catalog_product_id = p_catalog_product_id;
end;
$$;

commit;
