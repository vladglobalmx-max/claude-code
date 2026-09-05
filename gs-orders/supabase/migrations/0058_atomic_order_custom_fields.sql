-- =========================================================================
-- THÖREN — Fase 8B (Gap 2): guardado atómico de Pedido + custom fields
-- =========================================================================
-- ANTES: createOrder/updateOrder llamaban a rpc_create_order/rpc_update_order
-- y, si eso tenía éxito, escribían custom_field_values en un segundo paso
-- desde TypeScript. Si ese segundo paso fallaba, el Pedido quedaba creado
-- sin sus campos personalizados — inaceptable para un campo `required`.
--
-- AHORA: dos RPC adicionales (rpc_create_order_with_custom_fields /
-- rpc_update_order_with_custom_fields) envuelven a los RPC existentes
-- SIN reescribirlos — los llaman internamente y, en la misma llamada de
-- función (misma transacción de Postgres: cualquier excepción revierte
-- TODO, incluido el Pedido), validan y guardan los custom_field_values.
--
-- fn_apply_order_item_custom_fields hace la validación real (required,
-- tipo, opción válida de un select, campo activo) del lado de la base de
-- datos — nunca confía en que TypeScript ya validó: un payload manipulado
-- que se salte la validación de TS debe seguir siendo rechazado aquí.
--
-- Resolución de organización/BU: SIEMPRE se lee de la fila `orders` recién
-- guardada (nunca de un parámetro del cliente) — así una definición de
-- otra organización nunca puede resolverse ni escribirse por más que el
-- cliente mande su `key`.
--
-- DECISIÓN — fn_apply_order_item_custom_fields es SECURITY DEFINER: la
-- policy custom_field_definitions_select (0055) solo deja ver definiciones
-- INACTIVAS a un admin, nunca a un vendedor — así que bajo la sesión de un
-- vendedor (SECURITY INVOKER) una definición desactivada es indistinguible
-- de "no existe", y el rechazo explícito de TEST G2-17 (escribir sobre un
-- campo desactivado) nunca podría dispararse. SECURITY DEFINER le da
-- visibilidad completa para decidir bien "no existe" vs. "existe pero está
-- desactivada". Como esto amplía lo que la función puede LEER, se
-- reintroduce la autoridad real de escritura explícitamente adentro
-- (current_user_can_write_custom_field_value) en vez de confiar en que la
-- RLS de custom_field_values la siga aplicando sola — necesario porque
-- cualquier función en `public` es alcanzable directo por RPC con una
-- sesión autenticada, no solo desde los wrappers de arriba.
begin;

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
  v_items_arr jsonb[];
  v_cfv jsonb;
  v_key text;
  v_raw text;
  v_def custom_field_definitions%rowtype;
  v_value_text text;
  v_value_number numeric;
  v_value_boolean boolean;
  v_value_date date;
  i integer;
begin
  select organization_id, business_unit_id into v_org_id, v_bu_id from orders where id = p_order_id;

  select array_agg(id order by position) into v_item_ids from order_items where order_id = p_order_id;
  select array_agg(value order by ordinality) into v_items_arr
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(value, ordinality);

  if v_item_ids is null then
    return;
  end if;

  for i in 1 .. array_length(v_item_ids, 1) loop
    -- Re-verifica la autoridad real sobre ESTE order_item explícitamente
    -- (SECURITY DEFINER deja de heredar la RLS de custom_field_values
    -- automáticamente) — nunca confiar en que solo llegar hasta aquí ya
    -- prueba autorización, por si esta función se invoca directo.
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

    -- Se recorren TODAS las definiciones activas de esta organización/BU
    -- (no solo las claves que el cliente decidió enviar) — un campo
    -- `required` omitido por completo del payload debe rechazarse igual
    -- que uno enviado vacío; confiar en jsonb_each_text(v_cfv) por sí solo
    -- dejaba pasar exactamente ese caso (una clave ausente nunca aparece
    -- al iterar el objeto recibido).
    for v_def in
      select * from custom_field_definitions
        where organization_id = v_org_id and entity_type = 'order_item' and active
          and (business_unit_id is null or business_unit_id = v_bu_id)
    loop
      v_raw := v_cfv ->> v_def.key;

      v_value_text := null;
      v_value_number := null;
      v_value_boolean := null;
      v_value_date := null;

      if v_def.field_type = 'checkbox' then
        v_value_boolean := (v_raw = 'on');
        if v_def.required and not v_value_boolean then
          raise exception '% es obligatorio.', v_def.label;
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
        organization_id, definition_id, entity_type, entity_id, value_text, value_number, value_boolean, value_date
      )
      values (v_org_id, v_def.id, 'order_item', v_item_ids[i], v_value_text, v_value_number, v_value_boolean, v_value_date)
      on conflict (definition_id, entity_id) do update set
        value_text = excluded.value_text,
        value_number = excluded.value_number,
        value_boolean = excluded.value_boolean,
        value_date = excluded.value_date;
    end loop;

    -- Segunda pasada: cualquier clave del payload que resuelva a una
    -- definición INACTIVA (existe, pero ya no acepta captura nueva) se
    -- rechaza explícitamente si trae un valor no vacío — un campo
    -- desactivado no debe poder recibir datos nuevos por más que el
    -- cliente lo siga enviando. Va aparte del loop de arriba (que solo
    -- itera definiciones ACTIVAS) para no confundir "nunca existió"/
    -- "pertenece a otra organización" (no-op silencioso, ver DECISIÓN de
    -- 0055) con "existe pero está desactivada" (rechazo explícito).
    for v_key, v_raw in select * from jsonb_each_text(v_cfv)
    loop
      select * into v_def from custom_field_definitions
        where organization_id = v_org_id and entity_type = 'order_item' and key = v_key and not active
          and (business_unit_id is null or business_unit_id = v_bu_id)
        limit 1;
      if found and v_raw is not null and btrim(v_raw) <> '' then
        raise exception '% ya no está activo y no admite nuevos valores.', v_def.label;
      end if;
    end loop;
  end loop;
end;
$$;

-- Wrapper additivo — rpc_create_order NO se modifica ni se reescribe.
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
begin
  v_order := rpc_create_order(p_order_id, p_order, p_items, p_images, p_files);
  perform fn_apply_order_item_custom_fields(p_order_id, p_items);
  return v_order;
end;
$$;

-- Wrapper additivo — rpc_update_order NO se modifica ni se reescribe.
-- rpc_update_order borra y reinserta TODOS los order_items (0034): sus ids
-- viejos hay que capturarlos ANTES de llamarlo (después ya no existen) para
-- poder limpiar los custom_field_values que quedarían huérfanos.
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
begin
  select array_agg(id) into v_old_item_ids from order_items where order_id = p_order_id;

  v_order := rpc_update_order(p_order_id, p_order, p_items, p_images, p_files);

  if v_old_item_ids is not null then
    delete from custom_field_values where entity_type = 'order_item' and entity_id = any(v_old_item_ids);
  end if;

  perform fn_apply_order_item_custom_fields(p_order_id, p_items);
  return v_order;
end;
$$;

commit;
