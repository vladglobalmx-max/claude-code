import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductTypeForm } from "../../product-type-form";
import { updateProductType } from "../../actions";
import type { ProductTypeItem } from "@/types/domain";

export default async function EditarTipoProductoPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("product_types").select("*").eq("id", params.id).single();

  if (!data) notFound();

  const productType = data as ProductTypeItem;
  const action = updateProductType.bind(null, productType.id);

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold text-ink">Editar tipo de producto</h1>
      <Card>
        <CardHeader>
          <CardTitle>{productType.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductTypeForm action={action} productType={productType} submitLabel="Guardar cambios" />
        </CardContent>
      </Card>
    </div>
  );
}
