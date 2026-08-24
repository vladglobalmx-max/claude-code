-- GS Orders — Migración 0029: THÖREN Quote → Order Hardening + Preservación
-- de datos operativos
--
-- Fase 6A (auditoría, misma sesión) encontró 3 huecos reales en el flujo
-- Quote → Order (0023): (1) nada en DB impedía convertir una Quote
-- histórica de CotizIA vía RPC directo, aunque el botón esté oculto en la
-- UI; (2) un Order con `source_quote_id` podía eliminarse igual que
-- cualquier otro, rompiendo la trazabilidad Quote → Order y permitiendo
-- "reconvertir" la misma Quote después; (3) `payment_terms`/
-- `delivery_time`/`warranty`/`customer_notes` (Quote) y `unit`/
-- `customer_requirements` (Quote Item) se perdían por completo al
-- convertir — Orders no tenía dónde ponerlos. Esta migración (Fase 6B,
-- aprobada en la misma sesión) cierra los 3 huecos.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Agrega a `orders`: `payment_terms`, `delivery_time`, `warranty`,
--    `customer_notes` (las 4, `text`, nullable, sin default) — snapshot
--    operativo de la Quote origen, mismo criterio de nombres que las
--    columnas homónimas de `quotes` (0025/0028).
-- 2) Agrega a `order_items`: `unit`, `customer_requirements` (`text`,
--    nullable) — snapshot por línea, mismo criterio que
--    `quote_items.unit`/`quote_items.customer_requirements` (0028).
-- 3) Extiende `rpc_create_order` (0022/0023) para leer estas 4 claves más
--    de `p_order` y 2 claves más de cada item de `p_items`, exactamente
--    con el mismo patrón que ya usa (`p_order->>'clave'`,
--    `v_item->>'clave'`) — CERO cambios de firma; un caller que no las
--    mande (todo Order manual hoy, ver pedidos/actions.ts buildOrderRow)
--    simplemente las persiste NULL, comportamiento idéntico al actual.
-- 4) Extiende `rpc_create_order_from_quote` (0023) para:
--    a) Rechazar cualquier Quote con `source <> 'thoren'` — ENFORCEMENT
--       REAL en DB/RPC, no solo el botón oculto en
--       cotizaciones/[id]/page.tsx. Mensaje claro, mismo estilo que el
--       resto de validaciones de esta función.
--    b) Copiar `payment_terms`/`delivery_time`/`warranty`/
--       `customer_notes` de la Quote al payload de `rpc_create_order`, y
--       `unit`/`customer_requirements` de cada `quote_items` al payload de
--       items — mismo momento (lectura de la Quote bajo RLS del caller),
--       mismo mecanismo (jsonb), sin RPC nueva.
-- 5) Extiende `rpc_delete_order` (0005/.../0009) para rechazar el DELETE
--    cuando `source_quote_id is not null`, con el mensaje exacto pedido:
--    "Este pedido fue generado desde una cotización y no puede
--    eliminarse." — verificado ANTES de tocar cualquier fila (huérfanos de
--    Storage, order_items, etc.), así que un intento rechazado no deja
--    ningún efecto secundario. Un Order manual (`source_quote_id is
--    null`) conserva exactamente el comportamiento actual, sujeto
--    únicamente a la RLS de siempre (`orders_delete_own_or_admin`, 0022).
--    NO se implementa aquí ningún sistema de cancelación de Orders — es
--    explícitamente otra fase, según lo pedido.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO agrega `currency`, `unit_price`, descuentos, `subtotal`, IVA,
--   `total` a `orders`/`order_items` — Orders sigue sin manejar dinero en
--   esta fase, exactamente como pidió el usuario.
-- - NO modifica `rpc_update_order`, `rpc_duplicate_order` — un Order ya
--   creado (manual o desde Quote) sigue editándose/duplicándose
--   exactamente igual; los 6 campos nuevos son snapshot de la conversión,
--   no campos editables desde Editar Pedido en esta fase (si el negocio
--   los quiere editables después, es una fase aparte con su propia
--   revisión de UI/validaciones).
-- - NO modifica ninguna UI (`convertir-pedido`, `order-form`,
--   `order-detail-content`, PDFs) — pedido explícito de la Fase 6B es solo
--   DB/RPC + tests. Los 6 campos quedan persistidos y visibles solo por
--   API/SQL hasta que una fase de UI los muestre.
-- - NO toca RLS de `orders`/`order_items`/`quotes`/`quote_items` — el
--   candado de DELETE vive dentro de `rpc_delete_order` (decisión de
--   función, no de policy) porque debe aplicar sin importar quién intente
--   el DELETE (ADMIN o VENDEDOR dueño), algo que una policy USING no puede
--   expresar de forma más clara que una excepción explícita con mensaje de
--   negocio.
-- - NO toca `orders_source_quote_id_unique`, la protección real contra
--   doble conversión (0023) — sigue exactamente igual; el candado nuevo de
--   DELETE es un refuerzo complementario, no un reemplazo.
-- - NO toca `quotes`, `quote_items`, `rpc_create_quote`, `rpc_update_quote`
--   — la Quote origen y su contenido comercial no cambian en absoluto.
--
-- Como el resto del proyecto: idempotente (add column if not exists,
-- create or replace para funciones) y corre completa en una sola
-- transacción (begin/commit).

