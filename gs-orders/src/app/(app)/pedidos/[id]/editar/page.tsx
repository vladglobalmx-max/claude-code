import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import { OrderForm } from "@/components/orders/order-form";
import { buildOrderFormState } from "@/components/orders/from-db";
import { updateOrder } from "../../actions";
import type { Order, OrderImage, OrderItem, OrderFile, Salesperson } from "@/types/domain";

export default async function EditarPedidoPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const [{ data: order }, { data: items }, { data: images }, { data: files }, { data: salespeopleData }] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", params.id).single(),
      supabase.from("order_items").select("*").eq("order_id", params.id),
      supabase.from("order_images").select("*").eq("order_id", params.id),
      supabase.from("order_files").select("*").eq("order_id", params.id),
      supabase.from("salespeople").select("*").order("name", { ascending: true }),
    ]);

  if (!order) notFound();

  const typedOrder = order as Order;
  const typedItems = (items ?? []) as OrderItem[];
  const typedImages = (images ?? []) as OrderImage[];
  const typedFiles = (files ?? []) as OrderFile[];
  const salespeople = (salespeopleData ?? []) as Salesperson[];

  const mediaPaths = [
    ...typedItems.map((i) => i.image_path).filter((p): p is string => !!p),
    ...typedItems.map((i) => i.projection_file_path).filter((p): p is string => !!p),
    ...typedImages.map((i) => i.storage_path),
    ...(typedOrder.projection_file_path ? [typedOrder.projection_file_path] : []),
  ];
  const filePaths = typedFiles.map((f) => f.storage_path);

  const [mediaUrls, fileUrls] = await Promise.all([
    getSignedUrls("order-media", mediaPaths),
    getSignedUrls("order-files", filePaths),
  ]);

  const initialState = buildOrderFormState(typedOrder, typedItems, typedImages, typedFiles, mediaUrls, fileUrls);

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
        initialState={initialState}
        folio={typedOrder.folio}
        submitLabel={{ draft: "Guardar cambios", order: "Guardar y marcar como Pedido" }}
        onSubmit={updateOrder}
      />
    </div>
  );
}
