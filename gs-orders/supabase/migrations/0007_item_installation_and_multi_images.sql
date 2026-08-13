-- GS Orders — Migración 0007: instalación/superficie por producto + múltiples imágenes por producto
--
-- Fase 1 de la segunda ronda de mejoras. Dos cambios, ambos aditivos:
--
-- 1) Instalación y superficie ya NO son globales para pedidos proyector/GOBO:
--    un mismo pedido puede tener dos proyectores instalados en condiciones
--    distintas (altura, orientación, distancia, uso interior/exterior, tipo
--    de superficie). Se agregan a order_items. Las columnas equivalentes en
--    `orders` NO se borran — quedan como legacy, igual que
--    projector_*/projection_* tras la migración 0006. Se migran (copian, no
--    mueven) al primer producto de cada pedido proyector/GOBO ya existente,
--    mismo patrón que 0006. `installation_use` es opcional: no bloquea el
--    paso a estado "Pedido" si queda vacío.
--
-- 2) "Una sola imagen" ya no alcanza: cada producto puede tener varias
--    imágenes de referencia del propio equipo y varias imágenes de lo que
--    se quiere proyectar. Se crea order_item_images (kind: reference |
--    projection). La columna escalar order_items.projection_file_path
--    (de 0006) NO se borra; se migra (copia) como la primera imagen de
--    proyección de cada producto que ya la tuviera, y de aquí en adelante
--    la aplicación lee/escribe la proyección exclusivamente en
--    order_item_images.

alter table order_items
  add column if not exists installation_height numeric(6,2),
  add column if not exists installation_height_unit text,
  add column if not exists installation_distance numeric(6,2),
  add column if not exists installation_orientation text,
  add column if not exists installation_use text,
  add column if not exists surface_type text,
  add column if not exists surface_material text,
  add column if not exists surface_notes text,
  add column if not exists surface_notes_en text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_installation_height_unit_check') then
    alter table order_items add constraint order_items_installation_height_unit_check
      check (installation_height_unit in ('m', 'cm', 'pies'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_installation_orientation_check') then
    alter table order_items add constraint order_items_installation_orientation_check
      check (installation_orientation in ('piso', 'pared', 'inclinado', 'otro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_installation_use_check') then
    alter table order_items add constraint order_items_installation_use_check
      check (installation_use in ('interior', 'exterior', 'semi_exterior'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_surface_type_check') then
    alter table order_items add constraint order_items_surface_type_check
      check (surface_type in ('piso', 'pared', 'techo', 'equipo', 'rack', 'anden', 'pasillo', 'otro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_surface_material_check') then
    alter table order_items add constraint order_items_surface_material_check
      check (surface_material in ('concreto', 'epoxico', 'asfalto', 'metal', 'pintura', 'otro'));
  end if;
end $$;

-- Backfill idempotente: instalación/superficie de `orders` -> primer
-- producto (menor position) de cada pedido proyector/GOBO. Mismo patrón
-- que el backfill de equipo/proyección en 0006.
update order_items oi
set
  installation_height = o.installation_height,
  installation_height_unit = o.installation_height_unit,
  installation_distance = o.installation_distance,
  installation_orientation = o.installation_orientation,
  installation_use = o.installation_use,
  surface_type = o.surface_type,
  surface_material = o.surface_material,
  surface_notes = o.surface_notes,
  surface_notes_en = o.surface_notes_en
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

-- =========================================================================
-- order_item_images — imágenes de referencia del producto e imágenes a
-- proyectar (0 o varias de cada tipo, por producto).
-- =========================================================================
create table if not exists order_item_images (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  kind text not null check (kind in ('reference', 'projection')),
  position integer not null default 0,
  storage_path text not null,
  file_name text,
  file_type text,
  created_at timestamptz not null default now()
);

create index if not exists order_item_images_item_idx on order_item_images (order_item_id);

alter table order_item_images enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'order_item_images'
      and policyname = 'order_item_images_all_authenticated'
  ) then
    create policy "order_item_images_all_authenticated" on order_item_images
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Backfill idempotente: la imagen a proyectar única que ya tenía cada
-- producto (order_items.projection_file_path, de 0006) se copia como su
-- primera imagen de proyección en order_item_images. El "not exists" evita
-- duplicar si esta migración se corre más de una vez.
insert into order_item_images (order_item_id, kind, position, storage_path, file_name, file_type)
select id, 'projection', 0, projection_file_path, projection_file_name, projection_file_type
from order_items
where projection_file_path is not null
  and not exists (
    select 1 from order_item_images
    where order_item_id = order_items.id and kind = 'projection'
  );

-- =========================================================================
-- rpc_create_order / rpc_update_order: order_items ahora también acepta
-- instalación/superficie por producto, y cada item trae sus imágenes de
-- referencia/proyección (reference_images / projection_images).
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
      surface_type, surface_material, surface_notes, surface_notes_en
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
      v_item->>'surface_type', v_item->>'surface_material', v_item->>'surface_notes', v_item->>'surface_notes_en'
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

  -- El cascade de order_items -> order_item_images (on delete cascade) ya
  -- limpia las imágenes por producto al borrar los items.
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
      surface_type, surface_material, surface_notes, surface_notes_en
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
      v_item->>'surface_type', v_item->>'surface_material', v_item->>'surface_notes', v_item->>'surface_notes_en'
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

-- rpc_duplicate_order: se reescribe como loop (en vez de INSERT...SELECT
-- masivo) porque ahora necesita el id NUEVO de cada order_item para copiar
-- sus order_item_images correspondientes.
create or replace function rpc_duplicate_order(p_source_order_id uuid)
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
      surface_type, surface_material, surface_notes, surface_notes_en
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
      v_old_item.surface_type, v_old_item.surface_material, v_old_item.surface_notes, v_old_item.surface_notes_en
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

-- rpc_delete_order: la orphan-detection ahora también revisa
-- order_item_images (imágenes de referencia/proyección por producto).
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
