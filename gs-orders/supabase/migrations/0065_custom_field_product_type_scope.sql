-- =========================================================================
-- THÖREN — Bug real: custom fields aplicados al Tipo de Producto incorrecto
-- =========================================================================
-- CASO REAL: Thunder LED / Tipo de Producto "Luces Grúa Viajera" / producto
-- TLLTPB140R — "Generar Pedido" quedaba bloqueado exigiendo "¿Qué quiere
-- proyectar el cliente?", "Imagen(es) a proyectar", "Ancho/Alto de imagen
-- requerida", "Altura de instalación" — campos que pertenecen
-- exclusivamente al flujo de Proyector / GOBO.
--
-- CAUSA EXACTA: custom_field_definitions solo escopa por
-- (organization_id, business_unit_id, entity_type) — jamás por Tipo de
-- Producto. Una definición de Business Unit ("business_unit_id = X")
-- aplica HOY a absolutamente todos los order_items de esa BU, sin
-- importar qué producto de catálogo (y por lo tanto qué Tipo de Producto)
-- traiga cada partida. fn_apply_order_item_custom_fields (0058/0059) y
-- fn_get_missing_required_before_order_fields (0061/0062) — las dos
-- autoridades reales de "requerido"/"requerido antes de Pedido" — heredan
-- exactamente ese mismo defecto.
--
-- RELACIÓN REAL Product Type → Product → Order Item (verificado, no
-- asumido): product_catalog.product_type_id (uuid, nullable, FK real a
-- product_types, 0030_product_catalog_master.sql) YA EXISTE — es el eje
-- de clasificación real de un producto de catálogo. order_items NO tiene
-- su propio product_type — se resuelve exclusivamente vía
-- order_items.catalog_product_id → product_catalog.product_type_id
-- (nullable en ambos saltos: una partida manual/no catalogada, o un
-- producto de catálogo sin tipo asignado, no tiene ningún Tipo de
-- Producto resoluble). orders.product_type es un campo de texto del
-- PEDIDO completo (snapshot legacy, no por partida) — nunca se usa aquí:
-- un Pedido puede tener partidas de Tipos de Producto distintos (ver
-- Parte 8 del ticket), así que la aplicabilidad se resuelve SIEMPRE por
-- order_item, reutilizando product_catalog.product_type_id — nunca
-- inventando una relación nueva ni usando code/string.
--
-- MODELO ELEGIDO (reutiliza la arquitectura existente, no la duplica):
-- custom_field_definitions.product_type_id uuid NULL, FK a
-- product_types(id). NULL = aplica a todos los Tipos de Producto dentro
-- del scope Organization/Business Unit ya existente (comportamiento
-- actual, sin cambios para quien no lo use). Con valor = aplica
-- ÚNICAMENTE a ese Tipo de Producto — se combina (AND, no OR) con el
-- scope de Business Unit ya existente: una definición SIEMPRE debe
-- cumplir BU-scope Y product-type-scope para aplicar a un item dado.
--
-- CLASIFICACIÓN DE LOS 19 CAMPOS DE THUNDER (evidencia real, no
-- suposición): el propio comentario de 0057 dice literalmente "Alcance
-- deliberado: SOLO estos 8 ... Solo aplican a product_type='proyector_gobo'
-- (Thunder LED Lights), nunca a Thunder Safety Solutions" para sus 8
-- campos (power, color, lens_type, lens_pending_factory,
-- projection_description, projection_description_en, surface_notes,
-- surface_notes_en); el comentario de 0060 dice "los 11 campos que hasta
-- 8C seguían mostrándose solo si product_type === 'proyector_gobo'" para
-- sus 11 (projection_images, projection_width, projection_height,
-- projection_size_unit, installation_height, installation_height_unit,
-- installation_distance, installation_orientation, installation_use,
-- surface_type, surface_material). Las 19 definiciones de Thunder LED
-- (order_item) fueron, sin excepción, exclusivas de Proyector/GOBO desde
-- su origen — el "residuo" de 8B/8C fue exactamente eliminar el
-- `isProjector` de código sin agregar el scope de datos equivalente, que
-- es lo que esta migración corrige.
--
-- FUERA DE ALCANCE (pedido explícito del ticket): no se toca
-- entity_type='product'/'quote_item' (Quotes tiene una arquitectura
-- análoga pero no fue reportada como rota — no se reabre por iniciativa
-- propia), no se toca purchase_orders/Fase 9 Block 1 (cambio lógico
-- independiente).
-- =========================================================================

begin;

-- =========================================================================
-- 1) custom_field_definitions.product_type_id — aditivo, nullable.
-- =========================================================================
alter table custom_field_definitions
  add column if not exists product_type_id uuid references product_types (id) on delete set null;

create index if not exists custom_field_definitions_product_type_idx
  on custom_field_definitions (product_type_id)
  where product_type_id is not null;

