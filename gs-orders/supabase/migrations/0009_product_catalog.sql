-- GS Orders — Migración 0009: catálogo de productos (Fase 2)
--
-- Objetivo: poder ir agregando productos/modelos (Luz LED Grúa Viajera hoy;
-- Blue Spot, Red Spot, Warning Lights, Sensores, Barreras, etc. después)
-- sin requerir una migración por cada uno.
--
-- DECISIÓN — categoría como campo, no tabla:
-- `product_catalog.category` es un `text` libre, no una tabla aparte con
-- FK. Agregar una categoría nueva es un INSERT normal (vía la UI de
-- Configuración → Catálogo de productos), nunca una migración. La UI ya
-- ofrece las categorías existentes en un selector (para evitar variantes
-- como "Luz LED" vs "luz led") más la opción de escribir una nueva.
--
-- DECISIÓN — snapshot, no referencia dinámica:
-- order_items.catalog_product_id es una referencia OPCIONAL (para
-- trazabilidad: "de qué producto del catálogo vino esto"), pero NUNCA se
-- vuelve a consultar en Ver Pedido, Editar, Revisar, PDF ni Duplicar. Todo
-- lo que se necesita mostrar (modelo, descripción, imagen, potencia,
-- color) ya se copia a las columnas propias de order_items al momento de
-- seleccionar el producto (ver rpc_create_order/rpc_update_order más
-- abajo) — igual que ya se hacía con equipo/proyección en 0006 y con
-- instalación/superficie en 0007. Si el producto del catálogo se edita,
-- desactiva o incluso se borra más adelante, los pedidos ya creados no se
-- ven afectados: `on delete set null` en el FK asegura que borrar un
-- producto del catálogo (a futuro; hoy la UI no lo permite) nunca rompe un
-- order_item existente.
--
-- product_type (orders, sin cambios) sigue siendo la clasificación general
-- del pedido completo (proyector_gobo/luminaria/equipo_seguridad/
-- refaccion_accesorio/otro) — no se toca. category (catálogo, por
-- producto) es un eje independiente y más fino, específico de cada
-- order_item. Un pedido "luminaria" puede tener varios productos de
-- distintas categorías del catálogo; no hace falta que category tenga
-- relación 1 a 1 con product_type.

create table if not exists product_catalog (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  sku text not null,
  name text not null,
  description text,
  image_path text,
  power text,
  color text,
  lens_type text,
  technical_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SKU único, insensible a mayúsculas/minúsculas (mismo patrón que
-- salespeople_prefix_unique_per_unit en 0001: índice único sobre upper()).
-- Evita duplicados accidentales como "TLLTPB140R" vs "tlltpb140r". No se
-- fuerza el SKU a mayúsculas al guardar — se conserva tal como lo capturó
-- quien administra el catálogo.
create unique index if not exists product_catalog_sku_unique on product_catalog (upper(sku));

create index if not exists product_catalog_category_idx on product_catalog (category);
create index if not exists product_catalog_active_idx on product_catalog (active);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_product_catalog_updated_at'
  ) then
    create trigger trg_product_catalog_updated_at
      before update on product_catalog
      for each row execute function set_updated_at();
  end if;
end $$;

alter table product_catalog enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'product_catalog'
      and policyname = 'product_catalog_all_authenticated'
  ) then
    -- Mismo modelo que el resto de las tablas del proyecto hoy: cualquier
    -- usuario autenticado puede administrar el catálogo. Cuando exista
    -- ADMIN/VENDEDOR (Fase 3), esta policy se puede reemplazar por una que
    -- limite escritura a ADMIN sin tocar el schema de esta tabla.
    create policy "product_catalog_all_authenticated" on product_catalog
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Seed inicial: los dos modelos con los que arranca el catálogo. Solo se
-- capturan los datos provistos explícitamente — nada de potencia,
-- especificaciones técnicas ni imagen inventadas.
insert into product_catalog (category, sku, name, color, active)
values
  ('Luz LED Grúa Viajera', 'TLLTPB140R', 'Luz LED Grúa Viajera Roja', 'Rojo', true),
  ('Luz LED Grúa Viajera', 'TLLTPB140A', 'Luz LED Grúa Viajera Azul', 'Azul', true)
