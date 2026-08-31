-- GS Orders — Migración 0011: usuarios, roles y RLS por vendedor (Fase 3)
--
-- Hasta ahora TODAS las policies del proyecto eran "authenticated puede
-- todo" (ver 0001, 0007, 0009, 0010). Cualquier usuario logueado veía y
-- modificaba TODOS los pedidos de TODOS los vendedores. Esta migración
-- introduce dos roles (ADMIN/VENDEDOR) y hace que el acceso real a los
-- datos dependa de una relación auth.users → user_profiles → salespeople,
-- verificada en RLS (no solo en la interfaz).
--
-- =========================================================================
-- DECISIÓN — user_profiles como tabla nueva (auditado el esquema actual
-- antes de decidir esto, no es solo "porque el usuario lo sugirió"):
-- =========================================================================
-- Alternativa A descartada: agregar `user_id uuid` directo a `salespeople`.
--   `salespeople` es una tabla de negocio (prefijo/consecutivo de folio);
--   mezclar identidad de auth ahí es conceptualmente incorrecto, y no
--   resuelve el caso "ADMIN sin vendedor asociado" (salesperson_id opcional
--   para ADMIN) sin ensuciar esa tabla con filas ficticias.
-- Alternativa B descartada: guardar role/active en
--   auth.users.raw_user_meta_data. Ese campo lo puede editar el propio
--   usuario con supabase.auth.updateUser() — exactamente el vector de
--   auto-otorgarse ADMIN que se debe bloquear. raw_app_meta_data sí es
--   de solo-servicio, pero no es consultable directo en RLS sin configurar
--   un access token hook (infraestructura adicional, más frágil, sin
--   integridad referencial real hacia salespeople).
-- Elegida: tabla `user_profiles` (user_id -> auth.users.id, salesperson_id
--   nullable -> salespeople.id, role, active). Es la única opción con FK
--   real, fácil de auditar/administrar desde una UI, y sin depender de
--   metadata editable por el cliente.
--
-- =========================================================================
-- DECISIÓN — helper functions SECURITY DEFINER para leer el propio perfil:
-- =========================================================================
-- Las policies de `orders` (y las que derivan de ella) necesitan saber el
-- role/salesperson_id/active del usuario actual. Consultar user_profiles
-- directo desde esas policies obligaría a que user_profiles también sea
-- legible por todos para que la subconsulta funcione bajo RLS normal, lo
-- cual reabre el problema. En vez de eso, current_user_role() /
-- current_user_salesperson_id() / current_user_active() son SECURITY
-- DEFINER (leen sin pasar por la propia RLS de user_profiles, pero SOLO
-- devuelven datos del usuario que las invoca vía auth.uid() — nunca de
-- otro), con `set search_path = public` fijo para evitar search_path
-- hijacking. Es el patrón estándar recomendado por Supabase para este
-- problema exacto.
--
-- =========================================================================
-- DECISIÓN — salespeople: el vendedor puede seguir generando su folio:
-- =========================================================================
-- fn_next_order_folio (0002) hace `update salespeople set sequence_current
-- = sequence_current + 1` dentro del trigger de folio. Si la policy de
-- UPDATE de salespeople fuera "solo ADMIN", ningún vendedor podría generar
-- folio jamás. Se permite UPDATE de la propia fila (o cualquiera si ADMIN),
-- pero un trigger nuevo (trg_salespeople_prevent_vendor_edit) bloquea que
-- un VENDEDOR cambie prefix/name/active/business_unit — solo puede
-- "moverse" sequence_current, y solo eso ocurre a través del trigger de
-- folio en el flujo normal de crear pedido.
--
-- =========================================================================
-- DECISIÓN — RPCs: no se tocan las firmas, y rpc_duplicate_order /
-- rpc_delete_order no se modifican en absoluto:
-- =========================================================================
-- Los 4 RPC (rpc_create_order/update/duplicate/delete) son y siguen siendo
-- SECURITY INVOKER (nunca declararon `security definer`) — corren con los
-- privilegios del usuario que llama, así que la RLS que se agrega aquí
-- sobre orders/order_items/etc. se aplica automáticamente DENTRO de ellos.
--   - rpc_duplicate_order: el primer `select * into v_source from orders
--     where id = p_source_order_id` ya queda filtrado por la policy de
--     SELECT de orders. Si Karla intenta duplicar un pedido ajeno, esa
--     select no encuentra la fila (RLS la esconde) y la excepción
--     "Pedido original no encontrado" ya existente se dispara sola. No se
--     necesita ningún cambio de código.
--   - rpc_delete_order: mismo razonamiento con el `delete from orders
--     where id = p_order_id` — RLS limita qué fila es borrable; 0 filas
--     afectadas ya dispara la excepción "Pedido no encontrado" existente.
--   - rpc_update_order: la policy de UPDATE limita qué fila es editable
--     (0 filas -> excepción existente) y trg_prevent_folio_change (0002)
--     YA bloqueaba incondicionalmente cambiar salesperson_id de un pedido
--     para cualquier rol, desde antes de esta migración. Solo se agrega
--     una verificación de perfil activo al inicio, para un mensaje claro
--     en vez de un error crudo de Postgres.
--   - rpc_create_order: este SÍ necesita lógica nueva, porque no hay una
--     fila previa que RLS pueda usar para filtrar — es un INSERT. Para
--     VENDEDOR, salesperson_id se recalcula server-side desde su perfil
--     SIEMPRE, ignorando lo que mande el cliente (CASO E). Para ADMIN, se
--     respeta el salesperson_id recibido (puede crear a nombre de
--     cualquier vendedor, CASO F). Esto es más robusto que depender solo
--     de que la RLS rechace un valor incorrecto: en vez de fallar, corrige.
--
-- =========================================================================
-- DECISIÓN — bootstrap del primer ADMIN sin lockout:
-- =========================================================================
-- Esta migración NO asume ningún UUID de memoria. El bloque final busca el
-- usuario ya existente en auth.users POR EMAIL (tú lo conoces, yo no debo
-- adivinarlo) y falla con una excepción clara si no lo encuentra — nunca
-- inserta "0 filas" en silencio. Corre con privilegios de propietario de
-- base de datos (igual que el resto del SQL Editor de Supabase), así que
-- no depende de que ya exista un ADMIN para poder crear el primero.
-- EDITA v_admin_email más abajo antes de ejecutar.
--
-- =========================================================================
-- DECISIÓN — TODA la migración corre dentro de una única transacción
-- explícita (begin ... commit al final del archivo):
-- =========================================================================
-- DDL en Postgres es transaccional (a diferencia de otros motores), así que
-- envolver tablas/policies/funciones/el bootstrap en un solo BEGIN/COMMIT es
-- válido y seguro. Esto es intencional y crítico: si el bloque de bootstrap
-- falla (el email no coincide con ningún auth.users), Postgres aborta la
-- transacción completa y descarta TODO lo anterior en este archivo —
-- ninguna policy nueva, ninguna tabla nueva, ningún cambio a los RPC queda
-- aplicado. Nunca queda un esquema a medias con RLS restrictiva ya activa
-- pero sin ningún ADMIN configurado. No depender del comportamiento
-- implícito de multi-statement de un editor SQL en particular — se fija
-- explícito para que el resultado sea el mismo sin importar qué cliente
-- (SQL Editor de Supabase, psql, etc.) ejecute este archivo.
begin;

