import "server-only";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import type { Order, OrderFile, OrderImage, OrderItem, Salesperson } from "@/types/domain";

export interface OrderDetail {
  order: Order;
  salesperson: Salesperson;
  items: OrderItem[];
  images: OrderImage[];
  files: OrderFile[];
  mediaUrls: Record<string, string>;
  fileUrls: Record<string, string>;
}

export async function getOrderDetail(id: string): Promise<OrderDetail> {
  const supabase = createSupabaseServerClient();

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order) notFound();

  const [{ data: salesperson }, { data: items }, { data: images }, { data: files }] = await Promise.all([
    supabase.from("salespeople").select("*").eq("id", order.salesperson_id).single(),
    supabase.from("order_items").select("*").eq("order_id", id).order("position"),
    supabase.from("order_images").select("*").eq("order_id", id).order("position"),
    supabase.from("order_files").select("*").eq("order_id", id),
  ]);

  const typedOrder = order as Order;
  const typedItems = (items ?? []) as OrderItem[];
  const typedImages = (images ?? []) as OrderImage[];
  const typedFiles = (files ?? []) as OrderFile[];

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

  return {
    order: typedOrder,
    salesperson: (salesperson ?? {
      id: typedOrder.salesperson_id,
      business_unit: "thunder",
      name: "—",
      prefix: "—",
      sequence_current: 0,
      active: false,
      created_at: "",
      updated_at: "",
    }) as Salesperson,
    items: typedItems,
    images: typedImages,
    files: typedFiles,
    mediaUrls,
    fileUrls,
  };
}
