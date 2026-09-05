-- =========================================================================
-- THÖREN — Fase 8B: Thunder como primera configuración real migrada desde
-- campos hardcodeados + demo Juno/GFB (probar separación, no terminar
-- todos los formularios comerciales)
-- =========================================================================
-- Migración de DATOS (definitions), no de esquema. Resuelve la
-- organización/Business Units por slug/code (nunca UUIDs hardcodeados) —
-- si `global-supplier-mty` no existe todavía (entorno nuevo sin el
-- bootstrap de 0013), esta migración no inserta nada (defensivo, nunca
-- asume).
--
-- =========================================================================
-- THUNDER (thunder_led) — equivalente a los 8 campos hoy hardcodeados en
-- orders/productos-section.tsx (ver auditoría de 8A). Alcance deliberado:
-- SOLO estos 8 — surface_type/surface_material/installation_* (selects de
-- enum legacy) NO se migran en esta fase (documentado como pendiente, no
-- silenciado). Solo aplican a `product_type='proyector_gobo'`
-- (Thunder LED Lights), nunca a Thunder Safety Solutions — por eso se
-- scope a thunder_led, no a ambas BU de Thunder.
--
-- entity_type='order_item': la migración legacy (Fase 1, ver 0055) guarda
-- valores NUEVOS en custom_field_values por ITEM — un refinamiento
-- deliberado vs. el modelo legacy (un solo set de valores POR ORDEN
-- completa, en columnas de `orders`) documentado explícitamente en el
-- reporte de 8B, no un cambio silencioso: pedidos históricos siguen
-- leyéndose de las columnas legacy de `orders`, nunca migrados.
-- =========================================================================
do $$
declare
  v_org_id uuid;
  v_bu_thunder_led uuid;
  v_bu_juno uuid;
  v_bu_gfb uuid;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise notice '0057: no existe global-supplier-mty en este entorno — seed omitido (defensivo, no es un error).';
    return;
  end if;

  select id into v_bu_thunder_led from business_units where organization_id = v_org_id and code = 'thunder_led';
  select id into v_bu_juno from business_units where organization_id = v_org_id and code = 'juno_promotional';
  select id into v_bu_gfb from business_units where organization_id = v_org_id and code = 'got_fresh_breath';

  if v_bu_thunder_led is not null then
    insert into custom_field_definitions
      (organization_id, business_unit_id, entity_type, key, label, field_type, required, active, sort_order, placeholder, help_text, options)
    values
      (v_org_id, v_bu_thunder_led, 'order_item', 'power', 'Potencia / versión', 'text', false, true, 10, null, null, null),
      (v_org_id, v_bu_thunder_led, 'order_item', 'color', 'Color', 'text', false, true, 20, null, null, null),
      (v_org_id, v_bu_thunder_led, 'order_item', 'lens_type', 'Tipo de lente', 'text', false, true, 30, null, null, null),
      (v_org_id, v_bu_thunder_led, 'order_item', 'lens_pending_factory', 'Por definir con fábrica', 'checkbox', false, true, 40, null, null, null),
      (v_org_id, v_bu_thunder_led, 'order_item', 'projection_description', '¿Qué quiere proyectar el cliente?', 'textarea', false, true, 50, null, null, null),
      (v_org_id, v_bu_thunder_led, 'order_item', 'projection_description_en', 'Texto para proveedor (inglés)', 'textarea', false, true, 60, null, null, null),
      (v_org_id, v_bu_thunder_led, 'order_item', 'surface_notes', 'Observaciones de superficie', 'textarea', false, true, 70, null, null, null),
      (v_org_id, v_bu_thunder_led, 'order_item', 'surface_notes_en', 'Texto para proveedor (inglés)', 'textarea', false, true, 80, null, null, null)
    on conflict (organization_id, business_unit_id, entity_type, key) do nothing;
  end if;

  -- Juno Promotional — demo mínima (probar separación, no un formulario comercial completo).
  if v_bu_juno is not null then
    insert into custom_field_definitions
      (organization_id, business_unit_id, entity_type, key, label, field_type, required, active, sort_order, options)
    values
      (v_org_id, v_bu_juno, 'order_item', 'print_technique', 'Técnica de impresión', 'text', false, true, 10, null),
      (v_org_id, v_bu_juno, 'order_item', 'print_color', 'Color', 'text', false, true, 20, null),
      (v_org_id, v_bu_juno, 'order_item', 'logo_position', 'Posición del logo', 'text', false, true, 30, null)
    on conflict (organization_id, business_unit_id, entity_type, key) do nothing;
  end if;

  -- Got Fresh Breath — demo mínima.
  if v_bu_gfb is not null then
    insert into custom_field_definitions
      (organization_id, business_unit_id, entity_type, key, label, field_type, required, active, sort_order, options)
    values
      (v_org_id, v_bu_gfb, 'order_item', 'employee_count', 'Número de empleados', 'number', false, true, 10, null),
      (v_org_id, v_bu_gfb, 'order_item', 'scheme_type', 'Tipo de esquema', 'select', false, true, 20, '["Comodato","Venta"]'::jsonb)
    on conflict (organization_id, business_unit_id, entity_type, key) do nothing;
  end if;
end $$;