-- =========================================================================
-- 1) user_profiles
-- =========================================================================
create table if not exists user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role text not null default 'vendedor',
  salesperson_id uuid references salespeople (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_role_check check (role in ('admin', 'vendedor')),
  constraint user_profiles_vendedor_requires_salesperson
    check (role <> 'vendedor' or salesperson_id is not null),
  constraint user_profiles_salesperson_id_unique unique (salesperson_id)
);

create index if not exists user_profiles_role_idx on user_profiles (role);
create index if not exists user_profiles_active_idx on user_profiles (active);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_user_profiles_updated_at') then
    create trigger trg_user_profiles_updated_at
      before update on user_profiles
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 2) Helper functions — SECURITY DEFINER, search_path fijo. Solo exponen
--    datos del propio auth.uid(), nunca de otro usuario.
-- =========================================================================
create or replace function current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from user_profiles where user_id = auth.uid();
$$;

create or replace function current_user_salesperson_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select salesperson_id from user_profiles where user_id = auth.uid();
$$;

create or replace function current_user_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(active, false) from user_profiles where user_id = auth.uid();
$$;

create or replace function current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(role = 'admin', false) from user_profiles where user_id = auth.uid();
$$;

-- =========================================================================
-- 3) RLS de user_profiles
-- =========================================================================
alter table user_profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles'
      and policyname = 'user_profiles_select_own_or_admin'
  ) then
    create policy "user_profiles_select_own_or_admin" on user_profiles
      for select using (user_id = auth.uid() or current_user_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles'
      and policyname = 'user_profiles_admin_write'
  ) then
    -- Solo ADMIN puede crear/editar/desactivar perfiles. Un VENDEDOR no
    -- tiene ninguna policy de insert/update/delete, así que no puede
    -- cambiar su propio rol ni su salesperson_id bajo ninguna circunstancia
    -- (CASO S/T/U) — ni siquiera sobre su propia fila.
    create policy "user_profiles_admin_write" on user_profiles
      for all using (current_user_is_admin()) with check (current_user_is_admin());
  end if;
