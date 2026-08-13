import type { Order, OrderImage, OrderItem, OrderItemImage, OrderFile } from "@/types/domain";
import type { MediaDraft, OrderFormState } from "./types";

function toMediaDraft(
  keyPrefix: string,
  path: string,
  name: string | null,
  type: string | null,
  mediaUrls: Record<string, string>
): MediaDraft {
  return {
    key: keyPrefix,
    path,
    name: name ?? path.split("/").pop() ?? "imagen",
    type: type ?? "image/*",
    size: 0,
    previewUrl: mediaUrls[path] ?? null,
  };
}

export function buildOrderFormState(
  order: Order,
  items: OrderItem[],
  itemImages: OrderItemImage[],
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
      .map((item) => {
        const ownImages = itemImages
          .filter((img) => img.order_item_id === item.id)
          .sort((a, b) => a.position - b.position);
        const referenceImages = ownImages
          .filter((img) => img.kind === "reference")
          .map((img) => toMediaDraft(img.id, img.storage_path, img.file_name, img.file_type, mediaUrls));
        const projectionImages = ownImages
          .filter((img) => img.kind === "projection")
          .map((img) => toMediaDraft(img.id, img.storage_path, img.file_name, img.file_type, mediaUrls));

        return {
          key: item.id,
          model: item.model,
          description: item.description ?? "",
          quantity: item.quantity,
          notes: item.notes ?? "",
          image: item.image_path ? toMediaDraft(item.id + "-image", item.image_path, null, "image/*", mediaUrls) : null,
          referenceImages,
          catalogProductId: item.catalog_product_id,
          color: item.color ?? "",
          power: item.power ?? "",
          lensType: item.lens_pending_factory ? "" : item.lens_type ?? "",
          lensPendingFactory: item.lens_pending_factory,
          projectionDescription: item.projection_description ?? "",
          projectionDescriptionEn: item.projection_description_en ?? "",
          projectionImages,
          projectionWidth: item.projection_width != null ? String(item.projection_width) : "",
          projectionHeight: item.projection_height != null ? String(item.projection_height) : "",
          projectionSizeUnit: item.projection_size_unit ?? "m",
          installationHeight: item.installation_height != null ? String(item.installation_height) : "",
          installationHeightUnit: item.installation_height_unit ?? "m",
          installationDistance: item.installation_distance != null ? String(item.installation_distance) : "",
          orientation: item.installation_orientation ?? "",
          use: item.installation_use ?? "",
          surfaceType: item.surface_type ?? "",
          surfaceMaterial: item.surface_material ?? "",
          surfaceNotes: item.surface_notes ?? "",
          surfaceNotesEn: item.surface_notes_en ?? "",
        };
      }),
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
  };
}
