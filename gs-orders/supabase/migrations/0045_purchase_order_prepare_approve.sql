-- =========================================================================
-- THÖREN — Fase 6R.1B-3A: Backend Purchase Orders — Preparar vs Aprobar
-- =========================================================================
-- OBJETIVO: separar la autoridad de PREPARAR una Purchase Order (crear el
-- borrador, editar sus detalles operativos, ajustar sus partidas) de la
-- autoridad de APROBARLA/EMITIRLA (sacarla de borrador) y administrar su
-- ciclo posterior — reutilizando exclusivamente las dos capabilities que
-- ya existen sin uso desde 0040:
--   - can_prepare_purchase_orders -> autoridad mientras status = 'borrador'
--   - can_approve_purchase_orders -> autoridad para sacarla de 'borrador'
--     y para cualquier transición manual posterior (incluida cancelar)
-- Ninguna capability nueva. Ninguna implica la otra. can_receive_inventory
-- (0044) y rpc_receive_purchase_order_item NO se tocan en este archivo.
--
-- =========================================================================
-- DECISIÓN — versión VIGENTE de cada función (auditoría previa, crítica
-- para no reemplazar una definición obsoleta)
-- =========================================================================
-- rpc_create_purchase_order          -> vigente desde 0035 (única definición).
-- rpc_update_purchase_order_details  -> vigente desde 0035 (única definición).
-- rpc_update_purchase_order_status   -> vigente desde 0035 (única definición).
-- rpc_receive_purchase_order_item    -> vigente desde 0044 (NO se toca aquí).
-- rpc_replace_purchase_order_items   -> NUEVA, no existía ninguna forma de
--   editar partidas después de creada la Purchase Order (ni siquiera para
--   ADMIN) — confirmado en la auditoría 6R.1B-3.
--
-- =========================================================================
-- DECISIÓN — "borrador" deja de ser un status manualmente asignable
-- =========================================================================
-- Antes de este archivo, PURCHASE_ORDER_MANUAL_STATUSES (TypeScript, sin
-- tocar aquí) incluía 'borrador' como una opción más del mismo <select> que
-- 'ordenada'/'confirmada'/'en_transito'/'cancelada' — nada en el backend
-- impedía regresar una PO ya aprobada a 'borrador'. La decisión de producto
-- de esta fase es que "regresar a borrador" está SIEMPRE PROHIBIDO, sin
-- excepción de rol: 'borrador' pasa a ser, igual que 'recibida'/
-- 'recibida_parcial', un status que rpc_update_purchase_order_status NUNCA
-- acepta como destino — únicamente lo asigna rpc_create_purchase_order al
-- nacer la PO. La UI (6R.1B-3B, fuera de alcance aquí) seguirá mostrando
-- 'borrador' en el <select> hasta que se actualice; mientras tanto,
-- seleccionarlo ahora falla con una excepción clara en vez de tener éxito
-- silenciosamente — un cambio de comportamiento backend deliberado, no un
-- bug, documentado explícitamente para 3B.
--
-- =========================================================================
-- DECISIÓN — RLS compounding, mismo hallazgo de 0044 (delivery_files),
-- repetido aquí para purchase_orders/purchase_order_items
-- =========================================================================
-- Las tres RPCs modificadas (create/update_details/update_status) y la
-- nueva (replace_items) son SECURITY INVOKER a propósito (preferencia
-- explícita del enunciado sobre convertirlas a SECURITY DEFINER). Eso
-- significa que CUALQUIER lectura interna de `purchase_orders` que hagan
-- (el `select status into ...`, el `select * into v_po ... for update`)
-- sigue sujeta a la policy `purchase_orders_select` (0035/0041) — un
-- usuario con can_prepare_purchase_orders/can_approve_purchase_orders pero
-- SIN can_view_all_sales y SIN ser dueño del Pedido origen simplemente NO
-- VE la fila, y estas RPCs fallarán con "Purchase Order no encontrada"
-- aunque exista y aunque su capability sea correcta. Esto es intencional,
-- no un bug: la auditoría 6R.1B-3 (punto 8/9) ya estableció que
-- can_prepare_purchase_orders es ortogonal a can_view_all_sales y que
-- ambas se provisionarán juntas para Karla/Rodolfo cuando corresponda
-- (mismo patrón que Reservas/Entregas en 0044/6R.1B-2C). Se documenta aquí
-- explícitamente para que 3B/3C no lo redescubran como si fuera nuevo. La
-- misma compuerta se repite, por la misma razón, dentro de las nuevas
-- policies de `purchase_order_items` (su EXISTS contra `purchase_orders`
-- también pasa por `purchase_orders_select`).
--
-- =========================================================================
-- 1) RLS — purchase_orders: nuevas policies ADITIVAS para
--    can_prepare_purchase_orders, sin tocar las policies admin-only
--    existentes (purchase_orders_insert_admin / purchase_orders_update_admin
--    quedan carácter por carácter iguales).
-- =========================================================================