-- =========================================================================
-- 2) Datos: clasificar las 19 definitions de Thunder LED existentes.
--    Defensivo (igual criterio que 0057/0060): si el entorno no tiene
--    Thunder LED o el Tipo de Producto "Proyector / GOBO" todavía, no
--    hace nada — nunca asume.
-- =========================================================================
do $$
declare
  v_org_id uuid;
  v_bu_thunder_led uuid;
  v_product_type_proyector uuid;
  v_updated_count integer;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise notice '0065: no existe global-supplier-mty en este entorno — reclasificación de Thunder omitida.';
    return;
  end if;

  select id into v_bu_thunder_led from business_units where organization_id = v_org_id and code = 'thunder_led';
  if v_bu_thunder_led is null then
    raise notice '0065: no existe la Business Unit thunder_led en este entorno — reclasificación omitida.';
    return;
  end if;

  select id into v_product_type_proyector
    from product_types where organization_id = v_org_id and code = 'proyector_gobo';
  if v_product_type_proyector is null then
    raise notice '0065: no existe el Tipo de Producto proyector_gobo en este entorno — reclasificación omitida.';
    return;
  end if;

  update custom_field_definitions
    set product_type_id = v_product_type_proyector
    where organization_id = v_org_id
      and business_unit_id = v_bu_thunder_led
      and entity_type = 'order_item'
      and key in (
        -- 0057 (8) — "SOLO estos 8 ... Solo aplican a product_type='proyector_gobo'".
        'power', 'color', 'lens_type', 'lens_pending_factory',
        'projection_description', 'projection_description_en',
        'surface_notes', 'surface_notes_en',
        -- 0060 (11) — "los 11 campos que hasta 8C seguían mostrándose solo si product_type === 'proyector_gobo'".
        'projection_images', 'projection_width', 'projection_height', 'projection_size_unit',
        'installation_height', 'installation_height_unit', 'installation_distance',
        'installation_orientation', 'installation_use', 'surface_type', 'surface_material'
      );
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 19 then
    raise notice '0065: se esperaban 19 definitions de Thunder reclasificadas, se actualizaron % — revisar manualmente.', v_updated_count;
  end if;
end $$;

