import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CatalogForm } from "../catalog-form";
import { createCatalogProduct } from "../actions";

export default async function NuevoCatalogoPage() {
  const supabase = createSupabaseServerClient();
  const [{ data }, { data: buData }] = await Promise.all([
    supabase.from("product_catalog").select("category"),
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
  ]);
  const categories = Array.from(new Set(((data ?? []) as { category: string }[]).map((r) => r.category))).sort();
  const businessUnits = (buData ?? []) as { id: string; name: string }[];

  const productId = randomUUID();

  return (
    <div>
      <div className="mx-auto max-w-2xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nuevo producto de catálogo</h1>
      </div>
      <CatalogForm
        productId={productId}
        categories={categories}
        businessUnits={businessUnits}
        initialState={{
          category: "",
          sku: "",
          name: "",
          description: "",
          power: "",
          color: "",
          lensType: "",
          technicalNotes: "",
          defaultPriceMxn: "",
          defaultPriceUsd: "",
          businessUnitIds: [],
          active: true,
          image: null,
        }}
        submitLabel="Crear producto"
        onSubmit={createCatalogProduct}
      />
    </div>
  );
}
