-- GS Orders — Migración 0023: THÖREN Quote → Order
--
-- Conversión atómica de una Quote aceptada a un Order operativo nuevo,
-- usando el modelo real de Orders V2 (0022): organization_id/customer_id/
-- business_unit_id ya son FKs reales, así que esta conversión los copia
-- tal cual en vez de aplanarlos a texto libre. Implementa exactamente el
-- diseño aprobado en "THÖREN — QUOTE → ORDER V2" de esta misma sesión,
-- con el ajuste arquitectónico final: rpc_create_order_from_quote hace
-- TODO el trabajo server-side (lee la Quote bajo RLS, arma el payload,
-- llama a rpc_create_order) — la app solo manda quote_id/product_type/
-- order_date, nunca ningún dato crítico (organization_id, customer_id,
-- business_unit_id, salesperson_id, client_name, items).
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Agrega `orders.source_quote_id` (nullable, FK a quotes(id) on delete
--    restrict) + índice único parcial `WHERE source_quote_id is not
--    null` — una Quote aceptada genera como máximo un Order. La
--    protección real contra doble conversión es este índice (atómico a
--    nivel de motor), no ninguna verificación de aplicación.
-- 2) Extiende `rpc_create_order` (0022) con una clave más, leída de
--    `p_order` exactamente igual que `customer_id`/`business_unit_id` —
--    CERO cambios de firma, los call-sites actuales (que nunca mandan esa
--    clave) siguen funcionando idéntico. CORRECCIÓN (misma sesión, antes
--    de Cloud): cuando `source_quote_id` viene presente, `client_name` se
--    resuelve EXCLUSIVAMENTE del snapshot `quotes.customer_name` — nunca
--    se relee `customers.name` en vivo para ese caso (a diferencia de un
--    Order manual con `customer_id`, donde sí se relee siempre, sin
--    cambios respecto a 0022). Si el nombre del Customer cambia después
--    de convertir la Quote, el Order ya creado conserva el nombre
--    histórico. `rpc_create_order` también revalida aquí, de forma
--    independiente a `rpc_create_order_from_quote`, que la Quote exista y
--    esté `aceptada` — es esta función la que decide qué valor persistir,
--    así que no confía ciegamente en el caller.
-- 3) Crea `rpc_create_order_from_quote(p_quote_id, p_product_type,
--    p_order_date) returns orders` — SECURITY INVOKER (default, igual
--    que el resto de las RPCs del proyecto):
--    a) Lee la Quote con un `select` normal — sujeto a la RLS de `quotes`
--       (0020), así que una Quote sin acceso simplemente no aparece; no
--       hace falta ninguna comparación explícita de organization_id.
--    b) Exige `status = 'aceptada'`.
--    c) Pre-chequea (mensaje amigable) que la Quote no tenga ya un Order
--       — la protección real sigue siendo el índice único del punto 1.
--    d) Arma un jsonb con `salesperson_id`/`client_name` (snapshot de
--       `customer_name`)/`customer_id`/`business_unit_id`/
--       `source_quote_id`, TODOS leídos de la fila de Quote recién
--       obtenida, y un array de items armado desde `quote_items`
--       (`catalog_product_id`/`model`/`description`/`quantity` — nunca
--       precio/descuento/moneda, Orders no tiene dónde ponerlos).
--    e) Llama a `rpc_create_order` con ese payload — es la ÚNICA lógica
--       real de creación de un Order; esta función no duplica el INSERT,
--       solo lee+valida+arma el payload y delega. `organization_id` lo
--       resuelve `rpc_create_order` internamente vía
--       `current_user_organization_id()` (0013/0022), exactamente igual
--       que para cualquier otra llamada — nunca se lee de la Quote ni se
--       recibe como parámetro aquí.
--    Toda la operación (lectura de Quote/items + llamada a
--    rpc_create_order + INSERT de orders/order_items) ocurre dentro de
--    UNA sola transacción de Postgres — una función plpgsql invocando a
--    otra no crea ningún límite de transacción nuevo; cualquier error en
--    cualquier punto revierte todo, incluido el consecutivo de folio que
--    el trigger de 0002 haya incrementado.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO toca fn_next_order_folio, trg_orders_set_folio,
--   trg_orders_prevent_folio_change, salespeople.prefix,
--   salespeople.sequence_current — folio de Orders sin cambios.
-- - NO toca quotes, quote_items, rpc_create_quote, rpc_update_quote, ni
--   el folio de Quotes — la Quote convertida permanece exactamente igual
--   (mismo status 'aceptada', mismos datos, ningún UPDATE se le aplica).
-- - NO copia currency/tax_rate/global_discount_percent/unit_price/
--   line_discount_percent/line_subtotal/subtotal/discount_total/
--   tax_total/total/folio/quote_date — Orders no tiene columnas
--   monetarias (sin cambios desde el discovery original) y genera su
--   propio folio/fecha.
-- - NO agrega ningún campo GOBO a la pantalla de conversión — el Order se
--   crea en 'borrador', que nunca ha exigido esos campos (regla vive en
--   `getMissingProjectorFields`, TypeScript, no en la DB).
-- - NO modifica rpc_update_order, rpc_duplicate_order, rpc_delete_order.
-- - NO modifica ningún PDF (Quote ni Order).
-- - NO toca RLS de `orders`/`quotes` — las policies de 0022/0020 ya
--   cubren por completo el acceso necesario para esta operación.
--
-- Como el resto del proyecto: idempotente (add column if not exists,
-- create or replace para funciones) y corre completa en una sola
-- transacción (begin/commit).

