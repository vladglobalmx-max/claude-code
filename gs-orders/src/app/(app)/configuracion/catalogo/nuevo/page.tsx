import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CatalogForm } from "../catalog-form";
import { createCatalogProduct } from "../actions";

export default async function NuevoCatalogoPage() {
  const supabase = createSupabaseServerClient();
  const [{ data: buData }, { data: ptData }] = await Promise.all([
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
    supabase.from("product_types").select("id, name").eq("active", true).order("name"),
  ]);
  const businessUnits = (buData ?? []) as { id: string; name: string }[];
  const productTypes = (ptData ?? []) as { id: string; name: string }[];

  const productId = randomUUID();

  return (
    <div>
      <div className="mx-auto max-w-2xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nuevo producto de catálogo</h1>
      </div>
      <CatalogForm
        productId={productId}
        businessUnits={businessUnits}
        productTypes={productTypes}
        initialState={{
          sku: "",
          name: "",
          description: "",
          productTypeId: "",
          brand: "",
          model: "",
          unit: "",
          power: "",
          color: "",
          lensType: "",
          technicalNotes: "",
          currency: "MXN",
          basePrice: "",
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
