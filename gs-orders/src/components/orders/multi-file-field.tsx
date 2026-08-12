"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/utils/format";
import type { MediaDraft } from "./types";

export function MultiFileField({
  items,
  variant,
  accept,
  onAdd,
  onRemove,
  onCaptionChange,
}: {
  items: MediaDraft[];
  variant: "photo" | "file";
  accept?: string;
  onAdd: (file: File) => Promise<void>;
  onRemove: (key: string) => void;
  onCaptionChange?: (key: string, caption: string) => void;
}) {
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
      await onAdd(file);
    } catch (err) {
      console.error("Error al subir archivo", err);
      toast.error(err instanceof Error && err.message ? err.message : "No se pudo subir el archivo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {variant === "photo" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <div key={item.key} className="group relative overflow-hidden rounded-lg border border-border">
              <div className="aspect-square bg-surface-2">
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <FileText className="h-6 w-6 text-ink-faint" />
                  </div>
                )}
              </div>
              {onCaptionChange && (
                <Input
                  value={item.caption ?? ""}
                  onChange={(e) => onCaptionChange(item.key, e.target.value)}
                  placeholder="Vista general, punto de instalación…"
                  className="h-7 rounded-none border-0 border-t border-border text-xs"
                />
              )}
              <button
                type="button"
                onClick={() => onRemove(item.key)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Eliminar foto"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-ink-faint transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            <span className="text-xs">{uploading ? "Subiendo…" : "Agregar foto"}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{item.name}</p>
                <p className="text-xs text-ink-faint">{formatBytes(item.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.key)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-danger/10 hover:text-danger"
                aria-label="Eliminar archivo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-ink-faint transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {uploading ? "Subiendo…" : "Adjuntar archivo"}
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
    </div>
  );
}