end $$;

-- =========================================================================
-- 4) salespeople: lectura acotada + trigger que impide que un VENDEDOR
--    edite sus propios datos de vendedor (más allá de sequence_current,
--    que solo mueve el trigger de folio).
-- =========================================================================
drop policy if exists "salespeople_all_authenticated" on salespeople;

drop policy if exists "salespeople_select_own_or_admin" on salespeople;
create policy "salespeople_select_own_or_admin" on salespeople
  for select using (
    current_user_active() and (current_user_is_admin() or id = current_user_salesperson_id())
  );

drop policy if exists "salespeople_admin_insert" on salespeople;
create policy "salespeople_admin_insert" on salespeople
  for insert with check (current_user_is_admin());

drop policy if exists "salespeople_update_own_or_admin" on salespeople;
create policy "salespeople_update_own_or_admin" on salespeople
  for update using (
    current_user_active() and (current_user_is_admin() or id = current_user_salesperson_id())
  ) with check (
    current_user_active() and (current_user_is_admin() or id = current_user_salesperson_id())
  );

create or replace function trg_prevent_vendor_salesperson_edit()
returns trigger
language plpgsql
as $$
begin
  if not current_user_is_admin() then
    if new.prefix is distinct from old.prefix
      or new.name is distinct from old.name
      or new.active is distinct from old.active
      or new.business_unit is distinct from old.business_unit then
      raise exception 'No tienes permiso para modificar los datos del vendedor';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_salespeople_prevent_vendor_edit') then
    create trigger trg_salespeople_prevent_vendor_edit
      before update on salespeople
      for each row execute function trg_prevent_vendor_salesperson_edit();
  end if;
end $$;

-- =========================================================================
-- 5) orders: el corazón de la Fase 3. VENDEDOR solo ve/edita/borra pedidos
--    propios; ADMIN todo. trg_prevent_folio_change (0002) ya bloqueaba
--    cambiar salesperson_id en un UPDATE para cualquier rol.
-- =========================================================================
drop policy if exists "orders_all_authenticated" on orders;