-- =========================================================================
-- 3) fn_apply_order_item_custom_fields — misma firma/lógica que 0059,
--    SOLO agrega resolución de product_type_id por partida (vía
--    order_items.catalog_product_id → product_catalog.product_type_id) y
--    el filtro adicional en ambas consultas de custom_field_definitions
--    (definitions activas a aplicar, y definitions inactivas a rechazar).
-- =========================================================================
create or replace function fn_apply_order_item_custom_fields(p_order_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_item_ids uuid[];
  v_item_catalog_product_ids uuid[];
  v_item_product_type_id uuid;
  v_items_arr jsonb[];
  v_cfv jsonb;
  v_key text;
  v_raw text;
  v_def custom_field_definitions%rowtype;
  v_value_text text;
  v_value_number numeric;
  v_value_boolean boolean;
  v_value_date date;
  v_value_json jsonb;
  v_paths_count integer;
  i integer;
begin
  select organization_id, business_unit_id into v_org_id, v_bu_id from orders where id = p_order_id;

  select array_agg(id order by position), array_agg(catalog_product_id order by position)
    into v_item_ids, v_item_catalog_product_ids
    from order_items where order_id = p_order_id;
  select array_agg(value order by ordinality) into v_items_arr
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(value, ordinality);

  if v_item_ids is null then
    return;
  end if;

  for i in 1 .. array_length(v_item_ids, 1) loop
    if not current_user_can_write_custom_field_value('order_item', v_item_ids[i]) then
      raise exception 'No tienes autoridad para modificar los campos personalizados de este producto.';
    end if;

    if v_items_arr is null or i > array_length(v_items_arr, 1) then
      continue;
    end if;

    v_cfv := v_items_arr[i] -> 'custom_field_values';
    if v_cfv is null then
      v_cfv := '{}'::jsonb;
    end if;

    -- Tipo de Producto REAL de esta partida (nunca orders.product_type,
    -- que es del Pedido completo, no de la partida — ver DECISIÓN
    -- arriba). NULL si la partida no tiene catalog_product_id (manual/no
    -- catalogada) o si ese producto no tiene product_type_id asignado —
    -- en ambos casos, correctamente, solo aplican las definitions
    -- product_type_id IS NULL (org/BU-wide).
    select product_type_id into v_item_product_type_id
      from product_catalog where id = v_item_catalog_product_ids[i];

    for v_def in
      select * from custom_field_definitions
        where organization_id = v_org_id and entity_type = 'order_item' and active
          and (business_unit_id is null or business_unit_id = v_bu_id)
          and (product_type_id is null or product_type_id = v_item_product_type_id)
    loop
      v_raw := v_cfv ->> v_def.key;

      v_value_text := null;
      v_value_number := null;
      v_value_boolean := null;
      v_value_date := null;
      v_value_json := null;

      if v_def.field_type = 'checkbox' then
        v_value_boolean := (v_raw = 'on');
        if v_def.required and not v_value_boolean then
          raise exception '% es obligatorio.', v_def.label;
        end if;
      elsif v_def.field_type in ('file', 'image') then
        begin
          v_value_json := coalesce(nullif(v_raw, '')::jsonb, '[]'::jsonb);
        exception when others then
          raise exception '%: no se pudo interpretar la lista de archivos.', v_def.label;
        end;
        if jsonb_typeof(v_value_json) <> 'array' then
          raise exception '%: no se pudo interpretar la lista de archivos.', v_def.label;
        end if;
        select count(*) into v_paths_count from jsonb_array_elements_text(v_value_json);
        if v_def.required and v_paths_count = 0 then
          raise exception '% es obligatorio.', v_def.label;
        end if;
        if v_paths_count = 0 then
          continue;
        end if;
      else
        if v_raw is null or btrim(v_raw) = '' then
          if v_def.required then
            raise exception '% es obligatorio.', v_def.label;
          end if;
          continue;
        end if;

        case v_def.field_type
          when 'text', 'textarea' then
            v_value_text := btrim(v_raw);
          when 'number' then
            begin
              v_value_number := btrim(v_raw)::numeric;
            exception when others then
              raise exception '% debe ser un número válido.', v_def.label;
            end;
          when 'date' then
            if btrim(v_raw) !~ '^\d{4}-\d{2}-\d{2}$' then
              raise exception '% debe ser una fecha válida (YYYY-MM-DD).', v_def.label;
            end if;
            v_value_date := btrim(v_raw)::date;
          when 'select' then
            if not (v_def.options ? btrim(v_raw)) then
              raise exception '%: opción no válida.', v_def.label;
            end if;
            v_value_text := btrim(v_raw);
          else
            raise exception '%: tipo de campo no soportado.', v_def.label;
        end case;
      end if;

      insert into custom_field_values (
        organization_id, definition_id, entity_type, entity_id,
        value_text, value_number, value_boolean, value_date, value_json
      )
      values (
        v_org_id, v_def.id, 'order_item', v_item_ids[i],
        v_value_text, v_value_number, v_value_boolean, v_value_date, v_value_json
      )
      on conflict (definition_id, entity_id) do update set
        value_text = excluded.value_text,
        value_number = excluded.value_number,
        value_boolean = excluded.value_boolean,
        value_date = excluded.value_date,
        value_json = excluded.value_json;
    end loop;

    for v_key, v_raw in select * from jsonb_each_text(v_cfv)
    loop
      select * into v_def from custom_field_definitions
        where organization_id = v_org_id and entity_type = 'order_item' and key = v_key and not active
          and (business_unit_id is null or business_unit_id = v_bu_id)
          and (product_type_id is null or product_type_id = v_item_product_type_id)
        limit 1;
      if found and v_raw is not null and btrim(v_raw) <> '' and v_raw <> '[]' then
        raise exception '% ya no está activo y no admite nuevos valores.', v_def.label;
      end if;
    end loop;
  end loop;
end;
$$;

-- =========================================================================
-- 4) fn_get_missing_required_before_order_fields — misma firma/lógica que
--    0062, SOLO agrega la resolución de product_type_id por partida (join
--    a product_catalog) y el filtro adicional en la consulta de
--    definitions required_before_order.
-- =========================================================================
create or replace function fn_get_missing_required_before_order_fields(p_order_id uuid)
returns text[]
language plpgsql
set search_path = public
as $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_supplier_name text;
  v_require_supplier boolean;
  v_missing text[] := '{}';
  v_item record;
  v_def record;
  v_label text;
  v_index integer := 0;
begin
  select organization_id, business_unit_id, supplier_name
    into v_org_id, v_bu_id, v_supplier_name
    from orders where id = p_order_id;
  if v_org_id is null then
    return v_missing;
  end if;

  if v_bu_id is not null then
    select require_supplier_before_order into v_require_supplier
      from business_unit_process_settings
      where business_unit_id = v_bu_id and organization_id = v_org_id;
    if coalesce(v_require_supplier, false) and (v_supplier_name is null or btrim(v_supplier_name) = '') then
      v_missing := v_missing || 'Proveedor'::text;
    end if;
  end if;

  -- product_type_id REAL de la partida, resuelto vía su producto de
  -- catálogo (nunca orders.product_type — ver DECISIÓN arriba). NULL si
  -- la partida no tiene catalog_product_id o ese producto no tiene tipo.
  for v_item in
    select oi.id, oi.model, pc.product_type_id as item_product_type_id
    from order_items oi
    left join product_catalog pc on pc.id = oi.catalog_product_id
    where oi.order_id = p_order_id
    order by oi.position, oi.created_at
  loop
    v_index := v_index + 1;
    v_label := case
      when v_item.model is not null and btrim(v_item.model) <> '' then format('Producto %s (%s)', v_index, v_item.model)
      else format('Producto %s', v_index)
    end;

    for v_def in
      select id, label from custom_field_definitions
        where organization_id = v_org_id and entity_type = 'order_item' and active and required_before_order
          and (business_unit_id is null or business_unit_id = v_bu_id)
          and (product_type_id is null or product_type_id = v_item.item_product_type_id)
    loop
      if not fn_is_order_item_custom_field_complete(v_item.id, v_def.id) then
        v_missing := v_missing || format('%s: %s', v_label, v_def.label);
      end if;
    end loop;
  end loop;

  return v_missing;
end;
$$;

commit;
