import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { CustomFieldDefinition, CustomFieldEntityType, CustomFieldParsedValue } from "./types";

type DefinitionRow = Database["public"]["Tables"]["custom_field_definitions"]["Row"];
type ValueRow = Database["public"]["Tables"]["custom_field_values"]["Row"];

function mapDefinition(row: DefinitionRow): CustomFieldDefinition {
  return {
    id: row.id,
    organizationId: row.organization_id,
    businessUnitId: row.business_unit_id,
    entityType: row.entity_type as CustomFieldEntityType,
    key: row.key,
    label: row.label,
    fieldType: row.field_type as CustomFieldDefinition["fieldType"],
    required: row.required,
    active: row.active,
    sortOrder: row.sort_order,
    placeholder: row.placeholder,
    helpText: row.help_text,
    options: (row.options as string[] | null) ?? null,
  };
}

/**
 * Definiciones activas visibles para renderizar una entidad: org-wide
 * (business_unit_id null) + las de la Business Unit indicada — nunca las
 * de otra BU (0055_custom_fields_core.sql). `businessUnitId` ausente
 * (undefined) trae TODAS las de la organización sin filtrar por BU — se
 * usa para el admin de definiciones y para las páginas de Pedidos, que
 * filtran por la BU vigente en el cliente (puede cambiar sin recargar,
 * ver ProductosSection).
 */
export async function getCustomFieldDefinitions(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    entityType: CustomFieldEntityType;
    businessUnitId?: string | null;
    includeInactive?: boolean;
  }
): Promise<CustomFieldDefinition[]> {
  let query = supabase
    .from("custom_field_definitions")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("entity_type", params.entityType)
    .order("sort_order", { ascending: true });
  if (!params.includeInactive) query = query.eq("active", true);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as DefinitionRow[];
  const scoped =
    params.businessUnitId === undefined
      ? rows
      : rows.filter((row) => row.business_unit_id === null || row.business_unit_id === params.businessUnitId);

  return scoped.map(mapDefinition);
}

/** Todas las definiciones (activas e inactivas) de una organización, para el admin de Configuración → Campos personalizados. */
export async function getAllCustomFieldDefinitions(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<CustomFieldDefinition[]> {
  const { data, error } = await supabase
    .from("custom_field_definitions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("entity_type", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return (data as DefinitionRow[]).map(mapDefinition);
}

export async function getCustomFieldDefinitionById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<CustomFieldDefinition | null> {
  const { data, error } = await supabase.from("custom_field_definitions").select("*").eq("id", id).single();
  if (error || !data) return null;
  return mapDefinition(data as DefinitionRow);
}

export interface CustomFieldValueRow {
  entityId: string;
  definitionId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueDate: string | null;
}

/** Lee los valores guardados para un conjunto de entidades (p. ej. los order_items de un pedido al editarlo). */
export async function getCustomFieldValues(
  supabase: SupabaseClient<Database>,
  entityType: CustomFieldEntityType,
  entityIds: string[]
): Promise<CustomFieldValueRow[]> {
  if (entityIds.length === 0) return [];
  const { data, error } = await supabase
    .from("custom_field_values")
    .select("*")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);
  if (error || !data) return [];
  return (data as ValueRow[]).map((row) => ({
    entityId: row.entity_id,
    definitionId: row.definition_id,
    valueText: row.value_text,
    valueNumber: row.value_number,
    valueBoolean: row.value_boolean,
    valueDate: row.value_date,
  }));
}

/** Forma cruda (string de formulario) de un valor ya guardado, según el tipo de su definición. */
function rawValueFromParsed(fieldType: CustomFieldDefinition["fieldType"], row: CustomFieldValueRow): string {
  switch (fieldType) {
    case "checkbox":
      return row.valueBoolean ? "on" : "";
    case "number":
      return row.valueNumber === null ? "" : String(row.valueNumber);
    case "date":
      return row.valueDate ?? "";
    default:
      return row.valueText ?? "";
  }
}

/** Agrupa filas de custom_field_values por entity_id, con las claves de sus definiciones — listo para hidratar un formulario. */
export function groupCustomFieldRawValuesByEntity(
  definitions: CustomFieldDefinition[],
  valueRows: CustomFieldValueRow[]
): Record<string, Record<string, string>> {
  const definitionsById = new Map(definitions.map((d) => [d.id, d]));
  const result: Record<string, Record<string, string>> = {};
  for (const row of valueRows) {
    const def = definitionsById.get(row.definitionId);
    if (!def) continue;
    (result[row.entityId] ??= {})[def.key] = rawValueFromParsed(def.fieldType, row);
  }
  return result;
}

/**
 * Guarda (upsert) los valores ya validados de una entidad. No borra
 * definiciones ausentes del arreglo — el llamador decide qué conjunto
 * escribir (ver DECISIÓN de limpieza en pedidos/actions.ts, que sí borra
 * explícitamente las filas de una entidad que dejó de existir).
 */
export async function saveCustomFieldValues(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  entityType: CustomFieldEntityType,
  entityId: string,
  values: CustomFieldParsedValue[]
): Promise<{ error: string | null }> {
  if (values.length === 0) return { error: null };
  const rows = values.map((v) => ({
    organization_id: organizationId,
    definition_id: v.definitionId,
    entity_type: entityType,
    entity_id: entityId,
    value_text: v.valueText,
    value_number: v.valueNumber,
    value_boolean: v.valueBoolean,
    value_date: v.valueDate,
  }));
  const { error } = await supabase
    .from("custom_field_values")
    .upsert(rows, { onConflict: "definition_id,entity_id" });
  return { error: error ? error.message : null };
}

/** Borra los valores de entidades que dejaron de existir (p. ej. order_items reemplazados por rpc_update_order/rpc_delete_order). */
export async function deleteCustomFieldValuesForEntities(
  supabase: SupabaseClient<Database>,
  entityType: CustomFieldEntityType,
  entityIds: string[]
): Promise<void> {
  if (entityIds.length === 0) return;
  await supabase.from("custom_field_values").delete().eq("entity_type", entityType).in("entity_id", entityIds);
}
