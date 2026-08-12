"use client";

import { uploadOrderMedia, uploadOrderFile } from "@/app/(app)/pedidos/storage-actions";
import type { MediaDraft } from "./types";

export async function uploadMediaFile(orderId: string, folder: string, file: File): Promise<MediaDraft> {
  const fd = new FormData();
  fd.set("file", file);
  const result = await uploadOrderMedia(orderId, folder, fd);
  return {
    key: crypto.randomUUID(),
    path: result.path,
    name: result.name,
    type: result.type,
    size: result.size,
    previewUrl: URL.createObjectURL(file),
  };
}

export async function uploadAttachmentFile(orderId: string, file: File): Promise<MediaDraft> {
  const fd = new FormData();
  fd.set("file", file);
  const result = await uploadOrderFile(orderId, fd);
  return {
    key: crypto.randomUUID(),
    path: result.path,
    name: result.name,
    type: result.type,
    size: result.size,
    previewUrl: null,
  };
}
