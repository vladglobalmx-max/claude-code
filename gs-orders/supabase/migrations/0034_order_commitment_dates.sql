-- =========================================================================
-- THÖREN — Fase 6K: Fechas Compromiso y Vencimientos de Pedidos
-- =========================================================================
-- OBJETIVO: agregar seguimiento contra fechas compromiso reales de cada
-- Pedido, y un estado de vencimiento (En tiempo / Próximo a vencer /
-- Vencido) que se integra con la sección "Requieren atención" del
-- Dashboard (Fase 6I/6J). CERO cambios a Quotes. CERO dinero.
--
-- =========================================================================
-- DECISIÓN — 4 columnas nuevas en `orders`, todas nullable, sin default
-- =========================================================================
-- supplier_commitment_date  (fecha compromiso proveedor)
-- estimated_reception_date  (fecha estimada de recepción)
-- scheduled_delivery_date   (fecha programada de entrega/instalación)
-- actual_completion_date    (fecha real de entrega/cierre, "cuando aplique")
--
-- Todas `date` (igual tipo que `order_date`), nullable sin default — un
-- pedido puede no tener todavía una fecha compromiso capturada, y nunca se
-- inventa una (mismo criterio de todo el proyecto). Son columnas de
-- `orders` (a nivel de pedido completo), no de `order_items`: son fechas
-- de cumplimiento logístico del pedido como unidad, igual criterio que
-- payment_terms/delivery_time en Quotes (0025) — no son especificaciones
-- técnicas por producto.
--
-- =========================================================================
-- REGLA FINAL — qué fecha es "la relevante" según operational_status (0033)
-- =========================================================================
-- Confirmada por el usuario (Fase 6K — AJUSTE FINAL):
--   pedido / en_proceso                          -> sin vencimiento por fecha
--                                                    (solo antigüedad, Fase 6J)
--   ordenado_a_proveedor                         -> supplier_commitment_date,
--                                                    si falta usa como fallback
--                                                    estimated_reception_date
--   en_transito                                  -> estimated_reception_date
--   recibido / programado_entrega_instalacion    -> scheduled_delivery_date
--   completado / cancelado                       -> sin vencimiento
-- actual_completion_date es dato histórico/auditoría, nunca se usa para
-- calcular vencimiento. Ver src/lib/dashboard/due-dates.ts (única fuente
-- de verdad de este cálculo).
--
-- =========================================================================
-- REGLA FINAL — estado de vencimiento: 2 días para "Próximo a vencer"
-- =========================================================================
-- Confirmada por el usuario: fecha ya pasada = Vencido; hoy o dentro de los
-- próximos 2 días calendario = Próximo a vencer; más de 2 días = En tiempo.
-- Si el estado requiere fecha relevante pero no está capturada, se muestra
-- "Sin fecha" — nunca se marca artificialmente "En tiempo" sin dato real.
-- Ver lib/dashboard/due-dates.ts.
--
-- =========================================================================
-- DECISIÓN — cero cambios a rpc_duplicate_order / rpc_create_order_from_quote
-- =========================================================================
-- Mismo criterio que operational_status (0033): un pedido duplicado es un
-- pedido NUEVO — sus fechas compromiso todavía no se han vuelto a
-- planificar, así que nunca hereda las del origen (nacen NULL, sin
-- vencimiento hasta que alguien las capture). rpc_create_order_from_quote
-- tampoco las toca: Quotes no tiene estas columnas, no hay nada que
-- mapear, y no se le agrega ninguna.
--
-- =========================================================================
-- DECISIÓN — rpc_update_order: sobreescritura directa, no "ausente ≠ null"
-- =========================================================================
-- Igual criterio que supplier_name/general_notes/payment_terms (campos
-- escalares simples, no relaciones/FK) — el patrón "ausente ≠ null" de
-- 0022 se reserva para customer_id/business_unit_id, que si se omiten
-- deben preservar el valor actual por ser referencias. Estas 4 fechas
-- siempre vienen incluidas en el payload que arma el Order Form (aunque
-- sea "" -> null), así que sobreescritura directa es exactamente
-- equivalente y más simple.
--
-- =========================================================================
-- CORRECCIÓN — bug de pérdida de datos en rpc_update_order (Fase 6K —
-- AJUSTE FINAL, autorizada explícitamente por el usuario)
-- =========================================================================
-- Al editar rpc_update_order para agregar las 4 fechas se detectó que su
-- INSERT de order_items NO incluía `unit`/`customer_requirements` (0032 las
-- agregó a rpc_create_order pero nunca a rpc_update_order) — cada vez que
-- se editaba un pedido, esas dos columnas se perdían en todas sus líneas.
-- Se reportó como hallazgo fuera de alcance en la primera versión de esta
-- migración; el usuario autorizó corregirlo aquí mismo (0034 todavía no se
-- ha ejecutado en Supabase Cloud). El fix es agregar `unit,
-- customer_requirements` al INSERT de order_items de rpc_update_order,
-- igual que ya existía en rpc_create_order desde 0032 — ver sección 3 más
-- abajo y la prueba dedicada en 0034_functional_tests.sql.
-- =========================================================================

