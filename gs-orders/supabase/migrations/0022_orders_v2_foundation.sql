-- GS Orders — Migración 0022: THÖREN Orders V2 Foundation
--
-- Modernización ADITIVA de `orders` para integrarse con el Core (Customers,
-- Business Units, Organizations) sin reconstruir Orders ni romper su
-- comportamiento actual. Implementa exactamente el diseño ya aprobado en
-- "THÖREN — ORDERS V2 FOUNDATION — DISCOVERY + DISEÑO" de esta misma sesión.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Agrega a `orders`:
--    - organization_id uuid NOT NULL (tras backfill) references
--      organizations(id) on delete restrict.
--    - customer_id uuid NULLABLE references customers(id) on delete
--      restrict — sin matching histórico por client_name.
--    - business_unit_id uuid NULLABLE references business_units(id) on
--      delete restrict — sin backfill donde el legacy `business_unit` sea
--      ambiguo (ver punto 3).
-- 2) Backfill de organization_id: si existe al menos un pedido, exige
--    EXACTAMENTE una organización en toda la base — si hay 0 o más de 1,
--    ABORTA la migración completa (rollback) en vez de adivinar. Nunca
--    hardcodea un id/slug. Si `orders` está vacía, el backfill se salta.
-- 3) Backfill de business_unit_id: solo para los 3 valores legacy que
--    mapean 1:1 sin ambigüedad por código (`got_fresh_breath`,
--    `the_fire_spot`, `juno_promotional`). El valor legacy `'thunder'`
--    NUNCA se mapea automáticamente — corresponde a dos Business Units
--    reales distintas (Thunder Safety Solutions / Thunder LED Lights) y
--    adivinar cuál sería inventar un dato que no existe. Esos pedidos
--    quedan con business_unit_id = NULL.
-- 4) `orders.business_unit` (legacy, 4 valores fijos) y
--    `salespeople.business_unit` NO se tocan — siguen existiendo, siguen
--    escribiéndose exactamente igual que hoy (rpc_create_order nunca los
--    ha tocado, sigue sin tocarlos). Quedan documentados como deprecated
--    pero compatibles — ninguna constraint ni índice legacy se modifica.
-- 5) Trigger nuevo y AISLADO `trg_orders_prevent_organization_change`:
--    organization_id es inmutable una vez creado el pedido. Deliberadamente
--    NO se agrega esta regla a trg_prevent_folio_change (0002) — esa
--    función está fuera de alcance explícito de esta migración, se
--    prefiere un trigger nuevo de una sola responsabilidad antes que tocar
--    el existente.
-- 6) RLS de `orders`: se agrega `is_organization_member(organization_id)`
--    (helper de 0013, sin helper nuevo) como condición adicional en las 4
--    policies existentes, sin tocar el resto de cada condición —
--    `current_user_is_admin()`/`current_user_salesperson_id()` (0011)
--    siguen siendo exactamente la misma autoridad de rol/ownership. No se
--    amplía ningún permiso: solo se agrega el límite de organización.
--    Las tablas hijas (order_items/order_images/order_item_images/
--    order_files) NO se tocan — sus policies ya filtran vía
--    `exists (select 1 from orders o where ...)`, y esa subconsulta ya
--    queda sujeta a la RLS (ahora más estricta) de `orders` — el límite de
--    organización se hereda automáticamente sin duplicar lógica.
-- 7) `rpc_create_order`: organization_id se resuelve EXCLUSIVAMENTE
--    server-side vía current_user_organization_id() (0013) — nunca se lee
--    de `p_order`, así que no existe ningún campo que un cliente pueda
--    enviar para falsificarlo. `p_order` puede incluir `customer_id`/
--    `business_unit_id` (jsonb, mismo patrón que el resto de sus campos —
--    CERO cambios de firma de la función). Si `customer_id` viene
--    informado: se valida que pertenece a la organización resuelta y se
--    resuelve `client_name` desde `customers.name` server-side —
--    cualquier `client_name` que mande el cliente se ignora en ese caso.
--    Si `customer_id` es null: `client_name` sigue el flujo legacy (texto
--    libre tal cual llega). Si `business_unit_id` viene informado, se
--    valida contra la misma organización. Call-sites actuales (que nunca
--    mandan esas claves) funcionan idéntico: JSONB devuelve NULL para una
--    clave ausente. Además valida que `salesperson_id` (resuelto arriba)
--    pertenezca a la misma organización, usando la única relación
--    inequívoca que existe hoy: salespeople.person_id → people.
--    organization_id (columna única NOT NULL en people). Cuando el
--    salesperson no tiene person_id (nullable — posible "Caso C" de
--    0016, nunca resuelto por ningún backfill), no se puede verificar sin
--    inventar un mapeo, así que NO se bloquea — se documenta como límite
--    conocido en el reporte de cierre en vez de arriesgar romper Orders
--    en producción para ese caso borde.
-- 8) `rpc_update_order`: organization_id NUNCA se escribe (ni siquiera se
--    lee de `p_order`) — inmutable por diseño de la función, reforzado
--    además por el trigger del punto 5. `customer_id`/`business_unit_id`
--    sí se actualizan, con la misma validación cross-org y la misma
--    resolución server-side de `client_name` que rpc_create_order — pero
--    respetando semántica JSONB de "clave ausente ≠ null": si `p_order`
--    no incluye la clave, se preserva el valor actual de la fila (nunca
--    se interpreta como limpiar); si la clave está presente (con valor o
--    con null explícito), se usa tal cual. `salesperson_id` no se
--    revalida aquí: es inmutable en UPDATE desde 0002
--    (trg_prevent_folio_change), no hay ningún valor nuevo que validar.
-- 9) `rpc_duplicate_order`: copia organization_id/customer_id/
--    business_unit_id tal cual del pedido origen — mismo patrón que ya
--    usa para copiar el resto de los campos. Cero cambios al manejo de
--    folio/fecha/consecutivo.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO toca fn_next_order_folio, trg_orders_set_folio,
--   trg_orders_prevent_folio_change, salespeople.prefix,
--   salespeople.sequence_current — el motor de folios de Orders queda
--   exactamente igual, genera los mismos folios para el mismo vendedor.
-- - NO toca product_types, product_type_name_snapshot, ni la lógica de
--   Proyector/GOBO (getMissingProjectorFields en la app) — cero cambios
--   funcionales, cero campos nuevos en esa validación.
-- - NO modifica el PDF de Orders — sigue leyendo exactamente las mismas
--   columnas que ya usaba.
-- - NO agrega selectores de Customer/Business Unit al formulario de
--   Nuevo/Editar Pedido — eso es una fase de UI posterior, fuera de esta
--   Foundation.
-- - NO construye Quote → Order, Inventory ni Purchasing.
-- - NO borra ni renombra ninguna columna legacy.
--
-- Como el resto del proyecto: idempotente (add column if not exists, do
-- $$ if not exists $$ para triggers/policies, create or replace para
-- funciones) y corre completa en una sola transacción (begin/commit) —
-- si el backfill de organization_id no puede resolverse sin ambigüedad,
-- toda la migración revierte.

