-- =========================================================================
-- GS Orders — Migración 0047: cierra el gap de ownership en UPDATE/DELETE
-- de storage.objects para order-media / order-files.
-- =========================================================================
-- HALLAZGO (auditoría de seguridad de supabase/migrations): 0011 dejó
-- UPDATE/DELETE de storage.objects como "cualquier autenticado activo",
-- documentando que el motivo real era el INSERT (el UUID del pedido se
-- genera en el cliente ANTES de que exista la fila en `orders`, así que no
-- hay ownership que validar en ese instante). Esa razón es válida para
-- INSERT — que se deja igual, sin tocar — pero NO aplica a UPDATE/DELETE:
-- para poder actualizar o borrar un archivo, ese archivo ya fue insertado
-- antes, así que el pedido casi siempre ya existe y sí se puede validar
-- dueño, exactamente como ya hace el SELECT desde 0011.
--
-- Sin este fix, cualquier vendedor activo con sesión válida puede
-- sobreescribir o borrar un archivo de un pedido AJENO si conoce/adivina su
-- ruta (mitigado por ser un UUID no adivinable a ciegas, pero sigue siendo
-- una escalación de privilegios real vs. el modelo de "cada quien lo suyo").
--
-- Ownership usado = el mismo de la policy SELECT original de 0011
-- (admin O `orders.salesperson_id` = current_user_salesperson_id()),
-- NO el set ampliado de 0041 (`can_view_all_sales`): esa capability es
-- explícitamente de solo-lectura por diseño ("ninguna policy de
-- INSERT/UPDATE/DELETE se toca... no otorga ninguna capacidad de
-- escritura por construcción", ver 0041). Ampliar quién puede VER no debe
-- ampliar quién puede BORRAR.
--
-- Para rutas de product_catalog (imágenes de catálogo, `{catalogProductId}/
-- ...`), UPDATE/DELETE queda admin-only, igual que `product_catalog_admin_write`
-- a nivel tabla (0011) — no hay razón para que un vendedor pueda modificar/
-- borrar una imagen de producto que ni siquiera puede editar en la tabla.
-- =========================================================================
begin;

drop policy if exists "order_media_update_authenticated" on storage.objects;
create policy "order_media_update_scoped" on storage.objects
  for update using (
    bucket_id = 'order-media' and auth.role() = 'authenticated' and current_user_active() and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.salesperson_id = current_user_salesperson_id()
          and o.id::text = (storage.foldername(objects.name))[1]
      )
    )
  );

drop policy if exists "order_media_delete_authenticated" on storage.objects;
create policy "order_media_delete_scoped" on storage.objects
  for delete using (
    bucket_id = 'order-media' and auth.role() = 'authenticated' and current_user_active() and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.salesperson_id = current_user_salesperson_id()
          and o.id::text = (storage.foldername(objects.name))[1]
      )
    )
  );

drop policy if exists "order_files_update_authenticated" on storage.objects;
create policy "order_files_update_scoped" on storage.objects
  for update using (
    bucket_id = 'order-files' and auth.role() = 'authenticated' and current_user_active() and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.salesperson_id = current_user_salesperson_id()
          and o.id::text = (storage.foldername(objects.name))[1]
      )
    )
  );

drop policy if exists "order_files_delete_authenticated" on storage.objects;
create policy "order_files_delete_scoped" on storage.objects
  for delete using (
    bucket_id = 'order-files' and auth.role() = 'authenticated' and current_user_active() and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.salesperson_id = current_user_salesperson_id()
          and o.id::text = (storage.foldername(objects.name))[1]
      )
    )
  );

commit;
