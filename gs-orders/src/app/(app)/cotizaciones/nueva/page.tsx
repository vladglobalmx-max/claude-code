import { randomUUID } from "crypto";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getBusinessToday, addDays } from "@/lib/business-date";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { QuoteForm, type EligibleQuotePair } from "@/components/quotes/quote-form";
import { emptyQuoteForm, type QuoteCatalogProductOption } from "@/components/quotes/types";
import { createQuote } from "../actions";
import type { Customer, ProductCatalogItem } from "@/types/domain";

export const dynamic = "force-dynamic";

interface OneOrMany<T> {
  [index: number]: T;
}
function one<T>(value: T | OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : (value as T);
}

interface SequenceJoinRow {
  salesperson_id: string;
  business_unit_id: string;
  salespeople: { name: string } | OneOrMany<{ name: string }> | null;
  business_units: { name: string } | OneOrMany<{ name: string }> | null;
}

/**
 * ¿Qué Business Units puede elegir un vendedor al crear una Quote? La
 * fuente real es salesperson_quote_sequences (activas), NO
 * person_business_units directamente — ver Discovery de Q4:
 * person_business_units solo gatea si un ADMIN puede *configurar* una
 * secuencia (fallback legacy de 0020); salesperson_quote_sequences
 * (filtrada a active=true) es lo que determina qué puede elegir el
 * vendedor al cotizar. Si un VENDEDOR tiene 0 filas activas, no puede crear
 * ninguna Quote — se bloquea con un estado explícito, no un formulario roto.
 */
export default async function NuevaCotizacionPage() {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();
  const isAdmin = profile?.role === "admin";

  const [{ data: sequencesData }, { data: customersData }, { data: catalogData }, { data: catalogBuData }] =
    await Promise.all([
      supabase
        .from("salesperson_quote_sequences")
        .select("salesperson_id, business_unit_id, salespeople(name), business_units(name)")
        .eq("active", true),
      supabase.from("customers").select("*").order("name"),
      supabase.from("product_catalog").select("*").eq("active", true).order("name"),
      supabase.from("product_business_units").select("product_id, business_unit_id"),
    ]);

  const allPairs: EligibleQuotePair[] = ((sequencesData ?? []) as unknown as SequenceJoinRow[]).map((row) => ({
    salespersonId: row.salesperson_id,
    salespersonName: one(row.salespeople)?.name ?? "—",
    businessUnitId: row.business_unit_id,
    businessUnitName: one(row.business_units)?.name ?? "—",
  }));

  const eligiblePairs = isAdmin ? allPairs : allPairs.filter((pair) => pair.salespersonId === profile?.salespersonId);

  if (eligiblePairs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nueva cotización" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No hay configuración de folio disponible"
            description={
              isAdmin
                ? "No hay ninguna configuración de folio activa en tu organización. Crea una en Configuración → Folios de Cotización."
                : "No tienes una configuración de folio activa. Contacta a un ADMIN para que te asigne un prefijo y Business Unit en Configuración → Folios de Cotización."
            }
            action={
              isAdmin ? (
                <Link href="/configuracion/folios-cotizaciones/nuevo">
                  <Button>Configurar folio</Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      </div>
    );
  }

  const customers = (customersData ?? []) as Customer[];

  const businessUnitIdsByProduct = new Map<string, string[]>();
  for (const row of (catalogBuData ?? []) as { product_id: string; business_unit_id: string }[]) {
    const list = businessUnitIdsByProduct.get(row.product_id) ?? [];
    list.push(row.business_unit_id);
    businessUnitIdsByProduct.set(row.product_id, list);
  }

  const catalogProducts: QuoteCatalogProductOption[] = ((catalogData ?? []) as ProductCatalogItem[]).map((p) => ({
    id: p.id,
    category: p.category,
    sku: p.sku,
    name: p.name,
    defaultPriceMxn: p.default_price_mxn,
    defaultPriceUsd: p.default_price_usd,
    businessUnitIds: businessUnitIdsByProduct.get(p.id) ?? [],
  }));

  const quoteId = randomUUID();
  const [firstPair] = eligiblePairs;
  const validUntil = addDays(getBusinessToday(), 15);

  if (!firstPair) {
    // Inalcanzable: eligiblePairs.length === 0 ya retornó arriba. Solo para que TypeScript estreche el tipo.
    return null;
  }

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nueva cotización</h1>
      </div>
      <QuoteForm
        mode="create"
        quoteId={quoteId}
        eligiblePairs={eligiblePairs}
        customers={customers}
        catalogProducts={catalogProducts}
        initialState={emptyQuoteForm({
          businessUnitId: firstPair.businessUnitId,
          salespersonId: firstPair.salespersonId,
          validUntil,
        })}
        onSubmit={createQuote}
      />
    </div>
  );
}
