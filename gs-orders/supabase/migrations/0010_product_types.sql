-- GS Orders — Migración 0010: catálogo de tipos de producto
--
-- Objetivo: "Tipo de producto" en Nuevo Pedido deja de ser un select
-- hardcodeado en el código (PRODUCT_TYPE_LABELS) y pasa a administrarse
-- desde Configuración → Tipos de producto: agregar, editar nombre,
-- activar/desactivar. Sin borrado físico en esta fase.
--
-- DECISIÓN — mantener orders.product_type tal cual, sin convertirlo a FK
-- de uuid ni tocar su tipo de columna:
-- orders.product_type ya es (y sigue siendo) un `text` plano que guarda un
-- código estable ("proyector_gobo", "luminaria", …) — nunca fue un enum a
-- nivel de base de datos, solo se validaba con un z.enum() en la app. Esto
-- es exactamente lo que necesitamos: el código NO cambia con esta
-- migración, así que CERO pedidos existentes se tocan y CERO RPCs cambian
-- de firma. Lo único que agregamos es una tabla `product_types` cuyo
-- `code` es la fuente de verdad de qué códigos son válidos, más una FK
-- (orders.product_type → product_types.code) para integridad real —
-- agregada con NOT VALID + VALIDATE CONSTRAINT (patrón seguro para no
-- bloquear ni arriesgar la tabla orders en producción) y validada contra
-- los datos ya existentes antes de cerrar esta migración.
--
-- DECISIÓN — code interno estable vs name editable:
-- `code` se normaliza a slug (minúsculas/guion_bajo) al crearlo desde la
-- UI y NUNCA se vuelve a editar después (el formulario de edición no lo
-- expone como campo editable). Todo el comportamiento especial de
-- Proyector/GOBO (imagen a proyectar, instalación, superficie) sigue
-- dependiendo exclusivamente de `product_type === 'proyector_gobo'` en el
-- código — comparación contra el `code`, nunca contra `name` — por lo que
-- renombrar "Proyector / GOBO" a cualquier otra cosa en la UI JAMÁS rompe
-- esa lógica. No se agrega un campo behavior/type_family aparte: el code
-- ya cumple ese rol y agregar un campo más sería sobreingeniería.
--
-- DECISIÓN — trazabilidad ante renombres (product_type_name_snapshot):
-- orders.product_type_name_snapshot guarda el nombre visible del tipo en
-- el momento en que el pedido se crea o edita (lo calculan
-- rpc_create_order/rpc_update_order internamente, sin que la app tenga
-- que mandar un parámetro extra). Si luego alguien renombra
-- "Luminaria" → "Iluminación Industrial" desde Configuración, los pedidos
-- ya creados siguen mostrando "Luminaria" (su snapshot), nunca cambian de
-- forma retroactiva/confusa — mismo principio de snapshot ya usado para
-- equipo/proyección (0006), instalación/superficie (0007) y catálogo de
-- productos (0009). Se hace backfill de este campo para los pedidos ya
-- existentes usando los nombres actuales conocidos, para que ningún
-- pedido histórico quede con el campo vacío.
--
-- DECISIÓN — activo/inactivo no se valida en los RPCs:
-- un tipo desactivado deja de listarse en Nuevo Pedido (filtro en la app),
-- pero un pedido que ya lo usaba — o que se edita sin cambiar su tipo —
-- debe poder seguir guardándose sin fricción. Por eso la FK solo exige que
-- el código EXISTA en product_types, sin importar si está activo.
--
-- category (product_catalog, 0009) y product_type (orders, aquí) siguen
-- siendo conceptos distintos y no se mezclan: un pedido "Luminaria" puede
-- tener productos de categoría "Luz LED Grúa Viajera" del catálogo.

create table if not exists product_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_types_active_idx on product_types (active);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_product_types_updated_at'
  ) then
    create trigger trg_product_types_updated_at
      before update on product_types
      for each row execute function set_updated_at();
  end if;
end $$;

