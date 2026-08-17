"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCurrentOrganizationId } from "@/lib/user-access";
import { getBusinessToday, addDays } from "@/lib/business-date";
import { quotePayloadSchema } from "@/lib/validations/quote";
import { customerSchema } from "@/lib/validations/customer";
import { mapDbError } from "@/lib/db-errors";
import type { Customer, QuoteCurrency, QuoteStatus } from "@/types/domain";

export type QuoteActionResult = { error: string } | void;

export interface QuoteWriteItemPayload {
  catalog_product_id: string | null;
  model: string;
  description?: string;
  quantity: number;
  unit_price: number;
  line_discount_percent: number;
}

/**
 * Payload que arma QuoteForm para rpc_create_quote/rpc_update_quote (ver
 * 0020_core_quotes.sql). business_unit_id/salesperson_id solo los usa
 * createQuote — updateQuote los ignora porque son inmutables una vez
 * generado el folio (trg_prevent_quote_folio_change); se validan siempre
 * igual, es cada acción la que decide qué enviar dentro de p_quote.
 */
export interface QuoteWritePayload {
  business_unit_id: string;
  salesperson_id: string;
  customer_id: string;
  currency: QuoteCurrency;
  tax_rate: number;
  global_discount_percent: number;
  valid_until: string;
  notes?: string;
  items: QuoteWriteItemPayload[];
}

/**
 * Crea la Quote completa (encabezado + líneas) en una sola transacción vía
 * rpc_create_quote. El folio lo asigna fn_next_quote_folio() dentro del
 * RPC — esta acción nunca lo calcula ni lo previsualiza (ver AJUSTE 2 de la
 * aprobación de Q4). quote_date siempre es la fecha de negocio de hoy
 * (America/Monterrey, ver business-date.ts) — no es un campo editable en
 * el Quote Builder.
 */
export async function createQuote(quoteId: string, payload: QuoteWritePayload): Promise<QuoteActionResult> {
  const parsed = quotePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_create_quote", {
    p_quote_id: quoteId,
    p_quote: {
      business_unit_id: parsed.data.business_unit_id,
      salesperson_id: parsed.data.salesperson_id,
      customer_id: parsed.data.customer_id,
      quote_date: getBusinessToday(),
      currency: parsed.data.currency,
      tax_rate: parsed.data.tax_rate,
      global_discount_percent: parsed.data.global_discount_percent,
      valid_until: parsed.data.valid_until,
      notes: parsed.data.notes ?? null,
    },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo guardar la cotización. Intenta de nuevo.") };
  }

  revalidatePath("/cotizaciones");
  redirect(`/cotizaciones/${quoteId}`);
}

/**
 * Reemplaza el contenido comercial + líneas de una Quote vía
 * rpc_update_quote — el propio RPC aborta si la Quote ya no está en
 * "borrador" (defensa adicional sobre RLS/trigger). business_unit_id/
 * salesperson_id no se envían: rpc_update_quote no los lee.
 */
export async function updateQuote(quoteId: string, payload: QuoteWritePayload): Promise<QuoteActionResult> {
  const parsed = quotePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_update_quote", {
    p_quote_id: quoteId,
    p_quote: {
      customer_id: parsed.data.customer_id,
      currency: parsed.data.currency,
      tax_rate: parsed.data.tax_rate,
      global_discount_percent: parsed.data.global_discount_percent,
      valid_until: parsed.data.valid_until,
      notes: parsed.data.notes ?? null,
    },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${quoteId}`);
  redirect(`/cotizaciones/${quoteId}`);
}

/**
 * Alta rápida de Cliente desde el modal de Nueva Cotización. Reutiliza
 * customerSchema (Q1, cero reglas nuevas) pero devuelve el Customer creado
 * en vez de redirigir — createCustomer (clientes/actions.ts) no sirve aquí
 * porque su contrato es useFormState + redirect. ADMIN y VENDEDOR pueden
 * crear clientes (customers_insert_member, 0018_core_customers.sql) — sin
 * guard de rol adicional aquí, mismo criterio que createCustomer.
 */
export async function createCustomerInline(input: {
  name: string;
  legal_name?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
}): Promise<{ customer: Customer } | { error: string }> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return { error: orgResult.error };

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: orgResult.organizationId,
      name: parsed.data.name,
      legal_name: parsed.data.legal_name ?? null,
      tax_id: parsed.data.tax_id ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo crear el cliente. Intenta de nuevo.") };
  }

  revalidatePath("/clientes");
  return { customer: data as Customer };
}

/**
 * Cambia el status de una Quote (borrador→enviada|cancelada;
 * enviada→aceptada|rechazada|cancelada). No reimplementa las reglas de
 * transición en la app: trg_quote_status_transition (0020) ya las impone en
 * DB y rechaza cualquier transición inválida — este action solo hace el
 * UPDATE bajo RLS (quotes_update_own_or_admin) y traduce el error.
 *
 * Excepción — validación previa de "al menos 1 partida" al marcar como
 * "enviada" (THÖREN Quotes Q5): Q3 permite deliberadamente una Quote en
 * borrador con 0 partidas (no hay CHECK ni validación de longitud mínima en
 * rpc_create_quote/rpc_update_quote — sigue siendo así, no se toca). Pero
 * enviar al cliente una cotización sin ningún producto no es una regla de
 * integridad de datos, es una regla de razonabilidad comercial — se valida
 * aquí, en la app, sin tocar 0020 ni agregar ningún CHECK nuevo.
 */
export async function setQuoteStatus(quoteId: string, status: QuoteStatus): Promise<{ error: string } | void> {
  const supabase = createSupabaseServerClient();

  if (status === "enviada") {
    const { count, error: countError } = await supabase
      .from("quote_items")
      .select("id", { count: "exact", head: true })
      .eq("quote_id", quoteId);
    if (countError) {
      return { error: mapDbError(countError, "No se pudo verificar las partidas de la cotización.") };
    }
    if (!count) {
      return { error: "No puedes marcar esta cotización como enviada porque no contiene partidas." };
    }
  }

  const { error } = await supabase.from("quotes").update({ status }).eq("id", quoteId);

  if (error) {
    return { error: mapDbError(error, "No se pudo actualizar el estado de la cotización.") };
  }

  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${quoteId}`);
}

