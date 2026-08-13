import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { CatalogForm } from "../../catalog-form";
import { updateCatalogProduct } from "../../actions";
import type { ProductCatalogItem } from "@/types/domain";

export default async function EditarCatalogoPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const [{ data: product }, { data: categoryRows }] = await Promise.all([
    supabase.from("product_catalog").select("*").eq("id", params.id).single(),
    supabase.from("product_catalog").select("category"),
  ]);

  if (!product) notFound();
  const typedProduct = product as ProductCatalogItem;
  const categories = Array.from(
    new Set(((categoryRows ?? []) as { category: string }[]).map((r) => r.category))
  ).sort();

  const imageUrl = typedProduct.image_path ? await getSignedUrl("order-media", typedProduct.image_path) : null;

  return (
    <div>
      <div className="mx-auto max-w-2xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Editar producto de catálogo</h1>
      </div>
      <CatalogForm
        productId={typedProduct.id}
        categories={categories}
        initialState={{
          category: typedProduct.category,
          sku: typedProduct.sku,
          name: typedProduct.name,
          description: typedProduct.description ?? "",
          power: typedProduct.power ?? "",
          color: typedProduct.color ?? "",
          lensType: typedProduct.lens_type ?? "",
          technicalNotes: typedProduct.technical_notes ?? "",
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