begin;

-- =========================================================================
-- 1) source_quote_id — nullable, único parcial.
-- =========================================================================
alter table orders
  add column if not exists source_quote_id uuid references quotes (id) on delete restrict;

create unique index if not exists orders_source_quote_id_unique
  on orders (source_quote_id)
  where source_quote_id is not null;

-- =========================================================================
-- 2) rpc_create_order — extendida con source_quote_id, mismo patrón que
--    customer_id/business_unit_id (0022): una clave más leída de p_order,
--    sin cambiar la firma de la función.
-- =========================================================================
create or replace function rpc_create_order(
  p_order_id uuid,
  p_order jsonb,
  p_items jsonb default '[]'::jsonb,
  p_images jsonb default '[]'::jsonb,
  p_files jsonb default '[]'::jsonb
)
returns orders
language plpgsql
as $$
declare
  v_order orders;
  v_item jsonb;
  v_item_id uuid;
  v_img jsonb;
  v_image jsonb;
  v_file jsonb;
  v_position integer;
  v_img_position integer;
  v_product_type_name text;
  v_role text;
  v_my_salesperson_id uuid;
  v_final_salesperson_id uuid;
  v_organization_id uuid;
  v_salesperson_org_id uuid;
  v_customer_id uuid;
  v_business_unit_id uuid;
  v_source_quote_id uuid;
  v_client_name text;
  v_quote_status text;
