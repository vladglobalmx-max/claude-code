import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CatalogForm } from "../catalog-form";
import { createCatalogProduct } from "../actions";

export default async function NuevoCatalogoPage({
  searchParams,
}: {
  searchParams: { bu?: string; tipo?: string };
}) {
  const supabase = createSupabaseServerClient();
  const [{ data: buData }, { data: ptData }] = await Promise.all([
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
    supabase.from("product_types").select("id, name").eq("active", true).order("name"),
  ]);
  const businessUnits = (buData ?? []) as { id: string; name: string }[];
  const productTypes = (ptData ?? []) as { id: string; name: string }[];

  // THÖREN — Catálogo UX (Organization → BU → Product Type → Products):
  // entrar desde el Catálogo con un filtro de BU/Tipo ya aplicado
  // preselecciona ese contexto — el admin no vuelve a elegirlo salvo que
  // decida cambiarlo (el campo sigue editable, sin bloquear nada). Se
  // valida contra las listas reales antes de preseleccionar: un id de
  // querystring manipulado/obsoleto (BU o Tipo inactivo/eliminado) nunca
  // se preselecciona en silencio.
  const preselectedBusinessUnitId = businessUnits.some((bu) => bu.id === searchParams.bu) ? searchParams.bu! : null;
  const preselectedProductTypeId = productTypes.some((t) => t.id === searchParams.tipo) ? searchParams.tipo! : "";

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
          productTypeId: preselectedProductTypeId,
          brand: "",
          model: "",
          unit: "",
          power: "",
          color: "",
          lensType: "",
          technicalNotes: "",
          currency: "MXN",
          basePrice: "",
          businessUnitIds: preselectedBusinessUnitId ? [preselectedBusinessUnitId] : [],
          active: true,
          image: null,
        }}
        submitLabel="Crear producto"
        onSubmit={createCatalogProduct}
      />
    </div>
  );
}
