import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import { getCurrentProfile } from "@/lib/auth/profile";
import { OrderForm } from "@/components/orders/order-form";
import { buildOrderFormState } from "@/components/orders/from-db";
import type { CatalogProductOption } from "@/components/orders/types";
import { updateOrder } from "../../actions";
import type {
  Order,
  OrderImage,
  OrderItem,
  OrderItemImage,
  OrderFile,
  ProductCatalogItem,
  ProductTypeItem,
  Salesperson,
} from "@/types/domain";

export default async function EditarPedidoPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) redirect("/login");

  const supabase = createSupabaseServerClient();

  const [
    { data: order },
    { data: items },
    { data: images },
    { data: files },
    { data: salespeopleData },
    { data: productTypesData },
    { data: businessUnitsData },
  ] = await Promise.all([
    supabase.from("orders").select("*").eq("id", params.id).single(),
    supabase.from("order_items").select("*").eq("order_id", params.id),
    supabase.from("order_images").select("*").eq("order_id", params.id),
    supabase.from("order_files").select("*").eq("order_id", params.id),
    supabase.from("salespeople").select("*").order("name", { ascending: true }),
    // Sin filtro de activo: si el tipo de este pedido ya fue desactivado
    // desde Configuración, debe seguir apareciendo seleccionado aquí (mismo
    // criterio que ya se usa para salespeople en esta misma página).
    supabase.from("product_types").select("*").order("name", { ascending: true }),
    supabase.from("business_units").select("id, name").eq("active", true).order("name", { ascending: true }),
  ]);

  if (!order) notFound();

  const typedOrder = order as Order;
  const typedItems = (items ?? []) as OrderItem[];
  const typedImages = (images ?? []) as OrderImage[];
  const typedFiles = (files ?? []) as OrderFile[];
  const salespeople = (salespeopleData ?? []) as Salesperson[];
  const productTypes = (productTypesData ?? []) as ProductTypeItem[];
  const businessUnits = (businessUnitsData ?? []) as { id: string; name: string }[];

  // Fase 6F §6 — DECISIÓN "producto histórico inactivo": este Order puede
  // ya tener asociado un catalog_product_id que fue desactivado después.
  // El picker de selección NUEVA solo debe ofrecer catálogo activo, pero la
  // línea ya existente debe seguir mostrándose (miniatura, SKU, nombre)
  // correctamente y un resave no debe romperse — por eso la lista de
  // catálogo que llega al form es la UNIÓN de "todo lo activo" + "lo que
  // este Order ya referencia, esté activo o no" (nunca al revés: nunca se
  // ofrece un inactivo para una selección nueva).
  const referencedCatalogProductIds = Array.from(
    new Set(typedItems.map((i) => i.catalog_product_id).filter((id): id is string => !!id))
  );

  type CatalogRow = ProductCatalogItem & { product_types: { name: string } | null };
  const [{ data: catalogActiveData }, { data: catalogReferencedData }, { data: catalogBuData }] = await Promise.all([
    supabase
      .from("product_catalog")
      .select("*, product_types(name)")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    referencedCatalogProductIds.length > 0
      ? supabase.from("product_catalog").select("*, product_types(name)").in("id", referencedCatalogProductIds)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.from("product_business_units").select("product_id, business_unit_id"),
  ]);

  const catalogRowsById = new Map<string, CatalogRow>();
  for (const row of (catalogActiveData ?? []) as unknown as CatalogRow[]) catalogRowsById.set(row.id, row);
  for (const row of (catalogReferencedData ?? []) as unknown as CatalogRow[]) {
    if (!catalogRowsById.has(row.id)) catalogRowsById.set(row.id, row);
  }
  const catalogRows = Array.from(catalogRowsById.values());

  const businessUnitNamesById = new Map(businessUnits.map((bu) => [bu.id, bu.name]));
  const businessUnitIdsByProduct = new Map<string, string[]>();
  for (const row of (catalogBuData ?? []) as { product_id: string; business_unit_id: string }[]) {
    const list = businessUnitIdsByProduct.get(row.product_id) ?? [];
    list.push(row.business_unit_id);
    businessUnitIdsByProduct.set(row.product_id, list);
  }

  const itemIds = typedItems.map((i) => i.id);
  const { data: itemImages } =
    itemIds.length > 0
      ? await supabase.from("order_item_images").select("*").in("order_item_id", itemIds).order("position")
      : { data: [] as OrderItemImage[] };
  const typedItemImages = (itemImages ?? []) as OrderItemImage[];

  const mediaPaths = [
    ...typedItems.map((i) => i.image_path).filter((p): p is string => !!p),
    ...typedItems.map((i) => i.projection_file_path).filter((p): p is string => !!p),
    ...typedItemImages.map((i) => i.storage_path),
    ...typedImages.map((i) => i.storage_path),
    ...(typedOrder.projection_file_path ? [typedOrder.projection_file_path] : []),
  ];
  const filePaths = typedFiles.map((f) => f.storage_path);

  const catalogImagePaths = catalogRows.map((p) => p.image_path).filter((p): p is string => !!p);

  const [mediaUrls, fileUrls, catalogImageUrls] = await Promise.all([
    getSignedUrls("order-media", mediaPaths),
    getSignedUrls("order-files", filePaths),
    getSignedUrls("order-media", catalogImagePaths),
  ]);

  const catalogProducts: CatalogProductOption[] = catalogRows.map((p) => {
    const businessUnitIds = businessUnitIdsByProduct.get(p.id) ?? [];
    return {
      id: p.id,
      category: p.category ?? "",
      sku: p.sku,
      name: p.name,
      description: p.description,
      model: p.model,
      brand: p.brand,
      unit: p.unit,
      productTypeName: p.product_types?.name ?? null,
      power: p.power,
      color: p.color,
      technicalNotes: p.technical_notes,
      active: p.active,
      businessUnitIds,
      businessUnitNames: businessUnitIds.map((id) => businessUnitNamesById.get(id) ?? "—"),
      imagePath: p.image_path,
      imagePreviewUrl: p.image_path ? catalogImageUrls[p.image_path] ?? null : null,
    };
  });

  const initialState = buildOrderFormState(
    typedOrder,
    typedItems,
    typedItemImages,
    typedImages,
    typedFiles,
    mediaUrls,
    fileUrls
  );

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Editar pedido</h1>
        <p className="mt-0.5 text-sm text-ink-faint">
          El folio, el vendedor y la fecha ya son definitivos y no se pueden modificar.
        </p>
      </div>
      <OrderForm
        orderId={typedOrder.id}
        salespeople={salespeople}
        businessUnits={businessUnits}
        catalogProducts={catalogProducts}
        productTypes={productTypes}
        initialState={initialState}
        folio={typedOrder.folio}
        canChooseSalesperson={profile.role === "admin"}
        submitLabel={{ draft: "Guardar cambios", order: "Guardar y marcar como Pedido" }}
        onSubmit={updateOrder}
      />
    </div>
  );
}
