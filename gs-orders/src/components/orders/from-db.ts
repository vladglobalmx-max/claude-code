import type { Order, OrderImage, OrderItem, OrderFile } from "@/types/domain";
import type { OrderFormState } from "./types";

export function buildOrderFormState(
  order: Order,
  items: OrderItem[],
  images: OrderImage[],
  files: OrderFile[],
  mediaUrls: Record<string, string>,
  fileUrls: Record<string, string>
): OrderFormState {
  return {
    orderDate: order.order_date,
    salespersonId: order.salesperson_id,
    clientName: order.client_name,
    supplierName: order.supplier_name ?? "",
    productType: order.product_type,
    status: order.status,
    generalNotes: order.general_notes ?? "",
    vendorNotes: order.vendor_notes ?? "",
    vendorNotesEn: order.vendor_notes_en ?? "",
    items: items
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        key: item.id,
        model: item.model,
        description: item.description ?? "",
        quantity: item.quantity,
        notes: item.notes ?? "",
        image: item.image_path
          ? {
              key: item.id,
              path: item.image_path,
              name: item.image_path.split("/").pop() ?? "imagen",
              type: "image/*",
              size: 0,
              previewUrl: mediaUrls[item.image_path] ?? null,
            }
          : null,
      })),
    images: images
      .sort((a, b) => a.position - b.position)
      .map((img) => ({
        key: img.id,
        path: img.storage_path,
        name: img.storage_path.split("/").pop() ?? "foto",
        type: "image/*",
        size: 0,
        previewUrl: mediaUrls[img.storage_path] ?? null,
        caption: img.caption ?? "",
      })),
    files: files.map((f) => ({
      key: f.id,
      path: f.storage_path,
      name: f.file_name,
      type: f.file_type ?? "",
      size: f.file_size ?? 0,
      previewUrl: fileUrls[f.storage_path] ?? null,
    })),
    projector: {
      model: order.projector_model ?? "",
      quantity: order.projector_quantity != null ? String(order.projector_quantity) : "",
      power: order.projector_power ?? "",
      lensType: order.projector_lens_pending_factory ? "" : order.projector_lens_type ?? "",
      lensPendingFactory: order.projector_lens_pending_factory,
      description: order.projection_description ?? "",
      descriptionEn: order.projection_description_en ?? "",
      file: order.projection_file_path
        ? {
            key: order.id + "-projection",
            path: order.projection_file_path,
            name: order.projection_file_name ?? "archivo",
            type: order.projection_file_type ?? "",
            size: 0,
            previewUrl: mediaUrls[order.projection_file_path] ?? null,
          }
        : null,
      width: order.projection_width != null ? String(order.projection_width) : "",
      height: order.projection_height != null ? String(order.projection_height) : "",
      sizeUnit: order.projection_size_unit ?? "m",
      installationHeight: order.installation_height != null ? String(order.installation_height) : "",
      installationHeightUnit: order.installation_height_unit ?? "m",
      installationDistance: order.installation_distance != null ? String(order.installation_distance) : "",
      orientation: order.installation_orientation ?? "",
      use: order.installation_use ?? "",
      surfaceType: order.surface_type ?? "",
      surfaceMaterial: order.surface_material ?? "",
      surfaceNotes: order.surface_notes ?? "",
      surfaceNotesEn: order.surface_notes_en ?? "",
    },
  };
}
