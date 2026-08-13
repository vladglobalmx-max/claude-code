import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import { getBusinessToday } from "@/lib/business-date";
import { OrderForm } from "@/components/orders/order-form";
import { emptyOrderForm, type CatalogProductOption } from "@/components/orders/types";
import { createOrder } from "../actions";
import type { ProductCatalogItem, Salesperson } from "@/types/domain";

export default async function NuevoPedidoPage() {
  const supabase = createSupabaseServerClient();
  const [{ data }, { data: catalogData }] = await Promise.all([
    supabase.from("salespeople").select("*").eq("active", true).order("name", { ascending: true }),
    supabase
      .from("product_catalog")
      .select("*")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const salespeople = (data ?? []) as Salesperson[];
  const catalogRows = (catalogData ?? []) as ProductCatalogItem[];
  const catalogImagePaths = catalogRows.map((p) => p.image_path).filter((p): p is string => !!p);
  const catalogImageUrls = await getSignedUrls("order-media", catalogImagePaths);
  const catalogProducts: CatalogProductOption[] = catalogRows.map((p) => ({
    id: p.id,
    category: p.category,
    sku: p.sku,
    name: p.name,
    description: p.description,
    power: p.power,
    color: p.color,
    technicalNotes: p.technical_notes,
    imagePath: p.image_path,
    imagePreviewUrl: p.image_path ? catalogImageUrls[p.image_path] ?? null : null,
  }));

  const orderId = randomUUID();
  const today = getBusinessToday();

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nuevo pedido</h1>
        <p className="mt-0.5 text-sm text-ink-faint">
          El folio se genera automáticamente al guardar.
        </p>
      </div>
      <OrderForm
        orderId={orderId}
        salespeople={salespeople}
        catalogProducts={catalogProducts}
        initialState={emptyOrderForm(today)}
        onSubmit={createOrder}
      />
    </div>
  );
}
