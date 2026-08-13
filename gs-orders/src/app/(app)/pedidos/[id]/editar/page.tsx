import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
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
  const supabase = createSupabaseServerClient();

  const [
    { data: order },
    { data: items },
    { data: images },
    { data: files },
    { data: salespeopleData },
    { data: catalogData },
    { data: productTypesData },
  ] = await Promise.all([
    supabase.from("orders").select("*").eq("id", params.id).single(),
    supabase.from("order_items").select("*").eq("order_id", params.id),
    supabase.from("order_images").select("*").eq("order_id", params.id),
    supabase.from("order_files").select("*").eq("order_id", params.id),
    supabase.from("salespeople").select("*").order("name", { ascending: true }),
    supabase
      .from("product_catalog")
      .select("*")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    // Sin filtro de activo: si el tipo de este pedido ya fue desactivado
    // desde Configuración, debe seguir apareciendo seleccionado aquí (mismo
    // criterio que ya se usa para salespeople en esta misma página).
    supabase.from("product_types").select("*").order("name", { ascending: true }),
  ]);

  if (!order) notFound();

  const typedOrder = order as Order;
  const typedItems = (items ?? []) as OrderItem[];
  const typedImages = (images ?? []) as OrderImage[];
  const typedFiles = (files ?? []) as OrderFile[];
  const salespeople = (salespeopleData ?? []) as Salesperson[];
  const catalogRows = (catalogData ?? []) as ProductCatalogItem[];
  const productTypes = (productTypesData ?? []) as ProductTypeItem[];

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
        catalogProducts={catalogProducts}
        productTypes={productTypes}
        initialState={initialState}
        folio={typedOrder.folio}
        submitLabel={{ draft: "Guardar cambios", order: "Guardar y marcar como Pedido" }}
        onSubmit={updateOrder}
      />
    </div>
  );
}
