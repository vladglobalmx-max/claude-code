-- GS Orders — Migración 0006: equipo y proyección por producto
--
-- Antes, "Equipo" (modelo/cantidad/potencia/lente) e "Imagen que se
-- proyectará" (descripción/imagen/medidas) vivían en columnas de `orders`,
-- una sola vez por pedido — aunque el pedido tuviera varios productos. Un
-- pedido con dos proyectores TLL200 que debían proyectar imágenes distintas
-- no se podía capturar correctamente: solo había un lugar para "la" imagen
-- a proyectar.
--
-- Esta migración mueve esa información a order_items (una fila por
-- producto), donde ya vive el modelo/cantidad/imagen principal del
-- producto. Instalación y superficie NO se mueven: no varían por producto,
-- siguen siendo columnas de `orders`.
--
-- Es aditiva: no se borra ninguna columna de `orders` ni ninguna fila
-- existente. Los pedidos de proyector/GOBO ya creados tenían un solo juego
-- de datos de equipo/proyección a nivel pedido; esta migración lo COPIA
-- (no lo mueve) al primer producto (menor position) de cada pedido, para
-- que se sigan viendo completos con la nueva estructura. El dato original
-- en `orders` queda intacto — sin usarse por la app de aquí en adelante,
-- pero disponible para consulta manual o rollback.

alter table order_items
  add column if not exists power text,
  add column if not exists lens_type text,
  add column if not exists lens_pending_factory boolean not null default false,
  add column if not exists projection_description text,
  add column if not exists projection_description_en text,
  add column if not exists projection_file_path text,
  add column if not exists projection_file_name text,
  add column if not exists projection_file_type text,
  add column if not exists projection_width numeric(6,2),
  add column if not exists projection_height numeric(6,2),
  add column if not exists projection_size_unit text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'order_items_projection_size_unit_check'
  ) then
    alter table order_items
      add constraint order_items_projection_size_unit_check
      check (projection_size_unit in ('m', 'cm'));
  end if;
end $$;

-- Backfill idempotente: siempre copia los mismos valores de `orders` al
-- primer order_item de cada pedido proyector/GOBO (no depende de que las
-- columnas nuevas estén vacías), así que se puede volver a correr sin
-- efectos distintos.
update order_items oi
set
  power = o.projector_power,
  lens_type = case when o.projector_lens_pending_factory then null else o.projector_lens_type end,
  lens_pending_factory = coalesce(o.projector_lens_pending_factory, false),
  projection_description = o.projection_description,
  projection_description_en = o.projection_description_en,
  projection_file_path = o.projection_file_path,
  projection_file_name = o.projection_file_name,
  projection_file_type = o.projection_file_type,
  projection_width = o.projection_width,
  projection_height = o.projection_height,
  projection_size_unit = o.projection_size_unit
from orders o
where oi.order_id = o.id
  and o.product_type = 'proyector_gobo'
  and oi.id = (
    select oi2.id
    from order_items oi2
    where oi2.order_id = o.id
    order by oi2.position asc, oi2.created_at asc
    limit 1
  );

