-- =========================================================================
-- THÖREN — Fase 8D (gap final): requisitos CORE configurables por
-- Business Unit antes de "Pedido"
-- =========================================================================
-- PROBLEMA: 8D (0061) eliminó correctamente `getMissingProjectorFields`
-- (regla hardcodeada por `product_type === 'proyector_gobo'`), pero de
-- paso Thunder perdió "Proveedor obligatorio antes de Pedido" — porque
-- `supplier_name` es una columna CORE real de `orders` (no un custom
-- field: entity_type de custom_field_definitions solo admite
-- 'product'|'quote_item'|'order_item', nunca 'order' — ampliarlo sería
-- reabrir el motor de 8B/8C, fuera de alcance) y por lo tanto no puede
-- migrarse al modelo de custom fields.
--
-- SOLUCIÓN — una tabla de configuración mínima por Business Unit,
-- columnas booleanas planas (mismo espíritu que required_before_order/
-- required_before_fulfillment de 0061), diseñada para poder agregar otros
-- flags CORE después sin migrar arquitectura: hoy solo
-- `require_supplier_before_order`. NUNCA `if business_unit.code =
-- 'thunder_led'` en ningún lado — la fuente de verdad es esta tabla,
-- sembrada para Thunder LED en esta misma migración (dato, no código).
begin;

create table if not exists business_unit_process_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  business_unit_id uuid not null references business_units (id) on delete restrict,
  require_supplier_before_order boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_unit_process_settings_bu_unique unique (business_unit_id)
);

create index if not exists business_unit_process_settings_org_idx
  on business_unit_process_settings (organization_id);

alter table business_unit_process_settings enable row level security;

-- RLS: mismo criterio que el resto de Configuración por organización —
-- cualquier miembro puede LEER (para saber qué se le va a exigir),
-- solo un admin de esa organización puede escribir.
drop policy if exists "business_unit_process_settings_select_member" on business_unit_process_settings;
create policy "business_unit_process_settings_select_member" on business_unit_process_settings
  for select using (is_organization_member(organization_id));

drop policy if exists "business_unit_process_settings_admin_write" on business_unit_process_settings;
create policy "business_unit_process_settings_admin_write" on business_unit_process_settings
  for all using (is_organization_admin(organization_id))
  with check (is_organization_admin(organization_id));

drop trigger if exists trg_business_unit_process_settings_updated_at on business_unit_process_settings;
create trigger trg_business_unit_process_settings_updated_at
  before update on business_unit_process_settings
  for each row execute function set_updated_at();

-- =========================================================================
-- Seed — Thunder LED conserva EXACTAMENTE su comportamiento histórico:
-- Proveedor seguía siendo obligatorio antes de "Pedido". Dato de
-- configuración, no una regla de código.
-- =========================================================================
do $$
declare
  v_org_id uuid;
  v_bu_thunder_led uuid;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise notice '0062: no existe global-supplier-mty en este entorno — seed omitido (defensivo, no es un error).';
    return;
  end if;

  select id into v_bu_thunder_led from business_units where organization_id = v_org_id and code = 'thunder_led';
  if v_bu_thunder_led is null then
    raise notice '0062: no existe la Business Unit thunder_led en este entorno — seed omitido.';
    return;
  end if;

  insert into business_unit_process_settings (organization_id, business_unit_id, require_supplier_before_order)
  values (v_org_id, v_bu_thunder_led, true)
  on conflict (business_unit_id) do update set require_supplier_before_order = true;
end $$;

-- =========================================================================
-- Enforcement — extiende (CREATE OR REPLACE, misma firma) la ÚNICA
-- función de autoridad real de 0061: fn_get_missing_required_before_order_fields.
-- Sigue siendo invocada exactamente por los mismos 3 call sites (sin
-- cambiarlos): rpc_create_order_with_custom_fields, rpc_update_order_
-- with_custom_fields (dentro de la misma transacción) y setOrderStatus
-- (vía RPC directo) — todos heredan el requisito CORE sin ningún cambio
-- de código adicional. Un solo arreglo de faltantes combina "Proveedor"
-- (CORE) con los custom fields required_before_order — una sola
-- respuesta de completitud, tal como la consume el mensaje genérico del
-- cliente/servidor.
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

  -- Requisito CORE configurable (0062) — Proveedor, no un custom field,
  -- no un hardcode de Business Unit. Sin Business Unit elegida, no aplica
  -- ningún requisito (mismo criterio que 0032/orders.business_unit_id
  -- nullable: "ausente" nunca implica "requerido").
  if v_bu_id is not null then
    select require_supplier_before_order into v_require_supplier
      from business_unit_process_settings
      where business_unit_id = v_bu_id and organization_id = v_org_id;
    if coalesce(v_require_supplier, false) and (v_supplier_name is null or btrim(v_supplier_name) = '') then
      v_missing := v_missing || 'Proveedor'::text;
    end if;
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

commit;
