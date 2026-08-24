-- GS Orders — Migración 0032: THÖREN Orders Catalog Hardening (Fase 6E)
--
-- Cierra en Orders el mismo hueco de integridad ya cerrado en Quotes por
-- 0031_quote_catalog_operational_fields.sql: order_items.catalog_product_id
-- existe desde 0009/0019 y rpc_create_order/rpc_update_order lo persisten
-- tal cual desde entonces, pero NUNCA validaron que perteneciera a la
-- organización del Order, estuviera activo, ni fuera elegible para la
-- Business Unit del Order — exactamente el mismo patrón de vacío que tenía
-- Quotes antes de 0031, nunca cerrado para Orders en ninguna fase anterior.
--
-- =========================================================================
-- CAUSA EXACTA DEL GAP (discovery, Fase 6E §1)
-- =========================================================================
-- - order_items.catalog_product_id se agregó en 0009_product_catalog.sql
--   como columna de trazabilidad opcional, ANTES de que existiera
--   product_business_units (0019) o multi-organización real con RLS
--   estricta (0013+). Cuando esos conceptos llegaron después, ninguna
--   migración volvió a tocar rpc_create_order/rpc_update_order para
--   agregarles la validación equivalente — a diferencia de Quotes, que sí
--   la recibió recién en 0031 (Fase 6D/6D-cierre) porque el Quote Builder
--   fue el foco de esas fases; Orders quedó fuera explícitamente de cada
--   una de ellas hasta ahora.
-- - product_catalog_admin_write/product_catalog_select (0019/0030) son la
--   única autoridad sobre QUIÉN puede escribir en product_catalog, pero
--   nunca restringieron qué catalog_product_id puede referenciar un
--   order_item — son tablas distintas, sin FK cruzada con chequeo de
--   organización/Business Unit (la FK `order_items_catalog_product_id_fkey`
--   solo garantiza que el id EXISTE en product_catalog, nunca que
--   pertenece a la organización/Business Unit correctas).
-- - El Order Form (order-form.tsx/catalog-product-picker.tsx) filtra el
--   catálogo ofrecido solo por `active = true`, sin filtrar por Business
--   Unit — a diferencia del Quote Builder (Fase 6D), que sí filtra por BU
--   en el picker. Confirma que la app nunca implementó ese filtro para
--   Orders; no se toca en esta fase (alcance explícito: solo DB/RPC).
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) fn_check_order_item_catalog_product(): función auxiliar nueva,
--    SECURITY INVOKER, mismo patrón que fn_check_quote_item_catalog_product
--    (0031) pero con un parámetro adicional `p_require_active` — ver
--    DECISIÓN "producto inactivo" abajo, es la diferencia real de fondo
--    con Quotes. Para cada catalog_product_id no nulo, valida:
--      a) que exista y sea visible bajo RLS (product_catalog_select).
--      b) organization_id del producto === organization_id del Order.
--      c) active = true — SOLO si p_require_active.
--      d) elegible para la Business Unit del Order: 0 filas en
--         product_business_units = TODAS, 1+ filas = únicamente esas
--         (misma semántica exacta de 0019/0030/0031) — SOLO si el Order
--         tiene business_unit_id (ver DECISIÓN "Business Unit nula"
--         abajo).
-- 2) rpc_create_order: llama la validación por cada item con
--    catalog_product_id no nulo. `p_require_active` es FALSE únicamente
--    cuando `v_source_quote_id is not null` (conversión Quote → Order) —
--    ver DECISIÓN "Quote → Order" abajo; TRUE en cualquier otro caso
--    (creación manual, incluida la usada internamente por
--    rpc_create_order_from_quote solo para ESA distinción).
-- 3) rpc_update_order: llama la validación por cada item con
--    catalog_product_id no nulo. `p_require_active` es FALSE únicamente
--    para catalog_product_id que YA estaban asociados a este Order antes
--    de este UPDATE (capturados en un array ANTES del `delete from
--    order_items`) — ver DECISIÓN "resave" abajo; TRUE para cualquier
--    catalog_product_id nuevo en este Order.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO toca rpc_duplicate_order — copia organization_id/business_unit_id/
--   catalog_product_id VERBATIM de un Order ya existente y válido (nunca
--   permite que el usuario elija un valor nuevo para ninguno de los tres),
--   así que no puede introducir un cross-org/cross-BU nuevo por
--   construcción — ver DECISIÓN "duplicación" abajo.
-- - NO toca rpc_create_order_from_quote — sigue leyendo la Quote bajo RLS
--   y armando el mismo payload que ya arma hoy; el cambio de
--   comportamiento (permitir producto inactivo) vive enteramente dentro de
--   rpc_create_order, activado por `source_quote_id is not null`.
-- - NO toca el Order Form / catalog-product-picker.tsx — el pedido de esta
--   fase es enforcement DB/RPC explícitamente ("no confiar en validación
--   de frontend"); el picker de Orders no filtra por Business Unit hoy
--   (ver CAUSA arriba) y ese rediseño de UI queda fuera de alcance,
--   reportado como riesgo pendiente.
-- - NO agrega PDF de Pedido, dinero, nuevos estados, ni cancelación.
-- - NO relaja RLS de orders/order_items/product_catalog.
-- - NO modifica 0031 ni ninguna migración anterior.
--
-- =========================================================================
-- DECISIÓN — producto inactivo, Order manual vs Quote → Order:
-- =========================================================================
-- Un Order manual (source_quote_id IS NULL) es una selección FRESCA del
-- catálogo vigente — mismo criterio que Quotes (0031): un catalog_product_id
-- inactivo se rechaza, igual que organización/Business Unit.
--
-- Un Order originado de una Quote (source_quote_id IS NOT NULL) es
-- distinto: la Quote ya fue validada contra el catálogo vigente AL
-- GUARDARSE (0031 exige activo/organización/Business Unit correctos en
-- rpc_create_quote/rpc_update_quote) y es, desde entonces, un snapshot
-- comercial ya emitido al cliente (mismo principio que domain.ts documenta
-- para quote_items: "nunca se vuelve a consultar el catálogo para
-- reconstruir lo que se muestra"). Si el producto maestro se desactiva
-- DESPUÉS de que la Quote fue aceptada, bloquear la conversión sería negar
-- la creación de un Order que la organización ya se comprometió con el
-- cliente a cumplir, por un evento (desactivar el producto en el catálogo)
-- que no tiene relación con esa Quote específica. Por eso
-- `p_require_active` es false para este camino — organización y Business
-- Unit SÍ se siguen validando siempre (ver punto 1.b/1.d arriba): un
-- catalog_product_id de otra organización o incoherente con la Business
-- Unit histórica de la Quote/Order sigue rechazándose sin excepción,
-- incluso viniendo de una Quote.
--
-- =========================================================================
-- DECISIÓN — resave de un Order manual (rpc_update_order):
-- =========================================================================
-- rpc_update_order reemplaza TODAS las líneas en cada guardado (`delete
-- from order_items` + reinsert completo desde p_items, mismo patrón que
-- rpc_update_quote) — no existe un id de línea persistente en el payload
-- que permita distinguir "línea que ya existía" de "línea nueva" a nivel
-- de fila individual. La señal disponible SIN cambiar el contrato de la
-- app (evaluado y descartado: agregar un `item_id` opcional al payload
-- del Order Form habría sido la alternativa "más precisa" pero es un
-- cambio de UI fuera del alcance pedido para esta fase, que es
-- explícitamente DB/RPC) es el CONJUNTO de catalog_product_id que el Order
-- ya tenía asociados antes de este UPDATE. Se captura ese conjunto ANTES
-- del delete; cualquier catalog_product_id en ese conjunto se exime del
-- chequeo de `active` (permite un resave simple aunque el catálogo haya
-- cambiado mientras tanto), cualquier catalog_product_id que NO estaba en
-- ese conjunto (agregado en este mismo guardado) exige `active = true`.
-- Efecto secundario aceptado y documentado: si un producto ya asociado al
-- Order se desactiva y el usuario quita esa línea y luego, EN EL MISMO
-- guardado, vuelve a agregar una línea con el mismo catalog_product_id,
-- sigue contando como "ya existía" (el chequeo es por producto, no por
-- posición de línea) — comportamiento razonable, no es "agregar de nuevo
-- un producto inactivo" en el sentido que le preocupa al negocio (evitar
-- que alguien seleccione desde cero, hoy, un producto que el catálogo ya
-- no ofrece), sino conservar una asociación que el propio Order ya tenía.
--
-- =========================================================================
-- DECISIÓN — duplicación (rpc_duplicate_order):
-- =========================================================================
-- Sin cambios — ver ALCANCE arriba. rpc_duplicate_order jamás permite que
-- el llamador elija organization_id/business_unit_id/catalog_product_id:
-- los tres se copian verbatim de un Order ya persistido (por construcción,
-- ya válido cuando se creó, bajo cualquiera de las reglas de arriba). No
-- hay ninguna entrada de usuario que pueda introducir un cross-org/
-- cross-BU/producto-nunca-válido nuevo en esta ruta, así que agregar el
-- chequeo aquí no cerraría ningún hueco real — sería validar datos que ya
-- pasaron por la validación correspondiente cuando se escribieron por
-- primera vez.
--
-- =========================================================================
-- DECISIÓN — Business Unit nula en el Order:
-- =========================================================================
-- orders.business_unit_id es NULLABLE (a diferencia de quotes.business_
-- unit_id, NOT NULL) — un Order histórico o creado sin elegir Business
-- Unit no tiene con qué comparar la elegibilidad de un producto restringido
-- a Business Units específicas. Igual que el resto del proyecto ("nunca
-- inventar un valor que no existe"), el chequeo de Business Unit se omite
-- por completo cuando el Order no tiene business_unit_id — el chequeo de
-- organización/activo sigue aplicando sin excepción.
--
-- Como el resto del proyecto: idempotente (create or replace) y corre
-- completa en una sola transacción (begin/commit).

begin;

-- =========================================================================
-- 1) fn_check_order_item_catalog_product — validación reutilizable por
--    rpc_create_order y rpc_update_order. No retorna nada: solo lanza
--    excepción si algo no cumple (mismo estilo que fn_check_quote_item_
--    catalog_product, 0031).
-- =========================================================================
create or replace function fn_check_order_item_catalog_product(
  p_catalog_product_id uuid,
  p_organization_id uuid,
  p_business_unit_id uuid,
  p_require_active boolean default true
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_product_org uuid;
  v_product_active boolean;
  v_has_bu_restriction boolean;
  v_eligible_for_bu boolean;
begin
  select organization_id, active into v_product_org, v_product_active
    from product_catalog where id = p_catalog_product_id;

  if v_product_org is null then
    raise exception 'catalog_product_id % no existe o no pertenece a tu organización.', p_catalog_product_id;
  end if;

  if v_product_org <> p_organization_id then
    raise exception 'catalog_product_id % no pertenece a tu organización.', p_catalog_product_id;
  end if;

  if p_require_active and not v_product_active then
    raise exception 'catalog_product_id % no está activo.', p_catalog_product_id;
  end if;

  if p_business_unit_id is not null then
    select exists (select 1 from product_business_units where product_id = p_catalog_product_id)
      into v_has_bu_restriction;

    if v_has_bu_restriction then
      select exists (
        select 1 from product_business_units
        where product_id = p_catalog_product_id and business_unit_id = p_business_unit_id
      ) into v_eligible_for_bu;

      if not v_eligible_for_bu then
        raise exception 'catalog_product_id % no está disponible para la Business Unit de este pedido.', p_catalog_product_id;
      end if;
    end if;
  end if;
end;
$$;

-- =========================================================================
-- 2) rpc_create_order — agrega validación de catalog_product_id por línea.
--    p_require_active = false únicamente cuando source_quote_id is not
--    null (conversión Quote → Order, ver DECISIÓN arriba). Resto de la
--    función (roles, cross-org de salesperson/customer/business_unit,
--    snapshot de client_name, inserts de items/imágenes/archivos) sin
--    cambios de comportamiento.
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
  v_source_quote_id uuid;
  v_client_name text;
  v_quote_status text;
  v_catalog_product_id uuid;
  v_require_active boolean;
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

  -- Salesperson cross-org: la única relación inequívoca hoy entre
  -- salespeople y organización es salespeople.person_id →
  -- people.organization_id (columna única, NOT NULL en people — ver
  -- 0015/0016). Cuando el salesperson no tiene person_id (nullable,
  -- "Caso C" de 0016, nunca resuelto por ningún backfill), no se puede
  -- verificar sin inventar un mapeo — no se bloquea (límite conocido,
  -- documentado desde 0022).
  v_salesperson_org_id := fn_salesperson_organization_id(v_final_salesperson_id);

  if v_salesperson_org_id is not null and v_salesperson_org_id <> v_organization_id then
    raise exception 'El vendedor seleccionado no pertenece a tu organización.';
  end if;

  v_customer_id := nullif(p_order->>'customer_id', '')::uuid;
  v_business_unit_id := nullif(p_order->>'business_unit_id', '')::uuid;
  v_source_quote_id := nullif(p_order->>'source_quote_id', '')::uuid;

  if v_source_quote_id is not null then
    -- Quote → Order: client_name es el snapshot histórico de
    -- quotes.customer_name al momento de aceptar la cotización, NUNCA el
    -- nombre vivo de customers — a diferencia de un Order manual con
    -- customer_id (rama else-if de abajo), donde sí se relee el nombre
    -- actual. Si customers.name cambia después de convertir la Quote, el
    -- Order ya creado no debe reflejar ese cambio. Se revalida aquí
    -- (existencia + status='aceptada'), independientemente de que
    -- rpc_create_order_from_quote ya lo haya validado, porque es esta
    -- función la que decide qué valor de client_name persistir.
    select customer_name, status into v_client_name, v_quote_status
      from quotes
      where id = v_source_quote_id;
    if v_client_name is null then
      raise exception 'La cotización de origen no existe o no tiene acceso.';
    end if;
    if v_quote_status <> 'aceptada' then
      raise exception 'Solo una cotización aceptada puede convertirse a pedido (status actual: %)', v_quote_status;
    end if;
    if v_customer_id is not null
       and not exists (select 1 from customers where id = v_customer_id and organization_id = v_organization_id) then
      raise exception 'El cliente seleccionado no existe o no pertenece a tu organización.';
    end if;
  elsif v_customer_id is not null then
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

  -- catalog_product_id de cada línea: activo obligatorio SOLO si el Order
  -- no viene de una Quote (ver DECISIÓN "producto inactivo" arriba).
  -- Organización/Business Unit se validan siempre, sin excepción.
  v_require_active := v_source_quote_id is null;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    if v_catalog_product_id is not null then
      perform fn_check_order_item_catalog_product(v_catalog_product_id, v_organization_id, v_business_unit_id, v_require_active);
    end if;
  end loop;

  insert into orders (
    id, organization_id, customer_id, business_unit_id, source_quote_id,
    salesperson_id, order_date, client_name, supplier_name, product_type, product_type_name_snapshot, status,
    general_notes, vendor_notes, vendor_notes_en,
    payment_terms, delivery_time, warranty, customer_notes,
    projector_model, projector_quantity, projector_power, projector_lens_type, projector_lens_pending_factory,
    projection_description, projection_description_en, projection_file_path, projection_file_name, projection_file_type,
    projection_width, projection_height, projection_size_unit,
    installation_height, installation_height_unit, installation_distance, installation_orientation, installation_use,
    surface_type, surface_material, surface_notes, surface_notes_en
  )
  values (
    p_order_id, v_organization_id, v_customer_id, v_business_unit_id, v_source_quote_id,
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
    nullif(p_order->>'payment_terms', ''),
    nullif(p_order->>'delivery_time', ''),
    nullif(p_order->>'warranty', ''),
    nullif(p_order->>'customer_notes', ''),
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
      unit, customer_requirements,
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
      nullif(v_item->>'unit', ''), nullif(v_item->>'customer_requirements', ''),
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
-- 3) rpc_update_order — agrega validación de catalog_product_id por línea.
--    p_require_active = false únicamente para catalog_product_id que YA
--    estaban asociados a este Order antes de este UPDATE (capturados ANTES
--    del delete) — ver DECISIÓN "resave" arriba. Resto de la función
--    (ausente ≠ null para customer_id/business_unit_id, snapshot de
--    client_name, reemplazo completo de items/imágenes/archivos) sin
--    cambios de comportamiento.
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
  v_existing_catalog_product_ids uuid[];
  v_catalog_product_id uuid;
  v_require_active boolean;
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

  -- Conjunto de catalog_product_id YA asociados a este Order ANTES de este
  -- UPDATE — capturado antes del delete de abajo (ver DECISIÓN "resave").
  select coalesce(array_agg(distinct catalog_product_id) filter (where catalog_product_id is not null), array[]::uuid[])
    into v_existing_catalog_product_ids
    from order_items where order_id = p_order_id;

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
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    if v_catalog_product_id is not null then
      v_require_active := not (v_catalog_product_id = any(v_existing_catalog_product_ids));
      perform fn_check_order_item_catalog_product(v_catalog_product_id, v_organization_id, v_business_unit_id, v_require_active);
    end if;

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
      v_catalog_product_id, v_item->>'color'
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

commit;
