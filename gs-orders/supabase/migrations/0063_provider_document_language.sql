-- =========================================================================
-- THÖREN — Adenda PDF Pedido: idioma del documento para Proveedor
-- =========================================================================
-- PROBLEMA REAL: el PDF de Pedido/Orden (usado para enviar la orden de
-- compra/producción a un proveedor) siempre se genera en español. Para
-- Thunder LED (Global Supplier MTY) el proveedor es internacional, así que
-- ese documento debe generarse en inglés — pero el resto de la app
-- (captura, listados, otros documentos) debe seguir en español sin tocar
-- nada de eso.
--
-- MODELO — dos columnas planas, mismo espíritu que 0061/0062 (ninguna
-- tabla de traducciones, ningún motor de i18n): NUNCA `if business_unit.code
-- = 'thunder_led' then inglés` en el código.
--
--   1) business_unit_process_settings.provider_document_language ('es'|'en',
--      default 'es') — configurable por Business Unit, extiende la MISMA
--      tabla de 0062 (ya diseñada explícitamente para admitir más flags
--      CORE sin migrar arquitectura). El PDF de Pedido lee este valor para
--      decidir en qué idioma renderizar sus etiquetas fijas (diccionario
--      pequeño, ver provider-i18n.ts) — nunca un sistema de traducción de
--      toda la app.
--
--   2) custom_field_definitions.supplier_label (texto, nullable) — permite
--      que UNA definición de custom field tenga una etiqueta alterna para
--      documentos de proveedor (ej. inglés), sin tocar `label` (que sigue
--      siendo lo que ve quien captura internamente, siempre en el idioma
--      que se administró). Si supplier_label es NULL, cualquier documento
--      de proveedor cae a `label` tal cual — nunca se inventa una
--      traducción automática de un texto libre.
--
-- ALCANCE — el PDF de Pedido hoy NO renderiza custom_field_definitions/
-- custom_field_values en absoluto (sigue leyendo columnas nativas de
-- order_items con etiquetas fijas de plantilla, ver provider-i18n.ts) —
-- supplier_label es la pieza de esquema pedida explícitamente para el
-- caso genérico ("si el campo ya tiene un label en inglés, usarlo"),
-- lista para cuando un documento de proveedor renderice un custom field
-- real; documentado como tal, no una funcionalidad oculta.
--
-- Seed: Thunder LED (Global Supplier MTY) → provider_document_language='en',
-- exactamente igual que 0062 sembró require_supplier_before_order=true
-- para esa misma Business Unit — dato, no código.
begin;

alter table business_unit_process_settings
  add column provider_document_language text not null default 'es'
    check (provider_document_language in ('es', 'en'));

alter table custom_field_definitions
  add column supplier_label text;

do $$
declare
  v_org_id uuid;
  v_bu_thunder_led uuid;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise notice '0063: no existe global-supplier-mty en este entorno — seed omitido (defensivo, no es un error).';
    return;
  end if;

  select id into v_bu_thunder_led from business_units where organization_id = v_org_id and code = 'thunder_led';
  if v_bu_thunder_led is null then
    raise notice '0063: no existe la Business Unit thunder_led en este entorno — seed omitido.';
    return;
  end if;

  insert into business_unit_process_settings (organization_id, business_unit_id, provider_document_language)
  values (v_org_id, v_bu_thunder_led, 'en')
  on conflict (business_unit_id) do update set provider_document_language = 'en';
end $$;

commit;