-- INSERT: un preparador solo puede insertar una PO que nazca en 'borrador'
-- — el WITH CHECK fija status = 'borrador' explícitamente (no solo confía
-- en que la RPC siempre lo haga) para que esta policy nunca sea, por sí
-- sola, una superficie para insertar una PO ya "aprobada" vía una llamada
-- directa que evite la RPC.
drop policy if exists "purchase_orders_insert_prepare" on purchase_orders;
create policy "purchase_orders_insert_prepare" on purchase_orders
  for insert with check (
    current_user_active()
    and is_organization_member(organization_id)
    and status = 'borrador'
    and current_user_has_capability('can_prepare_purchase_orders')
  );

-- UPDATE: un preparador solo puede tocar una fila que YA esté en
-- 'borrador' (USING, evaluado contra la fila vieja) y el resultado de su
-- propio UPDATE debe seguir siendo 'borrador' o pasar a 'cancelada' (WITH
-- CHECK, evaluado contra la fila nueva) — nunca 'ordenada'/'confirmada'/
-- 'en_transito' por esta vía. Esto cubre exactamente los dos usos legítimos
-- de un preparador sobre purchase_orders: editar detalles (status no
-- cambia) y cancelar su propio borrador (rpc_update_purchase_order_status,
-- sección 5). folio/organization_id/order_id/supplier_id/sequence_number
-- ya están protegidos para CUALQUIER actualizador por
-- trg_prevent_purchase_order_folio_change (0035) — no se duplica esa
-- protección aquí.
drop policy if exists "purchase_orders_update_prepare" on purchase_orders;
create policy "purchase_orders_update_prepare" on purchase_orders
  for update using (
    current_user_active()
    and is_organization_member(organization_id)
    and status = 'borrador'
    and current_user_has_capability('can_prepare_purchase_orders')
  )
  with check (
    current_user_active()
    and is_organization_member(organization_id)
    and status in ('borrador', 'cancelada')
  );

-- UPDATE para can_approve_purchase_orders — HALLAZGO DE LA PRUEBA LOCAL:
-- `SELECT ... FOR UPDATE` (usado por rpc_update_purchase_order_status para
-- bloquear la fila antes de leer su status) exige, bajo RLS, que la fila
-- satisfaga TAMBIÉN el USING de alguna policy de UPDATE aplicable — no
-- basta con la policy de SELECT. Sin esta policy, un usuario con
-- can_approve_purchase_orders (sin ser admin) recibía "Purchase Order no
-- encontrada" al intentar aprobar, aunque la viera perfectamente bien con
-- un SELECT plano — confirmado y corregido contra Postgres real antes de
-- cerrar esta fase. Deliberadamente SIN restricción de status (mismo
-- criterio que purchase_orders_update_admin siempre tuvo): las reglas
-- reales de qué transición es válida las decide el cuerpo de
-- rpc_update_purchase_order_status, no RLS — RLS aquí solo autoriza que la
-- capability pueda tocar la tabla en su propia organización.
drop policy if exists "purchase_orders_update_approve" on purchase_orders;
create policy "purchase_orders_update_approve" on purchase_orders
  for update using (
    current_user_active()
    and is_organization_member(organization_id)
    and current_user_has_capability('can_approve_purchase_orders')
  )
  with check (
    current_user_active()
    and is_organization_member(organization_id)
    and current_user_has_capability('can_approve_purchase_orders')
  );

