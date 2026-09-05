-- =========================================================================
-- THÖREN — Fase 8C: Vertical Residue Cleanup — Thunder LED, campos residuales
-- =========================================================================
-- Completa el seed de 0057: los 11 campos que hasta 8C seguían mostrándose
-- solo si `product_type === 'proyector_gobo'` (imagen a proyectar +
-- dimensiones, instalación, superficie) — ahora se muestran únicamente
-- porque Thunder LED tiene estas definiciones activas, igual que los 8 de
-- 0057. Ninguna columna nueva: siguen siendo las columnas nativas de
-- order_items (0006/0007) — este archivo solo declara cuáles existen para
-- esta BU, vía el adapter (ver legacy-order-item-adapter.ts).
--
-- DECISIÓN — required=false en las 11: la regla "obligatorio antes de
-- marcar como Pedido" para proyector/GOBO sigue viviendo en
-- getMissingProjectorFields/getMissingProjectorFieldsFromRow (business
-- rule explícita, no de presentación — ver reporte 8C). Si estos campos
-- fueran required=true aquí, fn_apply_order_item_custom_fields (0058)
-- bloquearía incluso un guardado en Borrador, rompiendo la regla histórica
-- "Borrador siempre se puede guardar incompleto".
--
-- DECISIÓN — opciones de select en minúsculas (código legacy, no la
-- etiqueta bonita en español): las columnas de destino (installation_*,
-- surface_type, surface_material) tienen un CHECK con esos códigos
-- exactos (0007_item_installation_and_multi_images.sql) y
-- custom_field_definitions.options es un arreglo auto-etiquetado (mismo
-- valor = texto mostrado y guardado) — no admite un par código/etiqueta
-- separado sin reabrir el motor de custom fields (fuera de alcance de
-- 8C). Regresión cosmética menor, documentada.
do $$
declare
  v_org_id uuid;
  v_bu_thunder_led uuid;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise notice '0060: no existe global-supplier-mty en este entorno — seed omitido (defensivo, no es un error).';
    return;
  end if;

  select id into v_bu_thunder_led from business_units where organization_id = v_org_id and code = 'thunder_led';
  if v_bu_thunder_led is null then
    raise notice '0060: no existe la Business Unit thunder_led en este entorno — seed omitido.';
    return;
  end if;

  insert into custom_field_definitions
    (organization_id, business_unit_id, entity_type, key, label, field_type, required, active, sort_order, placeholder, help_text, options)
  values
    (v_org_id, v_bu_thunder_led, 'order_item', 'projection_images', 'Imagen(es) a proyectar', 'file', false, true, 90, null, 'Puedes subir más de una imagen (por ejemplo, el diseño final y una referencia).', null),
    (v_org_id, v_bu_thunder_led, 'order_item', 'projection_width', 'Ancho de imagen requerida', 'number', false, true, 100, null, null, null),
    (v_org_id, v_bu_thunder_led, 'order_item', 'projection_height', 'Alto de imagen requerida', 'number', false, true, 110, null, null, null),
    (v_org_id, v_bu_thunder_led, 'order_item', 'projection_size_unit', 'Unidad de imagen a proyectar', 'select', false, true, 120, null, null, '["m", "cm"]'::jsonb),
    (v_org_id, v_bu_thunder_led, 'order_item', 'installation_height', 'Altura de instalación', 'number', false, true, 130, null, null, null),
    (v_org_id, v_bu_thunder_led, 'order_item', 'installation_height_unit', 'Unidad de altura de instalación', 'select', false, true, 140, null, null, '["m", "cm", "pies"]'::jsonb),
    (v_org_id, v_bu_thunder_led, 'order_item', 'installation_distance', 'Distancia proyector → superficie', 'number', false, true, 150, null, null, null),
    (v_org_id, v_bu_thunder_led, 'order_item', 'installation_orientation', 'Orientación', 'select', false, true, 160, null, null, '["piso", "pared", "inclinado", "otro"]'::jsonb),
    (v_org_id, v_bu_thunder_led, 'order_item', 'installation_use', 'Uso', 'select', false, true, 170, null, null, '["interior", "exterior", "semi_exterior"]'::jsonb),
    (v_org_id, v_bu_thunder_led, 'order_item', 'surface_type', 'Superficie', 'select', false, true, 180, null, null, '["piso", "pared", "techo", "equipo", "rack", "anden", "pasillo", "otro"]'::jsonb),
    (v_org_id, v_bu_thunder_led, 'order_item', 'surface_material', 'Material', 'select', false, true, 190, null, null, '["concreto", "epoxico", "asfalto", "metal", "pintura", "otro"]'::jsonb)
  on conflict (organization_id, business_unit_id, entity_type, key) do nothing;
end $$;
