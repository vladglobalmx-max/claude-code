-- GS Orders — Migración 0004: mutaciones atómicas de pedidos
--
-- Antes, crear/editar/duplicar un pedido se hacía con varias llamadas
-- separadas desde la app (insert de orders, luego insert de order_items,
-- luego order_images, luego order_files). Si la primera llamada generaba el
-- folio (consumiendo el consecutivo del vendedor) y una llamada posterior
-- fallaba, el pedido quedaba a medias PERO el consecutivo ya se había
-- gastado — folios "fantasma" nunca visibles en un pedido real.
--
-- Estas funciones envuelven cada operación completa en una sola transacción
-- de Postgres: si cualquier insert falla, Postgres revierte todo, incluido
-- el incremento de salespeople.sequence_current hecho por el trigger de
-- folio (0002_folio.sql). SECURITY INVOKER (el default): corren con los
-- permisos del usuario autenticado que llama, así que RLS sigue aplicando
-- exactamente igual que si la app hiciera los inserts directamente.

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
  v_image jsonb;
  v_file jsonb;
  v_position integer;
begin
  insert into orders (
    id, salesperson_id, order_date, client_name, supplier_name, product_type, status,
    general_notes, vendor_notes,
    projector_model, projector_quantity, projector_power, projector_lens_type, projector_lens_pending_factory,
    projection_description, projection_file_path, projection_file_name, projection_file_type,
    projection_width, projection_height, projection_size_unit,
    installation_height, installation_height_unit, installation_distance, installation_orientation, installation_use,
    surface_type, surface_material, surface_notes
  )
  values (
    p_order_id,
    (p_order->>'salesperson_id')::uuid,
    (p_order->>'order_date')::date,
    p_order->>'client_name',
    p_order->>'supplier_name',
    p_order->>'product_type',
    coalesce(p_order->>'status', 'borrador'),
    p_order->>'general_notes',
    p_order->>'vendor_notes',
    p_order->>'projector_model',
    nullif(p_order->>'projector_quantity', '')::integer,
    p_order->>'projector_power',
    p_order->>'projector_lens_type',
    coalesce((p_order->>'projector_lens_pending_factory')::boolean, false),
    p_order->>'projection_description',
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
    p_order->>'surface_notes'
  )
  returning * into v_order;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (order_id, position, image_path, model, description, quantity, notes)
    values (
      v_order.id, v_position, v_item->>'image_path', v_item->>'model', v_item->>'description',
      coalesce(nullif(v_item->>'quantity', '')::integer, 1), v_item->>'notes'
    );
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

-- Reemplaza por completo campos + productos + imágenes + archivos de un
-- pedido existente. Deliberadamente NO toca salesperson_id ni order_date:
-- son inmutables una vez generado el folio (además reforzado por el
-- trigger trg_orders_prevent_folio_change, que sigue siendo la autoridad).
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
  v_image jsonb;
  v_file jsonb;
  v_position integer;
begin
  update orders set
    client_name = p_order->>'client_name',
    supplier_name = p_order->>'supplier_name',
    product_type = p_order->>'product_type',
    status = coalesce(p_order->>'status', status),
    general_notes = p_order->>'general_notes',
    vendor_notes = p_order->>'vendor_notes',
    projector_model = p_order->>'projector_model',
    projector_quantity = nullif(p_order->>'projector_quantity', '')::integer,
    projector_power = p_order->>'projector_power',
    projector_lens_type = p_order->>'projector_lens_type',
    projector_lens_pending_factory = coalesce((p_order->>'projector_lens_pending_factory')::boolean, false),
    projection_description = p_order->>'projection_description',
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
    surface_notes = p_order->>'surface_notes'
  where id = p_order_id
  returning * into v_order;

  if not found then
    raise exception 'Pedido no encontrado: %', p_order_id;
  end if;

  delete from order_items where order_id = p_order_id;
  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (order_id, position, image_path, model, description, quantity, notes)
    values (
      p_order_id, v_position, v_item->>'image_path', v_item->>'model', v_item->>'description',
      coalesce(nullif(v_item->>'quantity', '')::integer, 1), v_item->>'notes'
    );
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

-- Duplica un pedido completo en una sola transacción: nuevo folio, nueva
-- fecha (hoy) y nuevo consecutivo del mismo vendedor (vía el trigger de
-- folio), copiando cliente/proveedor/tipo/especificaciones/observaciones y
-- las referencias a productos/imágenes/archivos ya subidos a Storage.
-- Nunca copia id, folio, consecutivo ni timestamps del original.
create or replace function rpc_duplicate_order(p_source_order_id uuid)
returns orders
language plpgsql
as $$
declare
  v_source orders;
  v_new orders;
begin
  select * into v_source from orders where id = p_source_order_id;
  if not found then
    raise exception 'Pedido original no encontrado: %', p_source_order_id;
  end if;

  insert into orders (
    salesperson_id, order_date, client_name, supplier_name, product_type, status,
    general_notes, vendor_notes,
    projector_model, projector_quantity, projector_power, projector_lens_type, projector_lens_pending_factory,
    projection_description, projection_file_path, projection_file_name, projection_file_type,
    projection_width, projection_height, projection_size_unit,
    installation_height, installation_height_unit, installation_distance, installation_orientation, installation_use,
    surface_type, surface_material, surface_notes
  )
  values (
    v_source.salesperson_id, current_date, v_source.client_name, v_source.supplier_name,
    v_source.product_type, 'borrador',
    v_source.general_notes, v_source.vendor_notes,
    v_source.projector_model, v_source.projector_quantity, v_source.projector_power,
    v_source.projector_lens_type, v_source.projector_lens_pending_factory,
    v_source.projection_description, v_source.projection_file_path, v_source.projection_file_name,
    v_source.projection_file_type,
    v_source.projection_width, v_source.projection_height, v_source.projection_size_unit,
    v_source.installation_height, v_source.installation_height_unit, v_source.installation_distance,
    v_source.installation_orientation, v_source.installation_use,
    v_source.surface_type, v_source.surface_material, v_source.surface_notes
  )
  returning * into v_new;

  insert into order_items (order_id, position, image_path, model, description, quantity, notes)
  select v_new.id, position, image_path, model, description, quantity, notes
  from order_items where order_id = p_source_order_id;

  insert into order_images (order_id, position, storage_path, caption)
  select v_new.id, position, storage_path, caption
  from order_images where order_id = p_source_order_id;

  insert into order_files (order_id, storage_path, file_name, file_type, file_size)
  select v_new.id, storage_path, file_name, file_type, file_size
  from order_files where order_id = p_source_order_id;

  return v_new;
end;
$$;