begin;

-- =========================================================================
-- 1) Columnas nuevas — todas nullable al inicio.
-- =========================================================================
alter table orders
  add column if not exists organization_id uuid references organizations (id) on delete restrict,
  add column if not exists customer_id uuid references customers (id) on delete restrict,
  add column if not exists business_unit_id uuid references business_units (id) on delete restrict;

-- =========================================================================
-- 2) Backfill de organization_id — aborta si es ambiguo, nunca adivina.
-- =========================================================================
do $$
declare
  v_order_count integer;
  v_org_count integer;
  v_org_id uuid;
begin
  select count(*) into v_order_count from orders;

  if v_order_count > 0 then
    select count(*) into v_org_count from organizations;

    if v_org_count <> 1 then
      raise exception 'Migración 0022 abortada: existen % pedido(s) pero % organización(es) — se requiere EXACTAMENTE una organización para backfillear orders.organization_id sin adivinar.',
        v_order_count, v_org_count;
    end if;

    select id into v_org_id from organizations;
    update orders set organization_id = v_org_id where organization_id is null;
  end if;
end $$;

do $$
begin
  if exists (select 1 from orders where organization_id is null) then
    raise exception 'Migración 0022 abortada: quedaron pedidos sin organization_id tras el backfill.';
  end if;
