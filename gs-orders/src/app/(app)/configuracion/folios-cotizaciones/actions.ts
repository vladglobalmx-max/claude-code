"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCurrentOrganizationId } from "@/lib/user-access";
import { createQuoteSequenceSchema, updateQuoteSequenceSchema } from "@/lib/validations/quote-sequence";
import { mapDbError } from "@/lib/db-errors";

export type QuoteSequenceFormState = { error?: string } | undefined;

function duplicatePrefixMessage(prefix: string) {
  return `Ya existe una configuración de folio con el prefijo "${prefix}" en tu organización.`;
}

/** postgres no da un código de constraint dedicado — se distingue por el nombre del índice en el mensaje de error. */
function isDuplicatePrefixError(message: string) {
  return message.includes("salesperson_quote_sequences_prefix_unique");
}

function isDuplicatePairError(message: string) {
  return message.includes("salesperson_quote_sequences_unique_pair");
}

/**
 * Crea una configuración de folio Vendedor × Business Unit
 * (salesperson_quote_sequences, ver 0020_core_quotes.sql). ADMIN-only —
 * reforzado por RLS (salesperson_quote_sequences_insert_admin) y por
 * middleware (/configuracion es admin-only), sin guard adicional aquí.
 * `sequence_current` nunca se envía: nace en 0 (default de la columna) y de
 * ahí en adelante es propiedad exclusiva de fn_next_quote_folio().
 */
export async function createQuoteSequence(
  _prevState: QuoteSequenceFormState,
  formData: FormData
): Promise<QuoteSequenceFormState> {
  const parsed = createQuoteSequenceSchema.safeParse({
    salesperson_id: formData.get("salesperson_id"),
    business_unit_id: formData.get("business_unit_id"),
    quote_prefix: formData.get("quote_prefix"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return { error: orgResult.error };

  const { error } = await supabase.from("salesperson_quote_sequences").insert({
    organization_id: orgResult.organizationId,
    salesperson_id: parsed.data.salesperson_id,
    business_unit_id: parsed.data.business_unit_id,
    quote_prefix: parsed.data.quote_prefix,
  });

  if (error) {
    if (error.code === "23505") {
      if (isDuplicatePrefixError(error.message)) return { error: duplicatePrefixMessage(parsed.data.quote_prefix) };
      if (isDuplicatePairError(error.message)) {
        return { error: "Este vendedor ya tiene una configuración de folio para esta Business Unit." };
      }
      return { error: "Ya existe una configuración de folio con esos datos." };
    }
    // Las excepciones de trg_check_salesperson_quote_sequence_valid (person_id
    // NULL, organización distinta, fuera de las Business Units asignadas,
    // Business Unit inactiva sin asignaciones — ver 0020) llegan con code
    // P0001 y ya están escritas en español legible; mapDbError las respeta.
    return { error: mapDbError(error, "No se pudo crear la configuración de folio. Intenta de nuevo.") };
  }

  revalidatePath("/configuracion/folios-cotizaciones");
  redirect("/configuracion/folios-cotizaciones");
}

/**
 * Edita únicamente quote_prefix y active — salesperson_id/business_unit_id
 * identifican la fila y no se reasignan desde esta pantalla (ver AJUSTE 1
 * de la aprobación de Q4). sequence_current nunca se envía: no es editable
 * desde ninguna pantalla.
 */
export async function updateQuoteSequence(
  id: string,
  _prevState: QuoteSequenceFormState,
  formData: FormData
): Promise<QuoteSequenceFormState> {
  const parsed = updateQuoteSequenceSchema.safeParse({
    quote_prefix: formData.get("quote_prefix"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("salesperson_quote_sequences")
    .update({ quote_prefix: parsed.data.quote_prefix, active: parsed.data.active })
    .eq("id", id);

  if (error) {
    if (error.code === "23505" && isDuplicatePrefixError(error.message)) {
      return { error: duplicatePrefixMessage(parsed.data.quote_prefix) };
    }
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/configuracion/folios-cotizaciones");
  redirect("/configuracion/folios-cotizaciones");
}
