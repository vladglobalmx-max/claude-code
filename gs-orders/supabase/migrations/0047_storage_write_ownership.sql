-- =========================================================================
-- GS Orders — Migración 0047: cierra el gap de ownership en INSERT/UPDATE/
-- DELETE de storage.objects para order-media / order-files.
-- =========================================================================
-- HALLAZGO (auditoría de seguridad de supabase/migrations): 0011 dejó
-- UPDATE/DELETE de storage.objects como "cualquier autenticado activo",
-- documentando que el motivo real era el INSERT (el UUID del pedido se
-- genera en el cliente ANTES de que exista la fila en `orders`, así que no
-- hay ownership que validar en ese instante). Esa razón es válida para el
-- INSERT de rutas de PEDIDO — que se deja igual, sin tocar — pero NO
-- aplica a UPDATE/DELETE: para poder actualizar o borrar un archivo, ese
-- archivo ya fue insertado antes, así que el pedido casi siempre ya existe
-- y sí se puede validar dueño, exactamente como ya hace el SELECT desde
-- 0011.
--
-- Sin este fix, cualquier vendedor activo con sesión válida puede
-- sobreescribir o borrar un archivo de un pedido AJENO si conoce/adivina su
-- ruta (mitigado por ser un UUID no adivinable a ciegas, pero sigue siendo
-- una escalación de privilegios real vs. el modelo de "cada quien lo suyo").
--
-- =========================================================================
-- REVISIÓN (code review, misma sesión) — 2 bugs en la primera versión de
-- esta migración, corregidos aquí:
-- =========================================================================
-- 1) Rompía la capability can_manage_deliveries (0044): un usuario de
--    logística cross-sales puede borrar el row de delivery_files de un
--    pedido ajeno (0044 sí le agregó esa rama), pero la primera versión de
--    esta migración NO le agregó la misma rama a storage.objects — el
--    borrado del ARCHIVO real fallaba en silencio (deleteOrderMedia/
--    deleteOrderFile en pedidos/storage-actions.ts solo hacen
--    console.error, nunca propagan el error), dejando el archivo huérfano
--    mientras la UI reportaba éxito. Se agrega la misma rama
--    `current_user_has_capability('can_manage_deliveries')` que ya usan
--    delivery_files_insert/delete_own_or_admin_or_logistics (0044) — sin
--    acotar a un pedido/entrega específico, igual que 0044 (es una
--    capability de alcance amplio por diseño, no por-pedido).
-- 2) El INSERT de catálogo se quedó abierto: solo UPDATE/DELETE quedaban
--    admin-only para rutas de product_catalog, así que un vendedor podía
--    seguir SUBIENDO imágenes nuevas a un producto que ni siquiera puede
--    editar en la tabla (product_catalog_admin_write, 0011, es admin-only).
--    A diferencia de un pedido, un product_catalog.id YA existe cuando se
--    sube su imagen (el producto se crea primero, la imagen se sube
--    después desde la pantalla de editar) — sí hay ownership que validar
--    en el INSERT para esta ruta específica, sin el problema de
--    "el pedido no existe todavía" que sí aplica a rutas de pedido.
--
-- También se junta la regla de ownership (antes duplicada 4 veces) en un
-- solo helper — la duplicación fue justo lo que dejó pasar el bug #1
-- arriba: agregar una rama nueva significaba tocar 4 policies a mano.
-- =========================================================================
-- Para rutas de product_catalog (imágenes de catálogo, `{catalogProductId}/
-- ...`), UPDATE/DELETE/INSERT quedan admin-only, igual que
-- `product_catalog_admin_write` a nivel tabla (0011).
-- =========================================================================
begin;

create or replace function current_user_can_manage_order_storage(p_order_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    current_user_is_admin()
    or exists (
      select 1 from orders o
      where o.salesperson_id = current_user_salesperson_id()
        and o.id::text = p_order_id
    )
    or current_user_has_capability('can_manage_deliveries');
$$;

drop policy if exists "order_media_update_authenticated" on storage.objects;
create policy "order_media_update_scoped" on storage.objects
  for update using (
    bucket_id = 'order-media' and auth.role() = 'authenticated' and current_user_active()
      and current_user_can_manage_order_storage((storage.foldername(objects.name))[1])
  );

drop policy if exists "order_media_delete_authenticated" on storage.objects;
create policy "order_media_delete_scoped" on storage.objects
  for delete using (
    bucket_id = 'order-media' and auth.role() = 'authenticated' and current_user_active()
      and current_user_can_manage_order_storage((storage.foldername(objects.name))[1])
  );

drop policy if exists "order_files_update_authenticated" on storage.objects;
create policy "order_files_update_scoped" on storage.objects
  for update using (
    bucket_id = 'order-files' and auth.role() = 'authenticated' and current_user_active()
      and current_user_can_manage_order_storage((storage.foldername(objects.name))[1])
  );

drop policy if exists "order_files_delete_authenticated" on storage.objects;
create policy "order_files_delete_scoped" on storage.objects
  for delete using (
    bucket_id = 'order-files' and auth.role() = 'authenticated' and current_user_active()
      and current_user_can_manage_order_storage((storage.foldername(objects.name))[1])
  );

-- INSERT de order-media: sigue abierto a cualquier autenticado activo para
-- rutas de PEDIDO (sin cambio — ver DECISIÓN de arriba), pero ahora exige
-- admin si el primer segmento de la ruta es un product_catalog.id real.
-- order-files no tiene rutas de catálogo (nunca las tuvo, ver
-- order_files_select_scoped en 0011, sin rama de product_catalog) — su
-- INSERT no se toca.
drop policy if exists "order_media_write_authenticated" on storage.objects;
create policy "order_media_write_scoped" on storage.objects
  for insert with check (
    bucket_id = 'order-media' and auth.role() = 'authenticated' and current_user_active() and (
      current_user_is_admin()
      or not exists (
        select 1 from product_catalog pc where pc.id::text = (storage.foldername(objects.name))[1]
      )
    )
  );

commit;