begin;

-- =========================================================================
-- 1) Columnas nuevas
-- =========================================================================
alter table orders
  add column if not exists supplier_commitment_date date,
  add column if not exists estimated_reception_date date,
  add column if not exists scheduled_delivery_date date,
  add column if not exists actual_completion_date date;

-- =========================================================================
-- 2) rpc_create_order — agrega las 4 fechas a la lista explícita de
--    columnas del INSERT. Sin cambios de firma, sin cambios de
--    comportamiento en nada más (idéntica a la versión de 0032 salvo esto).
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
  v_catalog_product_id uuid;
  v_require_active boolean;
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
    v_final_salesperson_id := v_my_salesperson_id;
  end if;

  v_organization_id := current_user_organization_id();

  v_salesperson_org_id := fn_salesperson_organization_id(v_final_salesperson_id);

  if v_salesperson_org_id is not null and v_salesperson_org_id <> v_organization_id then
    raise exception 'El vendedor seleccionado no pertenece a tu organización.';
  end if;

  v_customer_id := nullif(p_order->>'customer_id', '')::uuid;
  v_business_unit_id := nullif(p_order->>'business_unit_id', '')::uuid;
  v_source_quote_id := nullif(p_order->>'source_quote_id', '')::uuid;

  if v_source_quote_id is not null then
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

  v_require_active := v_source_quote_id is null;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    if v_catalog_product_id is not null then
      perform fn_check_order_item_catalog_product(v_catalog_product_id, v_organization_id, v_business_unit_id, v_require_active);
    end if;
  end loop;

  insert into orders (
    id, organization_id, customer_id, business_unit_id, source_quote_id,
    salesperson_id, order_date, client_name, supplier_name, product_type, product_type_name_snapshot, status,
    general_notes, vendor_notes, vendor_notes_en,
    payment_terms, delivery_time, warranty, customer_notes,
    supplier_commitment_date, estimated_reception_date, scheduled_delivery_date, actual_completion_date,
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
    nullif(p_order->>'supplier_commitment_date', '')::date,
    nullif(p_order->>'estimated_reception_date', '')::date,
    nullif(p_order->>'scheduled_delivery_date', '')::date,
    nullif(p_order->>'actual_completion_date', '')::date,
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
-- 3) rpc_update_order — agrega las 4 fechas al UPDATE (sobreescritura
--    directa, ver DECISIÓN arriba) Y corrige el bug de pérdida de
--    unit/customer_requirements en el INSERT de order_items (ver
--    CORRECCIÓN arriba). Resto de la función sin más cambios de
--    comportamiento respecto a 0032.
-- =========================================================================
create or replace function rpc_update_order(
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
  v_organization_id uuid;
  v_customer_id uuid;
  v_business_unit_id uuid;
  v_client_name text;
  v_existing_catalog_product_ids uuid[];
  v_catalog_product_id uuid;
  v_require_active boolean;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  v_organization_id := current_user_organization_id();

  if p_order ? 'customer_id' then
    v_customer_id := nullif(p_order->>'customer_id', '')::uuid;
  else
    select customer_id into v_customer_id from orders where id = p_order_id;
  end if;

  if p_order ? 'business_unit_id' then
    v_business_unit_id := nullif(p_order->>'business_unit_id', '')::uuid;
  else
    select business_unit_id into v_business_unit_id from orders where id = p_order_id;
  end if;

  if v_customer_id is not null then
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

  select coalesce(array_agg(distinct catalog_product_id) filter (where catalog_product_id is not null), array[]::uuid[])
    into v_existing_catalog_product_ids
    from order_items where order_id = p_order_id;

  update orders set
    customer_id = v_customer_id,
    business_unit_id = v_business_unit_id,
    client_name = v_client_name,
    supplier_name = p_order->>'supplier_name',
    product_type = p_order->>'product_type',
    product_type_name_snapshot = v_product_type_name,
    status = coalesce(p_order->>'status', status),
    general_notes = p_order->>'general_notes',
    vendor_notes = p_order->>'vendor_notes',
    vendor_notes_en = p_order->>'vendor_notes_en',
    supplier_commitment_date = nullif(p_order->>'supplier_commitment_date', '')::date,
    estimated_reception_date = nullif(p_order->>'estimated_reception_date', '')::date,
    scheduled_delivery_date = nullif(p_order->>'scheduled_delivery_date', '')::date,
    actual_completion_date = nullif(p_order->>'actual_completion_date', '')::date,
    projector_model = p_order->>'projector_model',
    projector_quantity = nullif(p_order->>'projector_quantity', '')::integer,
    projector_power = p_order->>'projector_power',
    projector_lens_type = p_order->>'projector_lens_type',
    projector_lens_pending_factory = coalesce((p_order->>'projector_lens_pending_factory')::boolean, false),
    projection_description = p_order->>'projection_description',
    projection_description_en = p_order->>'projection_description_en',
    projection_file_path = p_order->>'projection_file_path',
    projection_file_name = p_order->>'projection_file_name',
    projection_file_type = p_order->>'projection_file_type',
    projection_width = nullif(p_order->>'projection_width', '')::numeric,
    projection_height = nullif(p_order->>'projection_height', '')::numeric,
    projection_size_unit = p_order->>'projection_size_unit',
    installation_height = nullif(p_order->>'installation_height', '')::numeric,
    installation_height_unit = p_order->>'installation_height_unit',
    installation_distance = nullif(p_order->>'installation_distance', '')::numeric,
    installation_orientation = p_order->>'installation_orientation',
    installation_use = p_order->>'installation_use',
    surface_type = p_order->>'surface_type',
    surface_material = p_order->>'surface_material',
    surface_notes = p_order->>'surface_notes',
    surface_notes_en = p_order->>'surface_notes_en'
  where id = p_order_id
  returning * into v_order;

  if not found then
    raise exception 'Pedido no encontrado: %', p_order_id;
  end if;

  delete from order_items where order_id = p_order_id;
  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    if v_catalog_product_id is not null then
      v_require_active := not (v_catalog_product_id = any(v_existing_catalog_product_ids));
      perform fn_check_order_item_catalog_product(v_catalog_product_id, v_organization_id, v_business_unit_id, v_require_active);
    end if;

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
      p_order_id, v_position, v_item->>'image_path', v_item->>'model', v_item->>'description',
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
      v_catalog_product_id, v_item->>'color'
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

  delete from order_images where order_id = p_order_id;
  v_position := 0;
  for v_image in select * from jsonb_array_elements(p_images)
  loop
    insert into order_images (order_id, position, storage_path, caption)
    values (p_order_id, v_position, v_image->>'storage_path', v_image->>'caption');
    v_position := v_position + 1;
  end loop;

  delete from order_files where order_id = p_order_id;
  for v_file in select * from jsonb_array_elements(p_files)
  loop
    insert into order_files (order_id, storage_path, file_name, file_type, file_size)
    values (
      p_order_id, v_file->>'storage_path', v_file->>'file_name', v_file->>'file_type',
      nullif(v_file->>'file_size', '')::bigint
    );
  end loop;

  return v_order;
end;
$$;

commit;