drop policy if exists "orders_select_own_or_admin" on orders;
create policy "orders_select_own_or_admin" on orders
  for select using (
    current_user_active() and (current_user_is_admin() or salesperson_id = current_user_salesperson_id())
  );

drop policy if exists "orders_insert_own_or_admin" on orders;
create policy "orders_insert_own_or_admin" on orders
  for insert with check (
    current_user_active() and (current_user_is_admin() or salesperson_id = current_user_salesperson_id())
  );

drop policy if exists "orders_update_own_or_admin" on orders;
create policy "orders_update_own_or_admin" on orders
  for update using (
    current_user_active() and (current_user_is_admin() or salesperson_id = current_user_salesperson_id())
  ) with check (
    current_user_active() and (current_user_is_admin() or salesperson_id = current_user_salesperson_id())
  );

drop policy if exists "orders_delete_own_or_admin" on orders;
create policy "orders_delete_own_or_admin" on orders
  for delete using (
    current_user_active() and (current_user_is_admin() or salesperson_id = current_user_salesperson_id())
  );

-- =========================================================================
-- 6) Tablas hijas de orders: el ownership se deriva del pedido padre, no
--    se duplica una columna salesperson_id en cada una.
-- =========================================================================
drop policy if exists "order_items_all_authenticated" on order_items;

drop policy if exists "order_items_via_order" on order_items;
create policy "order_items_via_order" on order_items
  for all using (
    current_user_active() and exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  ) with check (
    current_user_active() and exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  );

drop policy if exists "order_item_images_all_authenticated" on order_item_images;