end $$;

alter table orders alter column organization_id set not null;

-- =========================================================================
-- 3) Backfill de business_unit_id — solo mapeos 1:1 inequívocos por
--    código. 'thunder' (legacy) queda NULL a propósito (ver ALCANCE).
-- =========================================================================
update orders o
set business_unit_id = bu.id
from business_units bu
where bu.organization_id = o.organization_id
  and bu.code = o.business_unit
  and o.business_unit in ('got_fresh_breath', 'the_fire_spot', 'juno_promotional')
  and o.business_unit_id is null;

-- =========================================================================
-- 4) Índices
-- =========================================================================
create index if not exists orders_organization_idx on orders (organization_id);
create index if not exists orders_customer_idx on orders (customer_id);
create index if not exists orders_business_unit_idx on orders (business_unit_id);

-- =========================================================================
-- 5) organization_id inmutable — trigger nuevo y aislado, NO se toca
--    trg_prevent_folio_change (0002), fuera de alcance explícito.
-- =========================================================================
create or replace function trg_prevent_order_organization_change()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'La organización de un pedido no se puede modificar';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_orders_prevent_organization_change') then
    create trigger trg_orders_prevent_organization_change
      before update on orders
      for each row execute function trg_prevent_order_organization_change();
  end if;
end $$;

-- =========================================================================
-- 6) RLS — agrega el límite de organización sin tocar ownership por
--    vendedor ni ampliar ningún permiso. Tablas hijas de orders no se
--    tocan (heredan el límite vía su propio "exists (select ... orders)").
-- =========================================================================
drop policy if exists "orders_select_own_or_admin" on orders;
create policy "orders_select_own_or_admin" on orders
  for select using (
    is_organization_member(organization_id)
    and current_user_active()
    and (current_user_is_admin() or salesperson_id = current_user_salesperson_id())
  );

drop policy if exists "orders_insert_own_or_admin" on orders;
create policy "orders_insert_own_or_admin" on orders
  for insert with check (
    is_organization_member(organization_id)
    and current_user_active()
    and (current_user_is_admin() or salesperson_id = current_user_salesperson_id())
  );

drop policy if exists "orders_update_own_or_admin" on orders;
create policy "orders_update_own_or_admin" on orders
  for update using (
    is_organization_member(organization_id)
    and current_user_active()
    and (current_user_is_admin() or salesperson_id = current_user_salesperson_id())
  ) with check (
    is_organization_member(organization_id)
    and current_user_active()
    and (current_user_is_admin() or salesperson_id = current_user_salesperson_id())
  );

drop policy if exists "orders_delete_own_or_admin" on orders;
create policy "orders_delete_own_or_admin" on orders
  for delete using (
    is_organization_member(organization_id)
    and current_user_active()
    and (current_user_is_admin() or salesperson_id = current_user_salesperson_id())
  );