begin
  v_role := current_user_role();
  v_my_salesperson_id := current_user_salesperson_id();

  if v_role is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  if v_role = 'admin' then
    v_final_salesperson_id := (p_order->>'salesperson_id')::uuid;
  else
    if v_my_salesperson_id is null then
      raise exception 'Tu usuario no tiene un vendedor asociado. Contacta al administrador.';
    end if;
    -- Nunca se confía en el salesperson_id que mande el cliente para un
    -- VENDEDOR: se sobreescribe siempre con el de su propio perfil (CASO E).
    v_final_salesperson_id := v_my_salesperson_id;
  end if;

  -- organization_id SIEMPRE server-side — no existe ningún campo en
  -- p_order que un cliente pueda enviar para falsificarlo.
  v_organization_id := current_user_organization_id();

  -- Salesperson cross-org: la única relación inequívoca hoy entre
  -- salespeople y organización es salespeople.person_id →
  -- people.organization_id (columna única, NOT NULL en people — ver
  -- 0015/0016). Cuando el salesperson no tiene person_id (nullable,
  -- "Caso C" de 0016, nunca resuelto por ningún backfill), no se puede
  -- verificar sin inventar un mapeo — no se bloquea (límite conocido,
  -- documentado desde 0022).
  v_salesperson_org_id := fn_salesperson_organization_id(v_final_salesperson_id);

  if v_salesperson_org_id is not null and v_salesperson_org_id <> v_organization_id then
    raise exception 'El vendedor seleccionado no pertenece a tu organización.';
  end if;

  v_customer_id := nullif(p_order->>'customer_id', '')::uuid;
  v_business_unit_id := nullif(p_order->>'business_unit_id', '')::uuid;
  v_source_quote_id := nullif(p_order->>'source_quote_id', '')::uuid;

  if v_source_quote_id is not null then
    -- Quote → Order: client_name es el snapshot histórico de
    -- quotes.customer_name al momento de aceptar la cotización, NUNCA el
    -- nombre vivo de customers — a diferencia de un Order manual con
    -- customer_id (rama else-if de abajo), donde sí se relee el nombre
    -- actual. Si customers.name cambia después de convertir la Quote, el
    -- Order ya creado no debe reflejar ese cambio. Se revalida aquí
    -- (existencia + status='aceptada'), independientemente de que
    -- rpc_create_order_from_quote ya lo haya validado, porque es esta
    -- función la que decide qué valor de client_name persistir.
    select customer_name, status into v_client_name, v_quote_status
      from quotes
      where id = v_source_quote_id;
    if v_client_name is null then
      raise exception 'La cotización de origen no existe o no tiene acceso.';
    end if;
    if v_quote_status <> 'aceptada' then
      raise exception 'Solo una cotización aceptada puede convertirse a pedido (status actual: %)', v_quote_status;
    end if;
    if v_customer_id is not null
       and not exists (select 1 from customers where id = v_customer_id and organization_id = v_organization_id) then
      raise exception 'El cliente seleccionado no existe o no pertenece a tu organización.';
    end if;
  elsif v_customer_id is not null then
    select name into v_client_name
      from customers
      where id = v_customer_id and organization_id = v_organization_id;
    if v_client_name is null then
      raise exception 'El cliente seleccionado no existe o no pertenece a tu organización.';
    end if;
  else
    v_client_name := p_order->>'client_name';
  end if;

  if v_business_unit_id is not null
     and not exists (
       select 1 from business_units where id = v_business_unit_id and organization_id = v_organization_id
     ) then
    raise exception 'La unidad de negocio seleccionada no existe o no pertenece a tu organización.';
  end if;

  select name into v_product_type_name from product_types where code = p_order->>'product_type';

  insert into orders (
    id, organization_id, customer_id, business_unit_id, source_quote_id,
    salesperson_id, order_date, client_name, supplier_name, product_type, product_type_name_snapshot, status,
    general_notes, vendor_notes, vendor_notes_en,
    projector_model, projector_quantity, projector_power, projector_lens_type, projector_lens_pending_factory,
    projection_description, projection_description_en, projection_file_path, projection_file_name, projection_file_type,
    projection_width, projection_height, projection_size_unit,
    installation_height, installation_height_unit, installation_distance, installation_orientation, installation_use,
    surface_type, surface_material, surface_notes, surface_notes_en
  )
  values (
    p_order_id, v_organization_id, v_customer_id, v_business_unit_id, v_source_quote_id,
    v_final_salesperson_id,
    (p_order->>'order_date')::date,
    v_client_name,
    p_order->>'supplier_name',
    p_order->>'product_type',
    v_product_type_name,
    coalesce(p_order->>'status', 'borrador'),
    p_order->>'general_notes',
    p_order->>'vendor_notes',
    p_order->>'vendor_notes_en',
    p_order->>'projector_model',
    nullif(p_order->>'projector_quantity', '')::integer,
    p_order->>'projector_power',
    p_order->>'projector_lens_type',
    coalesce((p_order->>'projector_lens_pending_factory')::boolean, false),
    p_order->>'projection_description',
    p_order->>'projection_description_en',
    p_order->>'projection_file_path',
    p_order->>'projection_file_name',
    p_order->>'projection_file_type',
    nullif(p_order->>'projection_width', '')::numeric,
    nullif(p_order->>'projection_height', '')::numeric,
    p_order->>'projection_size_unit',
    nullif(p_order->>'installation_height', '')::numeric,
    p_order->>'installation_height_unit',
    nullif(p_order->>'installation_distance', '')::numeric,
    p_order->>'installation_orientation',
    p_order->>'installation_use',
    p_order->>'surface_type',
    p_order->>'surface_material',
    p_order->>'surface_notes',
    p_order->>'surface_notes_en'
  )
  returning * into v_order;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (
      order_id, position, image_path, model, description, quantity, notes,
      power, lens_type, lens_pending_factory,
      projection_description, projection_description_en,
      projection_file_path, projection_file_name, projection_file_type,
      projection_width, projection_height, projection_size_unit,
      installation_height, installation_height_unit, installation_distance, installation_orientation, installation_use,
      surface_type, surface_material, surface_notes, surface_notes_en,
      catalog_product_id, color
    )
    values (
      v_order.id, v_position, v_item->>'image_path', v_item->>'model', v_item->>'description',
      coalesce(nullif(v_item->>'quantity', '')::integer, 1), v_item->>'notes',
      v_item->>'power', v_item->>'lens_type', coalesce((v_item->>'lens_pending_factory')::boolean, false),
      v_item->>'projection_description', v_item->>'projection_description_en',
      v_item->>'projection_file_path', v_item->>'projection_file_name', v_item->>'projection_file_type',
      nullif(v_item->>'projection_width', '')::numeric, nullif(v_item->>'projection_height', '')::numeric,
      v_item->>'projection_size_unit',
      nullif(v_item->>'installation_height', '')::numeric, v_item->>'installation_height_unit',
      nullif(v_item->>'installation_distance', '')::numeric, v_item->>'installation_orientation', v_item->>'installation_use',
      v_item->>'surface_type', v_item->>'surface_material', v_item->>'surface_notes', v_item->>'surface_notes_en',
      nullif(v_item->>'catalog_product_id', '')::uuid, v_item->>'color'
    )
    returning id into v_item_id;

    v_img_position := 0;
    for v_img in select * from jsonb_array_elements(coalesce(v_item->'reference_images', '[]'::jsonb))
    loop
      insert into order_item_images (order_item_id, kind, position, storage_path, file_name, file_type)
      values (v_item_id, 'reference', v_img_position, v_img->>'path', v_img->>'name', v_img->>'type');
      v_img_position := v_img_position + 1;
    end loop;

    v_img_position := 0;
    for v_img in select * from jsonb_array_elements(coalesce(v_item->'projection_images', '[]'::jsonb))
    loop
      insert into order_item_images (order_item_id, kind, position, storage_path, file_name, file_type)
      values (v_item_id, 'projection', v_img_position, v_img->>'path', v_img->>'name', v_img->>'type');
      v_img_position := v_img_position + 1;
    end loop;

    v_position := v_position + 1;
  end loop;

  v_position := 0;
  for v_image in select * from jsonb_array_elements(p_images)
  loop
    insert into order_images (order_id, position, storage_path, caption)
    values (v_order.id, v_position, v_image->>'storage_path', v_image->>'caption');
    v_position := v_position + 1;
  end loop;

  for v_file in select * from jsonb_array_elements(p_files)
  loop
    insert into order_files (order_id, storage_path, file_name, file_type, file_size)
    values (
      v_order.id, v_file->>'storage_path', v_file->>'file_name', v_file->>'file_type',
      nullif(v_file->>'file_size', '')::bigint
    );
  end loop;

  return v_order;
