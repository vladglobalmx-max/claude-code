-- =========================================================================
-- GS Orders — Migración 0048: un Pedido con Entregas o reservas de
-- inventario ya NO se puede borrar.
-- =========================================================================
-- HALLAZGO (auditoría de lógica de negocio): `deliveries.order_id` e
-- `inventory_reservations.order_id` quedaron en `on delete cascade` desde
-- que se crearon (0037, 0039) — a diferencia de `purchase_orders.order_id`
-- e `inventory_movements.order_id` (0035, 0038), que a propósito usan
-- `on delete restrict` para que borrar un Pedido nunca se lleve entre
-- patas su historial de compras/inventario. Para entregas/reservas nunca
-- se tomó esa misma decisión — no hay ningún bloque DECISIÓN que lo
-- justifique, simplemente se pasó por alto.
--
-- Sin este fix: se entrega un Pedido (fotos, firma de recepción del
-- cliente, historial completo en `deliveries`/`delivery_files`), y si
-- alguien borra ese Pedido después (`rpc_delete_order` no lo impedía),
-- TODA esa evidencia desaparece de la base de datos en cascada, sin aviso,
-- y los archivos en `storage.objects` quedan huérfanos. Es la única
-- operación destructiva del proyecto que se comportaba así — el resto
-- (Purchase Orders, movimientos de inventario) ya estaba protegido.
--
-- `inventory_reservations` nunca borra sus filas (se liberan con
-- `released_at`, quedan como historial — ver 0037), así que igual que con
-- `purchase_orders`, este `restrict` bloquea el DELETE del Pedido para
-- siempre en cuanto existió AL MENOS UNA reserva alguna vez, sin importar
-- si ya se liberó — es el mismo criterio que ya usa `inventory_movements`
-- (ledger insert-only, nunca se pierde el rastro de qué tocó stock real).
-- =========================================================================
begin;

alter table inventory_reservations
  drop constraint inventory_reservations_order_id_fkey,
  add constraint inventory_reservations_order_id_fkey
    foreign key (order_id) references orders (id) on delete restrict;

alter table deliveries
  drop constraint deliveries_order_id_fkey,
  add constraint deliveries_order_id_fkey
    foreign key (order_id) references orders (id) on delete restrict;

-- rpc_delete_order — agrega los mismos 2 pre-chequeos (mensaje claro en
-- español, antes de tocar Storage) que ya existía para source_quote_id;
-- sin esto, el usuario vería el error crudo de Postgres por el `restrict`
-- de arriba en vez de una explicación entendible.
create or replace function rpc_delete_order(p_order_id uuid)
returns table (orphaned_media_paths text[], orphaned_file_paths text[])
language plpgsql
as $$
declare
  v_source_quote_id uuid;
  v_has_deliveries boolean;
  v_has_reservations boolean;
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

  select exists (select 1 from deliveries where order_id = p_order_id) into v_has_deliveries;
  if v_has_deliveries then
    raise exception 'Este pedido tiene entregas registradas y no puede eliminarse.';
  end if;

  select exists (select 1 from inventory_reservations where order_id = p_order_id) into v_has_reservations;
  if v_has_reservations then
    raise exception 'Este pedido tiene inventario reservado (o reservado en el pasado) y no puede eliminarse.';
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
