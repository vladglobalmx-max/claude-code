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
              key: item.id + "-image",
              path: item.image_path,
              name: item.image_path.split("/").pop() ?? "imagen",
              type: "image/*",
              size: 0,
              previewUrl: mediaUrls[item.image_path] ?? null,
            }
          : null,
        power: item.power ?? "",
        lensType: item.lens_pending_factory ? "" : item.lens_type ?? "",
        lensPendingFactory: item.lens_pending_factory,
        projectionDescription: item.projection_description ?? "",
        projectionDescriptionEn: item.projection_description_en ?? "",
        projectionFile: item.projection_file_path
          ? {
              key: item.id + "-projection",
              path: item.projection_file_path,
              name: item.projection_file_name ?? "archivo",
              type: item.projection_file_type ?? "",
              size: 0,
              previewUrl: mediaUrls[item.projection_file_path] ?? null,
            }
          : null,
        projectionWidth: item.projection_width != null ? String(item.projection_width) : "",
        projectionHeight: item.projection_height != null ? String(item.projection_height) : "",
        projectionSizeUnit: item.projection_size_unit ?? "m",
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