end;
$$;

-- =========================================================================
-- 3) rpc_create_order_from_quote — la app SOLO manda quote_id/
--    product_type/order_date. Todo lo demás se lee de la Quote dentro de
--    esta misma función, bajo RLS. Reutiliza rpc_create_order para la
--    creación real — no duplica el INSERT.
-- =========================================================================
create or replace function rpc_create_order_from_quote(
  p_quote_id uuid,
  p_product_type text,
  p_order_date date
)
returns orders
language plpgsql
as $$
declare
  v_quote quotes;
  v_items_payload jsonb;
  v_order_payload jsonb;
  v_order orders;
begin
  -- Lee la Quote bajo RLS del caller — si no existe o no tiene acceso
  -- (organización/ownership), simplemente no aparece. No se necesita
  -- ninguna comparación explícita de organization_id: RLS ya es el
  -- control de acceso completo de esta operación.
  select * into v_quote from quotes where id = p_quote_id;
  if not found then
    raise exception 'Cotización no encontrada o sin acceso: %', p_quote_id;
  end if;

  if v_quote.status <> 'aceptada' then
    raise exception 'Solo una cotización aceptada puede convertirse a pedido (status actual: %)', v_quote.status;
  end if;

  -- Pre-chequeo amigable (mensaje claro) — la protección REAL contra
  -- doble conversión es el índice único parcial orders_source_quote_id_unique.
  if exists (select 1 from orders where source_quote_id = p_quote_id) then
    raise exception 'Esta cotización ya fue convertida a un pedido.';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'catalog_product_id', qi.catalog_product_id,
      'model', qi.model,
      'description', qi.description,
      'quantity', qi.quantity
    ) order by qi.position
  )
  into v_items_payload
  from quote_items qi
  where qi.quote_id = p_quote_id;

  v_order_payload := jsonb_build_object(
    'salesperson_id', v_quote.salesperson_id,
    'order_date', p_order_date::text,
    'client_name', v_quote.customer_name,
    'product_type', p_product_type,
    'customer_id', v_quote.customer_id,
    'business_unit_id', v_quote.business_unit_id,
    'source_quote_id', p_quote_id
  );

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    v_order_payload,
    coalesce(v_items_payload, '[]'::jsonb)
  );

  return v_order;
end;
$$;

commit;