alter table product_types enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'product_types'
      and policyname = 'product_types_all_authenticated'
  ) then
    create policy "product_types_all_authenticated" on product_types
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Seed: exactamente los 5 tipos que ya existían hardcodeados en la app
-- (PRODUCT_TYPE_LABELS). No se inventa ningún tipo nuevo.
insert into product_types (code, name, active)
values
  ('proyector_gobo', 'Proyector / GOBO', true),
  ('luminaria', 'Luminaria', true),
  ('equipo_seguridad', 'Equipo de seguridad', true),
  ('refaccion_accesorio', 'Refacción / Accesorio', true),
  ('otro', 'Otro', true)
on conflict (code) do nothing;

-- =========================================================================
-- orders: snapshot del nombre del tipo al momento de crear/editar el
-- pedido, + FK de integridad contra product_types.code (sin tocar el tipo
-- de columna de product_type ni su valor).
-- =========================================================================
alter table orders
  add column if not exists product_type_name_snapshot text;

-- Backfill idempotente (solo pedidos sin snapshot) usando los nombres
-- que ya se mostraban hardcodeados antes de esta migración — así ningún
-- pedido histórico queda con el campo vacío.
update orders set product_type_name_snapshot = case product_type
    when 'proyector_gobo' then 'Proyector / GOBO'
    when 'luminaria' then 'Luminaria'
    when 'equipo_seguridad' then 'Equipo de seguridad'
    when 'refaccion_accesorio' then 'Refacción / Accesorio'
    when 'otro' then 'Otro'
    else product_type
  end
where product_type_name_snapshot is null;

-- orders.product_type traía desde 0001_core.sql un CHECK inline que
-- restringía el valor a exactamente los 5 códigos originales
-- ('proyector_gobo', 'luminaria', 'equipo_seguridad', 'refaccion_accesorio',
-- 'otro'). Ese es precisamente el hardcodeo que esta migración elimina: si
-- se deja, ningún tipo nuevo dado de alta desde Configuración podría
-- guardarse jamás. Se reemplaza por la FK contra product_types.code de
-- abajo, que da la misma integridad (el valor debe existir) pero contra
-- una tabla administrable en vez de una lista fija en el esquema.
alter table orders drop constraint if exists orders_product_type_check;

-- FK agregada con NOT VALID (no bloquea ni escanea de inmediato) y
-- validada aparte — patrón seguro para agregar integridad referencial
-- sobre una tabla con datos ya existentes en producción. Los 5 códigos
-- sembrados arriba cubren todos los valores que la app pudo haber
-- guardado hasta ahora (solo aceptaba esos 5 vía z.enum), así que la
-- validación debe pasar sin tocar ningún dato.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_product_type_fkey'
  ) then
    alter table orders
      add constraint orders_product_type_fkey
      foreign key (product_type) references product_types (code)
      not valid;
  end if;
end $$;

alter table orders validate constraint orders_product_type_fkey;

-- =========================================================================
-- rpc_create_order / rpc_update_order: calculan product_type_name_snapshot
-- internamente (sin parámetro nuevo desde la app) buscando el nombre
-- actual del tipo elegido.
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
begin
  select name into v_product_type_name from product_types where code = p_order->>'product_type';

  insert into orders (
    id, salesperson_id, order_date, client_name, supplier_name, product_type, product_type_name_snapshot, status,
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
begin
  select name into v_product_type_name from product_types where code = p_order->>'product_type';

  update orders set
    client_name = p_order->>'client_name',
    supplier_name = p_order->>'supplier_name',
    product_type = p_order->>'product_type',
    product_type_name_snapshot = v_product_type_name,
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

-- rpc_duplicate_order: copia product_type_name_snapshot TAL CUAL estaba en
-- el pedido original (mismo principio que el resto de las columnas de esta
-- función: snapshot copiado, nunca vuelto a calcular contra product_types).
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
    salesperson_id, order_date, client_name, supplier_name, product_type, product_type_name_snapshot, status,
    general_notes, vendor_notes, vendor_notes_en,
    projector_model, projector_quantity, projector_power, projector_lens_type, projector_lens_pending_factory,
    projection_description, projection_description_en, projection_file_path, projection_file_name, projection_file_type,
    projection_width, projection_height, projection_size_unit,
    installation_height, installation_height_unit, installation_distance, installation_orientation, installation_use,
    surface_type, surface_material, surface_notes, surface_notes_en
  )
  values (
    v_source.salesperson_id, p_order_date, v_source.client_name, v_source.supplier_name,
    v_source.product_type, v_source.product_type_name_snapshot, 'borrador',
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
