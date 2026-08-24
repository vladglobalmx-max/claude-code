import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { CatalogForm } from "../../catalog-form";
import { updateCatalogProduct } from "../../actions";
import type { ProductCatalogItem } from "@/types/domain";

export default async function EditarCatalogoPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const [{ data: product }, { data: buData }, { data: ptData }, { data: productBuRows }] = await Promise.all([
    supabase.from("product_catalog").select("*").eq("id", params.id).single(),
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
    supabase.from("product_types").select("id, name").eq("active", true).order("name"),
    supabase.from("product_business_units").select("business_unit_id").eq("product_id", params.id),
  ]);

  if (!product) notFound();
  const typedProduct = product as ProductCatalogItem;
  const businessUnits = (buData ?? []) as { id: string; name: string }[];
  const productTypes = (ptData ?? []) as { id: string; name: string }[];
  const businessUnitIds = ((productBuRows ?? []) as { business_unit_id: string }[]).map((r) => r.business_unit_id);

  const imageUrl = typedProduct.image_path ? await getSignedUrl("order-media", typedProduct.image_path) : null;

  // Un producto legado puede tener default_price_mxn Y default_price_usd
  // a la vez (0019 lo permitía) — el formulario nuevo solo captura UNA
  // moneda a la vez, así que prioriza USD si ambas están presentes (moneda
  // más común para el catálogo maestro futuro), sin borrar la otra hasta
  // que el usuario guarde explícitamente.
  const currency: "MXN" | "USD" = typedProduct.default_price_usd != null ? "USD" : "MXN";
  const basePrice =
    currency === "USD"
      ? (typedProduct.default_price_usd ?? typedProduct.default_price_mxn)
      : (typedProduct.default_price_mxn ?? typedProduct.default_price_usd);

  return (
    <div>
      <div className="mx-auto max-w-2xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Editar producto de catálogo</h1>
      </div>
      <CatalogForm
        productId={typedProduct.id}
        businessUnits={businessUnits}
        productTypes={productTypes}
        initialState={{
          sku: typedProduct.sku,
          name: typedProduct.name,
          description: typedProduct.description ?? "",
          productTypeId: typedProduct.product_type_id ?? "",
          brand: typedProduct.brand ?? "",
          model: typedProduct.model ?? "",
          unit: typedProduct.unit ?? "",
          power: typedProduct.power ?? "",
          color: typedProduct.color ?? "",
          lensType: typedProduct.lens_type ?? "",
          technicalNotes: typedProduct.technical_notes ?? "",
          currency,
          basePrice: basePrice != null ? String(basePrice) : "",
          businessUnitIds,
          active: typedProduct.active,
          image: typedProduct.image_path
            ? {
                key: typedProduct.id + "-image",
                path: typedProduct.image_path,
                name: typedProduct.image_path.split("/").pop() ?? "imagen",
                type: "image/*",
                size: 0,
                previewUrl: imageUrl,
              }
            : null,
        }}
        submitLabel="Guardar cambios"
        onSubmit={updateCatalogProduct}
      />
    </div>
  );
}
