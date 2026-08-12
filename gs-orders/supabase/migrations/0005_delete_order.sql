-- GS Orders — Migración 0005: eliminación completa de pedidos
--
-- order_items, order_images y order_files ya tienen "on delete cascade"
-- hacia orders (ver 0001_core.sql), así que borrar la fila de orders basta
-- para eliminar sus registros dependientes a nivel de base de datos.
--
-- Lo que el cascade NO resuelve son los archivos en Supabase Storage: un
-- pedido duplicado (rpc_duplicate_order, 0004) copia las referencias
-- (image_path / storage_path / projection_file_path) apuntando al MISMO
-- archivo físico que el pedido original, sin subir una copia nueva. Por eso
-- no basta con borrar por prefijo "{order_id}/" en el bucket: un archivo
-- puede seguir siendo usado por otro pedido (el duplicado, o del cual este
-- se duplicó).
--
-- rpc_delete_order primero recolecta las rutas de Storage del pedido,
-- borra el pedido (cascade incluido) y devuelve solo las rutas que, tras el
-- borrado, ya no están referenciadas por ningún otro pedido — esas son las
-- que la aplicación debe eliminar de Storage para no dejar huérfanos.
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
