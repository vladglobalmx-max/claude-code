"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { MediaDraft } from "./types";

export function SingleImageField({
  value,
  onUpload,
  onRemove,
  accept = "image/jpeg,image/png,image/jpg",
  label = "Subir imagen",
  maxSizeMB = 15,
}: {
  value: MediaDraft | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
  accept?: string;
  label?: string;
  /** Tamaño máximo en MB. Default 15 (fotos de producto/pedido) — pásalo explícito para casos más chicos, ej. logos. */
  maxSizeMB?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`El archivo no puede pesar más de ${maxSizeMB} MB`);
      return;
    }
    setUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      console.error("Error al subir archivo", err);
      toast.error(err instanceof Error && err.message ? err.message : "No se pudo subir el archivo");
    } finally {
      setUploading(false);
    }
  }

  if (value) {
    const isImage = value.type.startsWith("image/");
    return (
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2">
          {isImage && value.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.previewUrl} alt={value.name} className="h-full w-full object-cover" />
          ) : (
            <span className="px-1 text-center text-[10px] uppercase text-ink-faint">
              {value.name.split(".").pop()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink">{value.name}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-danger/10 hover:text-danger"
          aria-label="Quitar archivo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex h-20 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-2/50 text-sm text-ink-faint transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {uploading ? "Subiendo…" : label}
      </button>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
    </div>
  );
}