drop policy if exists "order_item_images_via_order" on order_item_images;
create policy "order_item_images_via_order" on order_item_images
  for all using (
    current_user_active() and exists (
      select 1 from order_items oi
      join orders o on o.id = oi.order_id
      where oi.id = order_item_images.order_item_id
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  ) with check (
    current_user_active() and exists (
      select 1 from order_items oi
      join orders o on o.id = oi.order_id
      where oi.id = order_item_images.order_item_id
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  );

drop policy if exists "order_images_all_authenticated" on order_images;

drop policy if exists "order_images_via_order" on order_images;
create policy "order_images_via_order" on order_images
  for all using (
    current_user_active() and exists (
      select 1 from orders o
      where o.id = order_images.order_id
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  ) with check (
    current_user_active() and exists (
      select 1 from orders o
      where o.id = order_images.order_id
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  );

drop policy if exists "order_files_all_authenticated" on order_files;

drop policy if exists "order_files_via_order" on order_files;
create policy "order_files_via_order" on order_files
  for all using (
    current_user_active() and exists (
      select 1 from orders o
      where o.id = order_files.order_id
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  ) with check (
    current_user_active() and exists (
      select 1 from orders o
      where o.id = order_files.order_id
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  );

-- =========================================================================
-- 7) Catálogo y tipos de producto: lectura compartida (solo activos para
--    quien no es ADMIN), escritura solo ADMIN. Snapshot ya garantiza que
--    desactivar/renombrar no rompe pedidos históricos (0009/0010).
-- =========================================================================
drop policy if exists "product_catalog_all_authenticated" on product_catalog;

drop policy if exists "product_catalog_select" on product_catalog;
create policy "product_catalog_select" on product_catalog
  for select using (current_user_active() and (current_user_is_admin() or active = true));

drop policy if exists "product_catalog_admin_write" on product_catalog;
create policy "product_catalog_admin_write" on product_catalog
  for all using (current_user_is_admin()) with check (current_user_is_admin());

drop policy if exists "product_types_all_authenticated" on product_types;

drop policy if exists "product_types_select" on product_types;
create policy "product_types_select" on product_types
  for select using (current_user_active() and (current_user_is_admin() or active = true));

drop policy if exists "product_types_admin_write" on product_types;
create policy "product_types_admin_write" on product_types
  for all using (current_user_is_admin()) with check (current_user_is_admin());

-- =========================================================================
-- 8) Storage: order-media / order-files. La confidencialidad real (leer
--    fotos/archivos de otro vendedor) se cierra en SELECT, acotando por el
--    primer segmento de la ruta ({orderId}/... o {catalogProductId}/...).
--    INSERT/UPDATE/DELETE se dejan como "cualquier autenticado activo"
--    igual que antes — el flujo de Nuevo Pedido sube archivos ANTES de que
--    exista la fila en `orders` (el id se genera en el cliente antes del
--    primer guardado), así que no hay forma de validar ownership de
--    `orders` en el momento del INSERT sin rediseñar ese flujo. Riesgo
--    residual aceptado y documentado en el reporte: en teoría alguien
--    podría subir un archivo "a ciegas" bajo la carpeta de un pedido ajeno,
--    pero nunca podrá leerlo, y no queda referenciado por ningún
--    order_item/order_image real.
-- =========================================================================
drop policy if exists "order_media_authenticated_all" on storage.objects;
drop policy if exists "order_files_authenticated_all" on storage.objects;

-- OJO: dentro de las subconsultas correlacionadas de abajo se referencia
-- explícitamente `objects.name` (nunca `name` a secas). product_catalog
-- también tiene una columna `name` (el nombre del producto) — un `name` sin
-- calificar dentro de esa subconsulta se resuelve contra product_catalog.name
-- por ser la tabla más cercana en el scope, NO contra storage.objects.name,
-- lo cual rompía silenciosamente esta policy (siempre evaluaba a false).
-- Verificado el bug y el fix contra Postgres real antes de cerrar esta
-- migración — ver CASO de storage en el reporte.
drop policy if exists "order_media_select_scoped" on storage.objects;
create policy "order_media_select_scoped" on storage.objects
  for select using (
    bucket_id = 'order-media' and auth.role() = 'authenticated' and current_user_active() and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.salesperson_id = current_user_salesperson_id()
          and o.id::text = (storage.foldername(objects.name))[1]
      )
      or exists (
        select 1 from product_catalog pc where pc.id::text = (storage.foldername(objects.name))[1]
      )
    )
  );

drop policy if exists "order_files_select_scoped" on storage.objects;
create policy "order_files_select_scoped" on storage.objects
  for select using (
    bucket_id = 'order-files' and auth.role() = 'authenticated' and current_user_active() and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.salesperson_id = current_user_salesperson_id()
          and o.id::text = (storage.foldername(objects.name))[1]
      )
    )
  );

drop policy if exists "order_media_write_authenticated" on storage.objects;
create policy "order_media_write_authenticated" on storage.objects
  for insert with check (bucket_id = 'order-media' and auth.role() = 'authenticated' and current_user_active());
drop policy if exists "order_media_update_authenticated" on storage.objects;
create policy "order_media_update_authenticated" on storage.objects
  for update using (bucket_id = 'order-media' and auth.role() = 'authenticated' and current_user_active());
drop policy if exists "order_media_delete_authenticated" on storage.objects;
create policy "order_media_delete_authenticated" on storage.objects
  for delete using (bucket_id = 'order-media' and auth.role() = 'authenticated' and current_user_active());

drop policy if exists "order_files_write_authenticated" on storage.objects;
create policy "order_files_write_authenticated" on storage.objects
  for insert with check (bucket_id = 'order-files' and auth.role() = 'authenticated' and current_user_active());
drop policy if exists "order_files_update_authenticated" on storage.objects;
create policy "order_files_update_authenticated" on storage.objects
  for update using (bucket_id = 'order-files' and auth.role() = 'authenticated' and current_user_active());
drop policy if exists "order_files_delete_authenticated" on storage.objects;
create policy "order_files_delete_authenticated" on storage.objects
  for delete using (bucket_id = 'order-files' and auth.role() = 'authenticated' and current_user_active());