-- Esta policy, al ser deliberadamente amplia (sin restricción de status ni
-- de columna), abre una superficie que rpc_update_purchase_order_status
-- nunca usa por sí sola: un usuario con SOLO can_approve_purchase_orders
-- (sin can_prepare_purchase_orders) podría, con un UPDATE directo que
-- evite la RPC, editar notes/fechas/referencia — autoridad que por diseño
-- es exclusiva de PREPARACIÓN (ver decisión de producto #1-3). Se cierra
-- con un trigger (igual patrón que trg_prevent_purchase_order_folio_change,
-- 0035, que ya usa OLD/NEW — RLS por sí sola no puede comparar columna por
-- columna contra el valor anterior).
create or replace function trg_prevent_approve_only_detail_edit()
returns trigger
language plpgsql
as $$
begin
  if not current_user_is_admin() and not current_user_has_capability('can_prepare_purchase_orders') then
    if new.supplier_commitment_date is distinct from old.supplier_commitment_date
       or new.estimated_reception_date is distinct from old.estimated_reception_date
       or new.supplier_reference is distinct from old.supplier_reference
       or new.notes is distinct from old.notes then
      raise exception 'Un usuario con autoridad de aprobación no puede editar los detalles operativos de una Purchase Order — eso requiere autoridad de preparación (solo mientras está en borrador).';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_orders_prevent_approve_detail_edit on purchase_orders;
create trigger trg_purchase_orders_prevent_approve_detail_edit
  before update on purchase_orders
  for each row execute function trg_prevent_approve_only_detail_edit();

-- =========================================================================
-- 2) RLS — purchase_order_items: nuevas policies para permitir que
--    rpc_replace_purchase_order_items (sección 4) funcione bajo SECURITY
--    INVOKER, tanto para ADMIN (que hoy NO tiene policy de DELETE en esta
--    tabla — nunca hizo falta, "una PO en borrador con partidas
--    equivocadas se cancela y se vuelve a crear", 0035) como para un
--    preparador. Ambas quedan explícitamente acotadas a
--    purchase_orders.status = 'borrador' — ver DECISIÓN arriba, "editar
--    partidas nunca aplica fuera de preparación, sin excepción de rol".
--    Las policies admin-only existentes (insert/update) quedan intactas.
-- =========================================================================

drop policy if exists "purchase_order_items_insert_prepare" on purchase_order_items;
create policy "purchase_order_items_insert_prepare" on purchase_order_items
  for insert with check (
    current_user_active() and exists (
      select 1 from purchase_orders po
      where po.id = purchase_order_items.purchase_order_id
        and is_organization_member(po.organization_id)
        and po.status = 'borrador'
        and current_user_has_capability('can_prepare_purchase_orders')
    )
  );

drop policy if exists "purchase_order_items_delete_borrador" on purchase_order_items;
create policy "purchase_order_items_delete_borrador" on purchase_order_items
  for delete using (
    current_user_active() and exists (
      select 1 from purchase_orders po
      where po.id = purchase_order_items.purchase_order_id
        and is_organization_member(po.organization_id)
        and po.status = 'borrador'
        and (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders'))
    )
  );

-- =========================================================================
-- 3) rpc_create_purchase_order — reemplaza la versión VIGENTE (0035).
--    Único cambio real: el guard de autoridad. Organization checks, order
--    linkage, folio, validación de payload, snapshot de partidas,
--    cantidades, unidades, product linkage: carácter por carácter iguales.
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
-- 4) rpc_update_purchase_order_details — reemplaza la versión VIGENTE
--    (0035). ADMIN conserva su comportamiento actual (cualquier status
--    salvo 'cancelada'). Un preparador (no-admin) SOLO puede editar
--    mientras status = 'borrador' — excepción clara en cualquier otro
--    caso. Mismos 4 campos de siempre, ningún campo nuevo.
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
  v_is_admin boolean;
  v_can_prepare boolean;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  v_is_admin := current_user_is_admin();
  v_can_prepare := current_user_has_capability('can_prepare_purchase_orders');

  if not v_is_admin and not v_can_prepare then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación puede editar una Purchase Order.';
  end if;

  select status into v_current_status from purchase_orders where id = p_purchase_order_id;
  if v_current_status is null then
    raise exception 'Purchase Order no encontrada: %', p_purchase_order_id;
  end if;
  if v_current_status = 'cancelada' then
    raise exception 'No se puede modificar una Purchase Order cancelada.';
  end if;

  if not v_is_admin and v_current_status <> 'borrador' then
    raise exception 'Solo puedes editar los detalles de una Purchase Order mientras está en borrador — esta ya salió de preparación.';
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
-- 5) rpc_replace_purchase_order_items — NUEVA. Reemplaza atómicamente el
--    conjunto completo de partidas de una Purchase Order EN BORRADOR
--    (admin incluido — nunca fuera de borrador, para nadie). Reutiliza
--    exactamente la misma validación/snapshot de rpc_create_purchase_order
--    (cada order_item_id debe pertenecer al Pedido de origen de la PO).
--    DELETE + INSERT dentro de la misma invocación de función = una sola
--    transacción implícita: si cualquier partida falla su validación, TODO
--    se revierte — nunca queda un reemplazo parcial.
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

    insert into purchase_order_items (
      purchase_order_id, order_item_id, position, catalog_product_id,
      model, description, color, unit, customer_requirements, quantity_ordered
    )
    values (
      p_purchase_order_id, v_order_item_id, v_position, v_src_catalog_product_id,
      v_src_model, v_src_description, v_src_color, v_src_unit, v_src_customer_requirements, v_quantity_ordered
    );

    v_position := v_position + 1;
  end loop;

  return query select * from purchase_order_items where purchase_order_id = p_purchase_order_id order by position;
end;
$$;

-- =========================================================================
-- 6) rpc_update_purchase_order_status — reemplaza la versión VIGENTE
--    (0035). Máquina de estados dividida en dos autoridades:
--      - borrador -> cancelada:                       admin OR can_prepare OR can_approve
--      - borrador -> {ordenada,confirmada,en_transito}: admin OR can_approve (ÚNICAMENTE)
--      - cualquier transición NO originada en borrador: admin OR can_approve (ÚNICAMENTE)
--    'borrador' deja de ser un destino asignable (ver DECISIÓN de
--    cabecera) — mismo trato que 'recibida'/'recibida_parcial'.
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
