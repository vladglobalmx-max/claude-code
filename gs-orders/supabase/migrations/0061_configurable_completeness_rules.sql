-- =========================================================================
-- THÖREN — Fase 8D: Configurable Completeness Rules
-- =========================================================================
-- PROBLEMA REAL: getMissingProjectorFields/getMissingProjectorFieldsFromRow
-- (src/lib/validations/order.ts) seguían decidiendo "qué es obligatorio
-- antes de marcar un pedido como Pedido" con un hardcode
-- `product_type === 'proyector_gobo'` — el último criterio de negocio
-- (no de presentación, ver 8C) que aún conocía a Thunder por nombre.
--
-- MODELO — dos columnas booleanas en custom_field_definitions, NO un motor
-- de reglas/DSL/workflow (fuera de alcance, ver reporte 8D):
--   * required_before_order:       obligatorio para marcar "Pedido".
--   * required_before_fulfillment: se guarda y se administra, pero esta
--     fase NO conecta ninguna validación real sobre él todavía (deferred,
--     explícito en el brief — "no ampliar el alcance para perseguirlo").
-- `required` (0055) sigue siendo "obligatorio al capturar" (se revalida en
-- CADA guardado, incluido Borrador, vía fn_apply_order_item_custom_fields).
-- Las tres tiers son independientes: un campo puede ser required=false y
-- required_before_order=true (exactamente el caso de los 5 campos de
-- Thunder migrados abajo — antes de 8D ya eran required=false a propósito,
-- ver DECISIÓN de 0060, para no bloquear el guardado de un Borrador).
--
-- MIGRACIÓN DE LA REGLA DE THUNDER — mapeo 1:1, sin inventar requerimientos
-- nuevos. La regla vieja (ver git blame de validations/order.ts) tenía dos
-- partes:
--   (a) 3 checks a nivel Pedido: Vendedor, Cliente, Proveedor.
--   (b) 5 checks por producto: projection_description, projection_images
--       (≥1 archivo), projection_width, projection_height,
--       installation_height.
-- (b) se migra completo a required_before_order=true sobre las 5
-- definiciones ya existentes de Thunder LED (0057/0060) — mismas 5 claves,
-- ningún campo nuevo.
--
-- (a) NO se migra. custom_field_definitions.entity_type solo admite
-- 'product' | 'quote_item' | 'order_item' (0055) — nunca 'order'; ampliarlo
-- sería reabrir el motor de custom fields, explícitamente fuera de alcance
-- de 8D ("NO reabrir custom field definitions/values"). De los 3 checks:
--   - Vendedor: ya es NOT NULL en orders.salesperson_id + se valida en
--     handleSubmit del formulario antes de siquiera construir el payload —
--     eliminarlo de esta función no cambia ningún comportamiento observable.
--   - Cliente: mismo caso (orders.client_name NOT NULL + handleSubmit).
--   - Proveedor (supplier_name): es nullable, SIN ninguna otra validación
--     en el sistema. Este SÍ es un cambio de comportamiento real y
--     deliberado: a partir de 8D, un pedido de Thunder puede marcarse como
--     "Pedido" sin Proveedor capturado. Documentado explícitamente como
--     riesgo real en el reporte de cierre de 8D — no oculto.
--
-- ENFORCEMENT — 3 capas, mismo patrón que 8B Gap 2 (0058):
--   1. Cliente (UX): getMissingRequiredCustomFields (completeness.ts).
--   2. Server pre-flight: getMissingRequiredCustomFieldsFromPayload
--      (pedidos/actions.ts), antes de llamar al RPC.
--   3. AUTORIDAD REAL: fn_get_missing_required_before_order_fields, invocada
--      dentro de rpc_create_order_with_custom_fields/
--      rpc_update_order_with_custom_fields (extendidas, no reescritas) —
--      si el pedido resultante queda en status='pedido' y hay campos
--      faltantes, se hace RAISE EXCEPTION dentro de la misma transacción:
--      revierte TODO (pedido + custom fields), igual que cualquier otra
--      validación de 0058. Un payload manipulado que se salte las capas 1
--      y 2 sigue siendo rechazado aquí. setOrderStatus (pedidos/actions.ts)
--      reutiliza la MISMA función vía RPC directo, reemplazando su bloque
--      bespoke anterior de getMissingProjectorFieldsFromRow.
--
-- COMPATIBILIDAD LEGACY — fn_is_order_item_custom_field_complete es el
-- espejo en SQL del adapter de TypeScript (legacy-order-item-adapter.ts):
-- mismo criterio ("esta clave es una columna nativa de order_items,
-- 'projection_images' vive en order_item_images, cualquier otra clave vive
-- en custom_field_values") pero implementado en PL/pgSQL con SQL dinámico
-- (format(%I)) porque esta validación corre en la base de datos, no puede
-- llamar a TypeScript. Ninguna columna nueva, ningún DROP COLUMN, ninguna
-- duplicación de almacenamiento — solo lectura.
--
-- FILE/IMAGE — "completo" significa al menos una ruta PERSISTIDA:
--   * projection_images (legacy): exists(...) contra order_item_images.
--   * un file/image genuinamente nuevo (no legacy): value_json no nulo y
--     con al menos un elemento en custom_field_values. Un estado transitorio
--     de solo-frontend (archivo elegido pero no subido) nunca llega a
--     ninguna de las dos tablas, así que nunca puede contarse como completo.
begin;

alter table custom_field_definitions
  add column required_before_order boolean not null default false,
  add column required_before_fulfillment boolean not null default false;

-- Mapeo 1:1 de la regla histórica de Thunder LED — ninguna clave nueva.
do $$
declare
  v_org_id uuid;
  v_bu_thunder_led uuid;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise notice '0061: no existe global-supplier-mty en este entorno — seed omitido (defensivo, no es un error).';
    return;
  end if;

  select id into v_bu_thunder_led from business_units where organization_id = v_org_id and code = 'thunder_led';
  if v_bu_thunder_led is null then
    raise notice '0061: no existe la Business Unit thunder_led en este entorno — seed omitido.';
    return;
  end if;

  update custom_field_definitions
    set required_before_order = true
    where organization_id = v_org_id and business_unit_id = v_bu_thunder_led and entity_type = 'order_item'
      and key in ('projection_description', 'projection_images', 'projection_width', 'projection_height', 'installation_height');
end $$;

-- =========================================================================
-- fn_is_order_item_custom_field_complete — espejo SQL del legacy adapter.
-- =========================================================================
create or replace function fn_is_order_item_custom_field_complete(p_entity_id uuid, p_definition_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_def custom_field_definitions%rowtype;
  v_raw text;
  v_json jsonb;
begin
  select * into v_def from custom_field_definitions where id = p_definition_id;
  if not found then
    -- Una definición que ya no existe no puede bloquear nada (mismo
    -- criterio no-op que el resto del motor, ver 0055).
    return true;
  end if;

  -- La única clave legacy respaldada por archivos (order_item_images), no
  -- por una columna de order_items — ver LEGACY_ORDER_ITEM_FILE_FIELD_KEYS.
  if v_def.key = 'projection_images' then
    return exists (
      select 1 from order_item_images where order_item_id = p_entity_id and kind = 'projection'
    );
  end if;

  -- Mismo conjunto exacto de 17 claves que LEGACY_ORDER_ITEM_FIELD_KEYS en
  -- legacy-order-item-adapter.ts (18 menos projection_images, ya cubierta
  -- arriba) — el nombre de columna en order_items es idéntico a la clave
  -- (verificado contra 0006/0007), por eso format(%I) puede usar v_def.key
  -- directo sin una tabla de traducción aparte.
  if v_def.key in (
    'power', 'color', 'lens_type', 'lens_pending_factory',
    'projection_description', 'projection_description_en',
    'surface_notes', 'surface_notes_en',
    'projection_width', 'projection_height', 'projection_size_unit',
    'installation_height', 'installation_height_unit', 'installation_distance',
    'installation_orientation', 'installation_use',
    'surface_type', 'surface_material'
  ) then
    execute format('select %I::text from order_items where id = $1', v_def.key) using p_entity_id into v_raw;
    return v_raw is not null and btrim(v_raw) <> '';
  end if;

  -- Clave genuinamente nueva (no legacy): su valor vive en
  -- custom_field_values, ya tipado por columna según field_type.
  if v_def.field_type in ('file', 'image') then
    select value_json into v_json from custom_field_values
      where definition_id = p_definition_id and entity_id = p_entity_id;
    return v_json is not null and jsonb_array_length(v_json) > 0;
  elsif v_def.field_type = 'checkbox' then
    return exists (
      select 1 from custom_field_values
        where definition_id = p_definition_id and entity_id = p_entity_id and value_boolean = true
    );
  elsif v_def.field_type = 'number' then
    return exists (
      select 1 from custom_field_values
        where definition_id = p_definition_id and entity_id = p_entity_id and value_number is not null
    );
  elsif v_def.field_type = 'date' then
    return exists (
      select 1 from custom_field_values
        where definition_id = p_definition_id and entity_id = p_entity_id and value_date is not null
    );
  else
    return exists (
      select 1 from custom_field_values
        where definition_id = p_definition_id and entity_id = p_entity_id
          and value_text is not null and btrim(value_text) <> ''
    );
  end if;
end;
$$;

-- =========================================================================
-- fn_get_missing_required_before_order_fields — genérica, cero conocimiento
-- vertical: solo lee organization_id/business_unit_id de la fila `orders`
-- ya guardada (nunca de un parámetro del cliente, mismo criterio que 0058)
-- y las definiciones de ESA organización/BU con required_before_order=true.
-- =========================================================================
create or replace function fn_get_missing_required_before_order_fields(p_order_id uuid)
returns text[]
language plpgsql
set search_path = public
as $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_missing text[] := '{}';
  v_item record;
  v_def record;
  v_label text;
  v_index integer := 0;
begin
  select organization_id, business_unit_id into v_org_id, v_bu_id from orders where id = p_order_id;
  if v_org_id is null then
    return v_missing;
  end if;

  for v_item in
    select id, model from order_items where order_id = p_order_id order by position, created_at
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
    loop
      if not fn_is_order_item_custom_field_complete(v_item.id, v_def.id) then
        v_missing := v_missing || format('%s: %s', v_label, v_def.label);
      end if;
    end loop;
  end loop;

  return v_missing;
end;
$$;

-- =========================================================================
-- Enforcement — extiende (no reescribe) los wrappers atómicos de 0058.
-- =========================================================================
create or replace function rpc_create_order_with_custom_fields(
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
  v_missing text[];
begin
  v_order := rpc_create_order(p_order_id, p_order, p_items, p_images, p_files);
  perform fn_apply_order_item_custom_fields(p_order_id, p_items);

  if v_order.status = 'pedido' then
    v_missing := fn_get_missing_required_before_order_fields(p_order_id);
    if coalesce(array_length(v_missing, 1), 0) > 0 then
      raise exception 'No puedes continuar. Completa los campos requeridos: %', array_to_string(v_missing, '; ');
    end if;
  end if;

  return v_order;
end;
$$;

create or replace function rpc_update_order_with_custom_fields(
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
  v_old_item_ids uuid[];
  v_missing text[];
begin
  select array_agg(id) into v_old_item_ids from order_items where order_id = p_order_id;

  v_order := rpc_update_order(p_order_id, p_order, p_items, p_images, p_files);

  if v_old_item_ids is not null then
    delete from custom_field_values where entity_type = 'order_item' and entity_id = any(v_old_item_ids);
  end if;

  perform fn_apply_order_item_custom_fields(p_order_id, p_items);

  if v_order.status = 'pedido' then
    v_missing := fn_get_missing_required_before_order_fields(p_order_id);
    if coalesce(array_length(v_missing, 1), 0) > 0 then
      raise exception 'No puedes continuar. Completa los campos requeridos: %', array_to_string(v_missing, '; ');
    end if;
  end if;

  return v_order;
end;
$$;

commit;
