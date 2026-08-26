"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { uploadOrderMedia, uploadOrderFile } from "../../pedidos/storage-actions";
import { attachDeliveryFile } from "../actions";
import type { DeliveryFileKind } from "@/types/domain";

/**
 * THÖREN Fase 6P §5 — sube evidencia (fotos o documento) y la liga a la
 * Entrega. Reutiliza uploadOrderMedia/uploadOrderFile EXISTENTES (bucket
 * order-media/order-files, ver DECISIÓN en 0039_deliveries.sql) — no hay
 * infraestructura de Storage nueva.
 */
export function EvidenceUpload({ deliveryId, orderId, kind }: { deliveryId: string; orderId: string; kind: DeliveryFileKind }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("El archivo no puede pesar más de 20 MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);

      const uploaded =
        kind === "foto"
          ? await uploadOrderMedia(orderId, `entregas/${deliveryId}`, formData)
          : await uploadOrderFile(orderId, formData);

      if ("error" in uploaded) {
        toast.error(uploaded.error);
        return;
      }

      const result = await attachDeliveryFile(deliveryId, orderId, uploaded, kind);
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(kind === "foto" ? "Foto adjuntada" : "Documento adjuntado");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-border px-3 text-sm text-ink-faint transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {uploading ? "Subiendo…" : kind === "foto" ? "Agregar foto" : "Adjuntar documento"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={kind === "foto" ? "image/*" : undefined}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
