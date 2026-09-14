import { randomUUID } from "crypto";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SalesOrderForm } from "@/components/sales-orders/sales-order-form";
import { emptySalesOrderForm, type SalesOrderCatalogProductOption } from "@/components/sales-orders/types";
import { createSalesOrder } from "../actions";
import type { Customer } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * ¿Qué vendedor puede elegir el usuario al crear una Sales Order? Un
 * VENDEDOR (no-admin) solo puede crearla a su propio nombre
 * (salesperson_id = current_user_salesperson_id(), impuesto por
 * rpc_create_sales_order/RLS) — si no tiene salesperson vinculado, se
 * bloquea con un estado explícito. Un ADMIN puede elegir cualquier
 * vendedor activo de su organización.
 */
export default async function NuevaOrdenVentaPage() {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();
  const isAdmin = profile?.role === "admin";

  const [{ data: salespeopleData }, { data: customersData }, { data: catalogData }] = await Promise.all([
    isAdmin
      ? supabase.from("salespeople").select("id, name").eq("active", true).order("name")
      : profile?.salespersonId
        ? supabase.from("salespeople").select("id, name").eq("id", profile.salespersonId)
        : Promise.resolve({ data: [] }),
    supabase.from("customers").select("*").eq("active", true).order("name"),
    supabase
      .from("product_catalog")
      .select("id, sku, name, unit, default_price_mxn, default_price_usd")
      .eq("active", true)
      .order("name"),
  ]);

  const salespeople = (salespeopleData ?? []) as { id: string; name: string }[];

  if (salespeople.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nueva Sales Order" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No tienes un vendedor vinculado"
            description={
              isAdmin
                ? "No hay ningún vendedor activo en tu organización. Crea uno en Comercial → Vendedores."
                : "Tu usuario no tiene un vendedor vinculado. Contacta a un administrador."
            }
            action={
              isAdmin ? (
                <Link href="/vendedores/nuevo" className="text-sm text-accent hover:underline">
                  Crear vendedor
                </Link>
              ) : undefined
            }
          />
        </Card>
      </div>
    );
  }

  const customers = (customersData ?? []) as Customer[];
  const catalogProducts: SalesOrderCatalogProductOption[] = (catalogData ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    defaultPriceMxn: p.default_price_mxn,
    defaultPriceUsd: p.default_price_usd,
  }));

  const salesOrderId = randomUUID();
  const firstSalesperson = salespeople[0]!;

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nueva Sales Order</h1>
      </div>
      <SalesOrderForm
        mode="create"
        salesOrderId={salesOrderId}
        isAdmin={isAdmin}
        salespeople={salespeople.map((sp) => ({ id: sp.id, name: sp.name ?? "—" }))}
        salespersonName={!isAdmin ? firstSalesperson.name ?? undefined : undefined}
        customers={customers}
        catalogProducts={catalogProducts}
        initialState={emptySalesOrderForm({ salespersonId: firstSalesperson.id })}
        onSubmit={createSalesOrder}
      />
    </div>
  );
}