on conflict (upper(sku)) do nothing;

-- =========================================================================
-- order_items: referencia opcional al catálogo (trazabilidad) + snapshot
-- de color. El resto del snapshot (modelo, descripción, imagen, potencia)
-- ya se guarda en columnas existentes desde 0006/0007.
-- =========================================================================
alter table order_items
  add column if not exists catalog_product_id uuid references product_catalog(id) on delete set null,
  add column if not exists color text;

create index if not exists order_items_catalog_product_idx on order_items (catalog_product_id);

-- =========================================================================
-- rpc_create_order / rpc_update_order: order_items ahora también acepta
-- catalog_product_id y color por producto.
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
      projection_width, projection_height, projection_size_unit,
      installation_height, installation_height_unit, installation_distance, installation_orientation, installation_use,
      surface_type, surface_material, surface_notes, surface_notes_en,
      catalog_product_id, color
    )
    values (
      p_order_id, v_position, v_item->>'image_path', v_item->>'model', v_item->>'description',
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

-- rpc_duplicate_order: copia catalog_product_id y color TAL CUAL están
-- guardados en el order_item original (snapshot copiado, nunca vuelto a
-- consultar contra product_catalog).
create or replace function rpc_duplicate_order(p_source_order_id uuid, p_order_date date)
returns orders
language plpgsql
as $$
declare
  v_source orders;
  v_new orders;
  v_old_item record;
  v_new_item_id uuid;
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
    v_source.salesperson_id, p_order_date, v_source.client_name, v_source.supplier_name,
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

  for v_old_item in
    select * from order_items where order_id = p_source_order_id order by position asc, created_at asc
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
      v_new.id, v_old_item.position, v_old_item.image_path, v_old_item.model, v_old_item.description,
      v_old_item.quantity, v_old_item.notes,
      v_old_item.power, v_old_item.lens_type, v_old_item.lens_pending_factory,
      v_old_item.projection_description, v_old_item.projection_description_en,
      v_old_item.projection_file_path, v_old_item.projection_file_name, v_old_item.projection_file_type,
      v_old_item.projection_width, v_old_item.projection_height, v_old_item.projection_size_unit,
      v_old_item.installation_height, v_old_item.installation_height_unit, v_old_item.installation_distance,
      v_old_item.installation_orientation, v_old_item.installation_use,
      v_old_item.surface_type, v_old_item.surface_material, v_old_item.surface_notes, v_old_item.surface_notes_en,
      v_old_item.catalog_product_id, v_old_item.color
    )
    returning id into v_new_item_id;

    insert into order_item_images (order_item_id, kind, position, storage_path, file_name, file_type)
    select v_new_item_id, kind, position, storage_path, file_name, file_type
    from order_item_images
    where order_item_id = v_old_item.id;
  end loop;

  insert into order_images (order_id, position, storage_path, caption)
  select v_new.id, position, storage_path, caption
  from order_images where order_id = p_source_order_id;

  insert into order_files (order_id, storage_path, file_name, file_type, file_size)
  select v_new.id, storage_path, file_name, file_type, file_size
  from order_files where order_id = p_source_order_id;

  return v_new;
end;
$$;

-- rpc_delete_order: excluye del "huérfano" cualquier ruta de Storage que
-- siga en uso como imagen principal de un producto del catálogo — un
-- order_item puede tener image_path copiado de product_catalog.image_path
-- (mismo archivo físico), y borrar el pedido no debe romper la foto del
-- catálogo. Se agrega SOLO al chequeo "sigue referenciado", no a la
-- recolección de rutas del pedido (el catálogo nunca se borra desde aquí).
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