begin;

-- =========================================================================
-- 1) orders — 4 columnas snapshot nuevas, todas nullable.
-- =========================================================================
alter table orders
  add column if not exists payment_terms text,
  add column if not exists delivery_time text,
  add column if not exists warranty text,
  add column if not exists customer_notes text;

-- =========================================================================
-- 2) order_items — 2 columnas snapshot nuevas, todas nullable.
-- =========================================================================
alter table order_items
  add column if not exists unit text,
  add column if not exists customer_requirements text;

-- =========================================================================
-- 3) rpc_create_order — agrega lectura/persistencia de los 4 campos de
--    orders + 2 campos por item, mismo patrón exacto que el resto de
--    columnas opcionales de esta función. Resto de la función (roles,
--    cross-org, salesperson, customer, business_unit, imágenes, archivos)
--    sin cambios de comportamiento.
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
    payment_terms, delivery_time, warranty, customer_notes,
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
    nullif(p_order->>'payment_terms', ''),
    nullif(p_order->>'delivery_time', ''),
    nullif(p_order->>'warranty', ''),
    nullif(p_order->>'customer_notes', ''),
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
      unit, customer_requirements,
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
      nullif(v_item->>'unit', ''), nullif(v_item->>'customer_requirements', ''),
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
-- 4) rpc_create_order_from_quote — agrega el guard de `source` y copia los
--    6 campos operativos nuevos al payload de rpc_create_order. Resto de
--    la función (lectura bajo RLS, validación de status/doble conversión)
--    sin cambios.
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

  -- ENFORCEMENT REAL (0029) — antes solo el botón de la UI ocultaba
  -- "Convertir a pedido" para Quotes históricas de CotizIA
  -- (cotizaciones/[id]/page.tsx); nada en DB lo impedía. Una Quote
  -- histórica nunca representa un compromiso comercial real de THÖREN con
  -- un cliente hoy — no debe poder generar un Order operativo, sin
  -- importar cómo se invoque este RPC.
  if v_quote.source <> 'thoren' then
    raise exception 'Esta cotización es histórica (origen: %) y no puede convertirse a pedido.', v_quote.source;
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
      'quantity', qi.quantity,
      'unit', qi.unit,
      'customer_requirements', qi.customer_requirements
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
    'source_quote_id', p_quote_id,
    'payment_terms', v_quote.payment_terms,
    'delivery_time', v_quote.delivery_time,
    'warranty', v_quote.warranty,
    'customer_notes', v_quote.customer_notes
  );

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    v_order_payload,
    coalesce(v_items_payload, '[]'::jsonb)
  );

  return v_order;
end;
$$;

-- =========================================================================
-- 5) rpc_delete_order — rechaza el DELETE cuando source_quote_id is not
--    null, antes de tocar cualquier fila (Storage, order_items, etc.). Un
--    Order manual (source_quote_id null) sigue exactamente igual, sujeto
--    únicamente a la RLS de siempre (orders_delete_own_or_admin, 0022) que
--    ya decide QUIÉN puede invocar este RPC.
-- =========================================================================
create or replace function rpc_delete_order(p_order_id uuid)
returns table (orphaned_media_paths text[], orphaned_file_paths text[])
language plpgsql
as $$
declare
  v_source_quote_id uuid;
  v_media_paths text[];
  v_file_paths text[];
  v_orphan_media text[];
  v_orphan_file text[];
begin
  select source_quote_id into v_source_quote_id from orders where id = p_order_id;

  if not found then
    raise exception 'Pedido no encontrado: %', p_order_id;
  end if;

  if v_source_quote_id is not null then
    raise exception 'Este pedido fue generado desde una cotización y no puede eliminarse.';
  end if;

  select array_remove(array_agg(distinct path), null)
    into v_media_paths
    from (
      select image_path as path from order_items where order_id = p_order_id
      union
      select projection_file_path as path from order_items where order_id = p_order_id
      union
      select oii.storage_path as path
        from order_item_images oii
        join order_items oi on oi.id = oii.order_item_id
        where oi.order_id = p_order_id
      union
      select storage_path as path from order_images where order_id = p_order_id
      union
      select projection_file_path as path from orders where id = p_order_id
    ) media;

  select array_remove(array_agg(distinct storage_path), null)
    into v_file_paths
    from order_files
    where order_id = p_order_id;

  delete from orders where id = p_order_id;

  if not found then
    raise exception 'Pedido no encontrado: %', p_order_id;
  end if;

  select array_remove(array_agg(p), null)
    into v_orphan_media
    from unnest(coalesce(v_media_paths, array[]::text[])) as p
    where not exists (
      select 1 from order_items where image_path = p
      union all
      select 1 from order_items where projection_file_path = p
      union all
      select 1 from order_item_images where storage_path = p
      union all
      select 1 from order_images where storage_path = p
      union all
      select 1 from orders where projection_file_path = p
      union all
      select 1 from product_catalog where image_path = p
    );

  select array_remove(array_agg(p), null)
    into v_orphan_file
    from unnest(coalesce(v_file_paths, array[]::text[])) as p
    where not exists (
      select 1 from order_files where storage_path = p
    );

  return query select coalesce(v_orphan_media, array[]::text[]), coalesce(v_orphan_file, array[]::text[]);
end;
$$;

commit;