-- rpc_create_order / rpc_update_order: el insert en `orders` no cambia
-- (instalación/superficie siguen ahí); solo cambia cómo se insertan los
-- order_items, que ahora aceptan equipo + proyección por producto.

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
    general_notes, vendor_notes, vendor_notes_en,
    projector_model, projector_quantity, projector_power, projector_lens_type, projector_lens_pending_factory,
    projection_description, projection_description_en, projection_file_path, projection_file_name, projection_file_type,
    projection_width, projection_height, projection_size_unit,
    installation_height, installation_height_unit, installation_distance, installation_orientation, installation_use,
    surface_type, surface_material, surface_notes, surface_notes_en
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
      projection_width, projection_height, projection_size_unit
    )
    values (
      v_order.id, v_position, v_item->>'image_path', v_item->>'model', v_item->>'description',
      coalesce(nullif(v_item->>'quantity', '')::integer, 1), v_item->>'notes',
      v_item->>'power', v_item->>'lens_type', coalesce((v_item->>'lens_pending_factory')::boolean, false),
      v_item->>'projection_description', v_item->>'projection_description_en',
      v_item->>'projection_file_path', v_item->>'projection_file_name', v_item->>'projection_file_type',
      nullif(v_item->>'projection_width', '')::numeric, nullif(v_item->>'projection_height', '')::numeric,
      v_item->>'projection_size_unit'
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
    vendor_notes_en = p_order->>'vendor_notes_en',
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
    insert into order_items (
      order_id, position, image_path, model, description, quantity, notes,
      power, lens_type, lens_pending_factory,
      projection_description, projection_description_en,
      projection_file_path, projection_file_name, projection_file_type,
      projection_width, projection_height, projection_size_unit
    )
    values (
      p_order_id, v_position, v_item->>'image_path', v_item->>'model', v_item->>'description',
      coalesce(nullif(v_item->>'quantity', '')::integer, 1), v_item->>'notes',
      v_item->>'power', v_item->>'lens_type', coalesce((v_item->>'lens_pending_factory')::boolean, false),
      v_item->>'projection_description', v_item->>'projection_description_en',
      v_item->>'projection_file_path', v_item->>'projection_file_name', v_item->>'projection_file_type',
      nullif(v_item->>'projection_width', '')::numeric, nullif(v_item->>'projection_height', '')::numeric,
      v_item->>'projection_size_unit'
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

-- rpc_duplicate_order: copia también el equipo/proyección de cada producto
-- (misma semántica que antes para image_path/storage_path: se copia la
-- REFERENCIA a la ruta de Storage, no se sube un archivo nuevo — el
-- pedido duplicado comparte el archivo físico con el original hasta que se
-- reemplace).
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
    general_notes, vendor_notes, vendor_notes_en,
    projector_model, projector_quantity, projector_power, projector_lens_type, projector_lens_pending_factory,
    projection_description, projection_description_en, projection_file_path, projection_file_name, projection_file_type,
    projection_width, projection_height, projection_size_unit,
    installation_height, installation_height_unit, installation_distance, installation_orientation, installation_use,
    surface_type, surface_material, surface_notes, surface_notes_en
  )
  values (
    v_source.salesperson_id, current_date, v_source.client_name, v_source.supplier_name,
    v_source.product_type, 'borrador',
    v_source.general_notes, v_source.vendor_notes, v_source.vendor_notes_en,
    v_source.projector_model, v_source.projector_quantity, v_source.projector_power,
    v_source.projector_lens_type, v_source.projector_lens_pending_factory,
    v_source.projection_description, v_source.projection_description_en, v_source.projection_file_path,
    v_source.projection_file_name, v_source.projection_file_type,
    v_source.projection_width, v_source.projection_height, v_source.projection_size_unit,
    v_source.installation_height, v_source.installation_height_unit, v_source.installation_distance,
    v_source.installation_orientation, v_source.installation_use,
    v_source.surface_type, v_source.surface_material, v_source.surface_notes, v_source.surface_notes_en
  )
  returning * into v_new;

  insert into order_items (
    order_id, position, image_path, model, description, quantity, notes,
    power, lens_type, lens_pending_factory,
    projection_description, projection_description_en,
    projection_file_path, projection_file_name, projection_file_type,
    projection_width, projection_height, projection_size_unit
  )
  select
    v_new.id, position, image_path, model, description, quantity, notes,
    power, lens_type, lens_pending_factory,
    projection_description, projection_description_en,
    projection_file_path, projection_file_name, projection_file_type,
    projection_width, projection_height, projection_size_unit
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

-- rpc_delete_order: la imagen a proyectar ahora suele vivir en
-- order_items.projection_file_path (antes solo en orders.projection_file_path).
-- Se revisan ambas ubicaciones al recolectar rutas y al decidir qué quedó
-- huérfano, para no borrar un archivo que otro pedido/producto siga usando
-- ni dejar huérfanos sin detectar en pedidos migrados por esta migración.
create or replace function rpc_delete_order(p_order_id uuid)
returns table (orphaned_media_paths text[], orphaned_file_paths text[])
language plpgsql
as $$
declare
  v_media_paths text[];
  v_file_paths text[];
  v_orphan_media text[];
  v_orphan_file text[];
begin
  select array_remove(array_agg(distinct path), null)
    into v_media_paths
    from (
      select image_path as path from order_items where order_id = p_order_id
      union
      select projection_file_path as path from order_items where order_id = p_order_id
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
      select 1 from order_images where storage_path = p
      union all
      select 1 from orders where projection_file_path = p
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