-- =========================================================================
-- 6b) fn_salesperson_organization_id — helper SECURITY DEFINER, mínimo y
--     de solo lectura. Necesario porque la RLS de `people`
--     (people_select_admin, 0015) restringe la lectura de un Person a
--     administradores DE ESA MISMA organización — así que un ADMIN de
--     Organization A, bajo su propia sesión (SECURITY INVOKER), no puede
--     ver el Person de un salesperson que pertenece a Organization B, y
--     la verificación de cross-org del punto 7 quedaría ciega (0 filas =
--     "no verificable" en vez de "pertenece a otra organización"). Este
--     helper expone EXCLUSIVAMENTE ese único hecho (a qué organización
--     pertenece un salesperson, vía person_id → people.organization_id)
--     — mismo patrón ya usado en este proyecto para admin_list_user_profiles
--     (0011): una función SECURITY DEFINER de alcance mínimo, sin efectos
--     secundarios, que no expone ninguna otra columna ni permite ninguna
--     otra operación.
-- =========================================================================
create or replace function fn_salesperson_organization_id(p_salesperson_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.organization_id
  from salespeople sp
  join people p on p.id = sp.person_id
  where sp.id = p_salesperson_id;
$$;

-- =========================================================================
-- 7) rpc_create_order — organization_id server-side exclusivo;
--    customer_id/business_unit_id opcionales leídos de p_order (jsonb),
--    SIN cambiar la firma de la función — call-sites actuales, idénticos.
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
  v_organization_id uuid;
  v_salesperson_org_id uuid;
  v_customer_id uuid;
  v_business_unit_id uuid;
  v_client_name text;
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

  -- organization_id SIEMPRE server-side — no existe ningún campo en
  -- p_order que un cliente pueda enviar para falsificarlo.
  v_organization_id := current_user_organization_id();

  -- Salesperson cross-org (corrección post-revisión): la única relación
  -- inequívoca hoy entre salespeople y organización es
  -- salespeople.person_id → people.organization_id (columna única, NOT
  -- NULL en people — ver 0015/0016). Cuando existe, se exige que coincida
  -- con la organización resuelta del pedido. Cuando el salesperson NO
  -- tiene person_id (posible, es nullable — "Caso C" de 0016, ambiguo,
  -- nunca resuelto por ningún backfill), no hay forma de verificarlo sin
  -- inventar un mapeo — se documenta como límite conocido en vez de
  -- bloquear o adivinar (ver reporte de cierre de esta corrección).
  v_salesperson_org_id := fn_salesperson_organization_id(v_final_salesperson_id);

  if v_salesperson_org_id is not null and v_salesperson_org_id <> v_organization_id then
    raise exception 'El vendedor seleccionado no pertenece a tu organización.';
  end if;

  v_customer_id := nullif(p_order->>'customer_id', '')::uuid;
  v_business_unit_id := nullif(p_order->>'business_unit_id', '')::uuid;

  if v_customer_id is not null then
    select name into v_client_name
      from customers
      where id = v_customer_id and organization_id = v_organization_id;
    if v_client_name is null then
      raise exception 'El cliente seleccionado no existe o no pertenece a tu organización.';
    end if;
  else
    v_client_name := p_order->>'client_name';
  end if;

  if v_business_unit_id is not null
     and not exists (
       select 1 from business_units where id = v_business_unit_id and organization_id = v_organization_id
     ) then
    raise exception 'La unidad de negocio seleccionada no existe o no pertenece a tu organización.';
  end if;

  select name into v_product_type_name from product_types where code = p_order->>'product_type';

  insert into orders (
    id, organization_id, customer_id, business_unit_id,
    salesperson_id, order_date, client_name, supplier_name, product_type, product_type_name_snapshot, status,
    general_notes, vendor_notes, vendor_notes_en,
    projector_model, projector_quantity, projector_power, projector_lens_type, projector_lens_pending_factory,
    projection_description, projection_description_en, projection_file_path, projection_file_name, projection_file_type,
    projection_width, projection_height, projection_size_unit,
    installation_height, installation_height_unit, installation_distance, installation_orientation, installation_use,
    surface_type, surface_material, surface_notes, surface_notes_en
  )
  values (
    p_order_id, v_organization_id, v_customer_id, v_business_unit_id,
    v_final_salesperson_id,
    (p_order->>'order_date')::date,
    v_client_name,
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

-- =========================================================================
-- 8) rpc_update_order — organization_id nunca se lee ni se escribe
--    (inmutable). customer_id/business_unit_id sí se actualizan, con la
--    misma validación cross-org y resolución server-side de client_name.
--    salesperson_id NO se valida aquí (a diferencia de rpc_create_order):
--    es inmutable en UPDATE desde 0002 (trg_prevent_folio_change ya
--    rechaza cualquier intento de cambiarlo), así que no hay ningún
--    salesperson_id nuevo que pudiera introducir un cruce de organización
--    durante una edición — validarlo de nuevo sería lógica duplicada sin
--    caso real que cubra.
--    Semántica JSONB "ausente ≠ null" (corrección post-revisión): si
--    p_order NO contiene la clave customer_id/business_unit_id, se
--    preserva el valor actual de la fila — nunca se interpreta como
--    "limpiar". Si la clave SÍ está presente (con valor o con null
--    explícito), se usa ese valor tal cual, incluido limpiar
--    deliberadamente con null. Esto es exactamente compatible con
--    call-sites legacy (que nunca incluyen esas claves): sus updates ya
--    no arriesgan borrar un customer_id/business_unit_id que hoy no
--    conocen.
-- =========================================================================
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
  v_organization_id uuid;
  v_customer_id uuid;
  v_business_unit_id uuid;
  v_client_name text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  v_organization_id := current_user_organization_id();

  -- Ausente ≠ null (ver DECISIÓN arriba): solo se toca el valor si la
  -- clave viene presente en p_order; si no, se conserva el actual.
  if p_order ? 'customer_id' then
    v_customer_id := nullif(p_order->>'customer_id', '')::uuid;
  else
    select customer_id into v_customer_id from orders where id = p_order_id;
  end if;

  if p_order ? 'business_unit_id' then
    v_business_unit_id := nullif(p_order->>'business_unit_id', '')::uuid;
  else
    select business_unit_id into v_business_unit_id from orders where id = p_order_id;
  end if;

  if v_customer_id is not null then
    select name into v_client_name
      from customers
      where id = v_customer_id and organization_id = v_organization_id;
    if v_client_name is null then
      raise exception 'El cliente seleccionado no existe o no pertenece a tu organización.';
    end if;
  else
    -- Sin customer_id: client_name sigue el flujo legacy (texto libre tal
    -- cual lo manda la app), exactamente igual que antes de esta migración.
    v_client_name := p_order->>'client_name';
  end if;

  if v_business_unit_id is not null
     and not exists (
       select 1 from business_units where id = v_business_unit_id and organization_id = v_organization_id
     ) then
    raise exception 'La unidad de negocio seleccionada no existe o no pertenece a tu organización.';
  end if;

  select name into v_product_type_name from product_types where code = p_order->>'product_type';

  update orders set
    customer_id = v_customer_id,
    business_unit_id = v_business_unit_id,
    client_name = v_client_name,
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
-- 9) rpc_duplicate_order — copia organization_id/customer_id/
--    business_unit_id tal cual del origen. Folio/fecha/consecutivo sin
--    cambios.
-- =========================================================================
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
    organization_id, customer_id, business_unit_id,
    salesperson_id, order_date, client_name, supplier_name, product_type, product_type_name_snapshot, status,
    general_notes, vendor_notes, vendor_notes_en,
    projector_model, projector_quantity, projector_power, projector_lens_type, projector_lens_pending_factory,
    projection_description, projection_description_en, projection_file_path, projection_file_name, projection_file_type,
    projection_width, projection_height, projection_size_unit,
    installation_height, installation_height_unit, installation_distance, installation_orientation, installation_use,
    surface_type, surface_material, surface_notes, surface_notes_en
  )
  values (
    v_source.organization_id, v_source.customer_id, v_source.business_unit_id,
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

commit;
