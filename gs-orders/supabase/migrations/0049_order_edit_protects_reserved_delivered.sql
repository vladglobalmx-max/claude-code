-- =========================================================================
-- GS Orders — Migración 0049: editar un Pedido ya no puede dejar huérfana
-- una reserva de inventario o una entrega ya hecha.
-- =========================================================================
-- HALLAZGO (auditoría de lógica de negocio, #2): `rpc_update_order` borra
-- TODAS las filas de `order_items` y las reinserta desde cero en cada
-- edición (ver 0035, DECISIÓN sobre `order_item_id` — los ids nunca son
-- estables entre ediciones, es un patrón conocido y aceptado), pero nunca
-- comparaba la cantidad nueva contra lo que YA se reservó
-- (`inventory_reservations`) o entregó (`delivery_items`) de ese producto
-- en ese pedido.
--
-- Escenario real: se reserva y entrega 10 piezas de un producto (ya
-- `fn_check_order_delivery_completion` marcó el pedido `completado`).
-- Alguien edita el pedido y baja ese producto a 3, o lo quita del todo.
-- `rpc_update_order` lo permitía sin más — `order_items` queda
-- desincronizado de lo que `inventory_reservations`/`delivery_items`
-- siguen mostrando reservado/entregado contra ese `order_id` +
-- `catalog_product_id`: stock de almacén comprometido para siempre, sin
-- ningún camino en la app para liberarlo (nada vuelve a apuntar a ese
-- producto desde este pedido si se quitó del todo).
--
-- Fix: antes de tocar `order_items`, por cada `catalog_product_id` que YA
-- tenía el pedido, compara la cantidad nueva (sumada de `p_items`) contra
-- lo entregado y lo reservado ACTIVO (`released_at is null` — una reserva
-- ya liberada no compromete stock real, no debe bloquear nada). Si la
-- cantidad nueva queda por debajo de cualquiera de las dos, bloquea con un
-- mensaje claro — igual que el resto del proyecto (mensajes de excepción
-- entendibles en vez de dejar el dato desincronizado en silencio).
-- =========================================================================
begin;

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
  v_new_qty integer;
  v_reserved_qty integer;
  v_delivered_qty integer;
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

  -- Ver HALLAZGO arriba: protege contra dejar huérfana una reserva o
  -- entrega ya hecha de un producto que el pedido ya traía.
  for v_catalog_product_id in select unnest(v_existing_catalog_product_ids)
  loop
    select coalesce(sum(nullif(item->>'quantity', '')::integer), 0)
      into v_new_qty
      from jsonb_array_elements(p_items) as item
      where nullif(item->>'catalog_product_id', '')::uuid = v_catalog_product_id;

    select coalesce(sum(quantity), 0)
      into v_reserved_qty
      from inventory_reservations
      where order_id = p_order_id and product_id = v_catalog_product_id and released_at is null;

    select coalesce(sum(di.quantity_delivered), 0)
      into v_delivered_qty
      from delivery_items di
      join deliveries d on d.id = di.delivery_id
      where d.order_id = p_order_id and di.catalog_product_id = v_catalog_product_id;

    if v_new_qty < v_delivered_qty then
      raise exception 'Ya se entregaron % pieza(s) de este producto en este pedido — no puedes dejar la cantidad en % (mínimo %, lo ya entregado).',
        v_delivered_qty, v_new_qty, v_delivered_qty;
    end if;

    if v_new_qty < v_reserved_qty then
      raise exception 'Hay % pieza(s) reservadas en inventario para este producto en este pedido — libera o ajusta la reserva antes de bajar la cantidad a %.',
        v_reserved_qty, v_new_qty;
    end if;
  end loop;

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
