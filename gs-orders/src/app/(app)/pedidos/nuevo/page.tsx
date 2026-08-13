import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import { getBusinessToday } from "@/lib/business-date";
import { getCurrentProfile } from "@/lib/auth/profile";
import { OrderForm } from "@/components/orders/order-form";
import { emptyOrderForm, type CatalogProductOption } from "@/components/orders/types";
import { createOrder } from "../actions";
import type { ProductCatalogItem, ProductTypeItem, Salesperson } from "@/types/domain";

export default async function NuevoPedidoPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) redirect("/login");

  const supabase = createSupabaseServerClient();
  // Para VENDEDOR, RLS (0011) ya limita esta consulta a su propia fila sin
  // importar el filtro .eq("active", true) que sigue aquí para el caso
  // ADMIN (lista completa de vendedores activos para elegir).
  const [{ data }, { data: catalogData }, { data: productTypesData }] = await Promise.all([
    supabase.from("salespeople").select("*").eq("active", true).order("name", { ascending: true }),
    supabase
      .from("product_catalog")
      .select("*")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("product_types").select("*").eq("active", true).order("name", { ascending: true }),
  ]);

  const salespeople = (data ?? []) as Salesperson[];
  const productTypes = (productTypesData ?? []) as ProductTypeItem[];
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
  const initialState = emptyOrderForm(today);
  // El vendedor nunca elige a nombre de quién se crea el pedido — se
  // prellena con su propio salesperson_id, y el RPC (0011) lo vuelve a
  // forzar server-side sin importar lo que llegue en el payload.
  if (profile.role === "vendedor" && profile.salespersonId) {
    initialState.salespersonId = profile.salespersonId;
  }

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
        productTypes={productTypes}
        initialState={initialState}
        canChooseSalesperson={profile.role === "admin"}
        onSubmit={createOrder}
      />
    </div>
  );
}