/**
 * Edita únicamente `notes` — nunca contenido comercial. A propósito NO usa
 * rpc_update_quote: ese RPC rechaza correctamente cualquier escritura fuera
 * de "borrador" (ver 0020), incluso si solo se quisiera tocar `notes`. Un
 * UPDATE directo de la columna `notes` sí es legítimo en cualquier status
 * porque `notes` está explícitamente fuera de la lista de columnas que
 * trg_quote_status_transition congela — es una nota interna, no contenido
 * comercial/legal de la cotización (documentado así desde 0020). Sujeto
 * únicamente a RLS (quotes_update_own_or_admin), sin autorización nueva.
 */
export async function updateQuoteNotes(quoteId: string, notes: string): Promise<{ error: string } | void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("quotes")
    .update({ notes: notes.trim() || null })
    .eq("id", quoteId);

  if (error) {
    return { error: mapDbError(error, "No se pudo guardar la nota interna. Intenta de nuevo.") };
  }

  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${quoteId}`);
}

/**
 * Duplica una Quote (THÖREN Quotes Q5). NO existe rpc_duplicate_quote — a
 * diferencia de Orders (donde el folio se asigna automáticamente en
 * cualquier INSERT vía trg_orders_set_folio, lo que permite a
 * rpc_duplicate_order insertar directo), en Quotes el folio y los
 * snapshots son responsabilidad exclusiva de rpc_create_quote. Duplicar un
 * INSERT directo aquí significaría reimplementar esa lógica. En cambio,
 * esta acción lee la Quote origen (bajo RLS — si el VENDEDOR no puede
 * verla, tampoco puede duplicarla) + sus quote_items, arma el mismo
 * QuoteWritePayload que usa el Quote Builder, y llama a createQuote() ya
 * existente con un id nuevo:
 *   - id/folio/sequence_number: nuevos, los asigna rpc_create_quote.
 *   - quote_date: fecha de negocio de hoy (createQuote ya la calcula así
 *     siempre, nunca se copia de la original).
 *   - valid_until: hoy + 15 días (NUNCA la vigencia original, que
 *     probablemente ya venció) — misma regla default que Nueva Cotización.
 *   - status: nace "borrador" (default de rpc_create_quote).
 *   - customer_id/business_unit_id/salesperson_id/currency/tax_rate/
 *     global_discount_percent/notes/items: preservados de la original.
 *   - snapshots (customer_name, business_unit_name, salesperson_name...):
 *     se regeneran server-side dentro de rpc_create_quote a partir de las
 *     entidades ACTUALES — nunca se copian los snapshots históricos.
 * Salesperson × BU se re-valida en vivo dentro de fn_next_quote_folio
 * (llamado por rpc_create_quote): si la configuración de folio fue
 * desactivada o eliminada, la duplicación falla con el mismo mensaje claro
 * que rpc_create_quote ya produce — sin suposiciones silenciosas.
 */
export async function duplicateQuote(sourceQuoteId: string): Promise<QuoteActionResult> {
  const supabase = createSupabaseServerClient();

  const [{ data: sourceQuote }, { data: sourceItems }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", sourceQuoteId).single(),
    supabase.from("quote_items").select("*").eq("quote_id", sourceQuoteId).order("position"),
  ]);

  if (!sourceQuote) {
    return { error: "No se encontró la cotización a duplicar." };
  }

  const payload: QuoteWritePayload = {
    business_unit_id: sourceQuote.business_unit_id,
    salesperson_id: sourceQuote.salesperson_id,
    customer_id: sourceQuote.customer_id,
    currency: sourceQuote.currency as QuoteCurrency,
    tax_rate: sourceQuote.tax_rate,
    global_discount_percent: sourceQuote.global_discount_percent,
    valid_until: addDays(getBusinessToday(), 15),
    notes: sourceQuote.notes ?? undefined,
    items: (sourceItems ?? []).map((item) => ({
      catalog_product_id: item.catalog_product_id,
      model: item.model,
      description: item.description ?? undefined,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_discount_percent: item.line_discount_percent,
    })),
  };

  return createQuote(randomUUID(), payload);
}
