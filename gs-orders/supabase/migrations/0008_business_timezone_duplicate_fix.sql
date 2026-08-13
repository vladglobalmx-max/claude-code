-- GS Orders — Migración 0008: fecha de negocio (America/Monterrey) al duplicar pedido
--
-- rpc_duplicate_order usaba `current_date` de Postgres para fechar el
-- pedido duplicado. `current_date` depende del timezone de la SESIÓN de
-- Postgres (Supabase corre en UTC por defecto) — el mismo problema de
-- fondo que afectaba la fecha por default en Nuevo Pedido (que usaba
-- `new Date().toISOString()` en el servidor, también UTC): entrada la
-- noche en Monterrey (UTC-6), UTC ya está en el día siguiente, así que un
-- pedido duplicado podía quedar fechado un día adelante — y por lo tanto
-- con el segmento de fecha del folio también adelantado.
--
-- La fecha de negocio ahora se calcula en una sola parte (la aplicación,
-- ver src/lib/business-date.ts) y se pasa explícita a este RPC. Cambia la
-- firma de la función (agrega p_order_date), así que se elimina primero la
-- versión anterior de un solo parámetro para no dejar dos sobrecargas
-- coexistiendo (una de ellas seguiría teniendo el bug si algo la invocara
-- sin el nuevo parámetro).
drop function if exists rpc_duplicate_order(uuid);

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