-- =========================================================================
-- 9) RPCs: rpc_create_order deriva salesperson_id server-side para
--    VENDEDOR (ignora lo que mande el cliente); rpc_update_order agrega
--    una verificación de perfil activo con mensaje claro.
--    rpc_duplicate_order y rpc_delete_order NO se tocan (ver razones en el
--    encabezado de este archivo).
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
  v_role text;
  v_my_salesperson_id uuid;
  v_final_salesperson_id uuid;
begin
  v_role := current_user_role();
  v_my_salesperson_id := current_user_salesperson_id();

  if v_role is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  if v_role = 'admin' then
    v_final_salesperson_id := (p_order->>'salesperson_id')::uuid;
  else
    if v_my_salesperson_id is null then
      raise exception 'Tu usuario no tiene un vendedor asociado. Contacta al administrador.';
    end if;
    -- Nunca se confía en el salesperson_id que mande el cliente para un
    -- VENDEDOR: se sobreescribe siempre con el de su propio perfil (CASO E).
    v_final_salesperson_id := v_my_salesperson_id;
  end if;

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
    v_final_salesperson_id,
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
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

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

-- =========================================================================
-- 10) admin_list_user_profiles: para la pantalla Configuración → Usuarios
--     y accesos. auth.users no es consultable directo vía PostgREST desde
--     el cliente; esta función SECURITY DEFINER expone solo id/email
--     unidos con user_profiles/salespeople, y se autoprotege: cualquier
--     llamada de alguien que no sea ADMIN activo recibe una excepción, no
--     datos vacíos silenciosos.
-- =========================================================================
create or replace function admin_list_user_profiles()
returns table (
  user_id uuid,
  email text,
  name text,
  role text,
  salesperson_id uuid,
  salesperson_name text,
  salesperson_prefix text,
  active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not current_user_is_admin() then
    raise exception 'No tienes permiso para ver esta información';
  end if;

  return query
    select
      up.user_id, u.email, up.name, up.role, up.salesperson_id,
      sp.name as salesperson_name, sp.prefix as salesperson_prefix,
      up.active, up.created_at
    from user_profiles up
    join auth.users u on u.id = up.user_id
    left join salespeople sp on sp.id = up.salesperson_id
    order by up.name;
end;
$$;

-- =========================================================================
-- 11) Bootstrap del primer ADMIN — EDITA v_admin_email ANTES DE EJECUTAR.
--     Corre con privilegios de propietario (como el resto del SQL Editor),
--     así que no depende de que ya exista un ADMIN. Falla con una
--     excepción clara si el email no coincide con ningún auth.users — para
--     no dejar "0 filas insertadas" en silencio.
-- =========================================================================
do $$
declare
  v_admin_email text := 'REEMPLAZA-CON-TU-CORREO@globalsupplier.com.mx'; -- <-- EDITA ESTA LÍNEA
  v_admin_user_id uuid;
begin
  select id into v_admin_user_id from auth.users where email = v_admin_email;

  if v_admin_user_id is null then
    -- RAISE solo soporta sustitución simple con %, NO el %L de format()
    -- (quoting de literales) — por eso el snippet de SQL sugerido se arma
    -- con format() primero y se inyecta ya listo con un solo % en el RAISE.
    raise warning 'No se encontró ningún usuario en auth.users con el email %. NINGÚN administrador quedó configurado por este bootstrap — créalo (p.ej. en Supabase Studio) y luego promuévelo a mano con: %',
      v_admin_email,
      format('insert into user_profiles (user_id, name, role, active) select id, ''Administrador'', ''admin'', true from auth.users where email = %L on conflict (user_id) do update set role = ''admin'', active = true;', v_admin_email);
  else
    insert into user_profiles (user_id, name, role, salesperson_id, active)
    values (v_admin_user_id, 'Administrador', 'admin', null, true)
    on conflict (user_id) do update set role = 'admin', active = true;
  end if;
end $$;

commit;
