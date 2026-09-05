-- =========================================================================
-- THÖREN — Fase 8C: Vertical Residue Cleanup — tipos "file"/"image"
-- =========================================================================
-- Para eliminar el último hardcode real de Thunder (la imagen a proyectar,
-- forzada por isProjector hasta 8C) el motor de custom fields necesita un
-- tipo de adjunto — no existía en 0055 (solo text/textarea/number/select/
-- checkbox/date). "file" e "image" son idénticos del lado de la base de
-- datos (mismo almacenamiento, misma validación); solo difieren en el
-- `accept` del selector de archivos en el cliente.
--
-- Reutiliza Storage/RLS ya existente (uploadMediaFile, 0050) — no es un
-- sistema de documentos nuevo. El valor se guarda como un arreglo de rutas
-- en `custom_field_values.value_json`, columna reservada desde 0055
-- exactamente para "un futuro tipo compuesto".
begin;

alter table custom_field_definitions drop constraint custom_field_definitions_field_type_check;
alter table custom_field_definitions add constraint custom_field_definitions_field_type_check
  check (field_type in ('text', 'textarea', 'number', 'select', 'checkbox', 'date', 'file', 'image'));

-- fn_apply_order_item_custom_fields (0058) gana los dos tipos nuevos: el
-- valor crudo es un JSON de rutas de Storage (mismo arreglo que arma el
-- cliente al subir/quitar archivos) — required exige al menos una ruta;
-- sin tipo/formato adicional que validar más allá de "es un arreglo de
-- strings".
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
  v_value_json jsonb;
  v_paths_count integer;
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
      v_value_json := null;

      if v_def.field_type = 'checkbox' then
        v_value_boolean := (v_raw = 'on');
        if v_def.required and not v_value_boolean then
          raise exception '% es obligatorio.', v_def.label;
        end if;
      elsif v_def.field_type in ('file', 'image') then
        -- Forma cruda: JSON de rutas de Storage (arreglo de strings), o
        -- ausente/'[]' cuando no hay archivos. Nunca vacío por trim, a
        -- diferencia de los tipos de texto — "vacío" es arreglo sin rutas.
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
        limit 1;
      if found and v_raw is not null and btrim(v_raw) <> '' and v_raw <> '[]' then
        raise exception '% ya no está activo y no admite nuevos valores.', v_def.label;
      end if;
    end loop;
  end loop;
end;
$$;

commit;
