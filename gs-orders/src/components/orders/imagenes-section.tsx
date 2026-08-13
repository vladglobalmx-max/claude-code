"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiFileField } from "./multi-file-field";
import { uploadMediaFile, uploadAttachmentFile } from "./media-client";
import type { MediaDraft } from "./types";

export function ImagenesSection({
  orderId,
  images,
  files,
  onImagesChange,
  onFilesChange,
}: {
  orderId: string;
  images: MediaDraft[];
  files: MediaDraft[];
  onImagesChange: (images: MediaDraft[]) => void;
  onFilesChange: (files: MediaDraft[]) => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Fotografías del área</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-ink-faint">
            Área general, techo, piso, estructura, punto de instalación, medidas, obstáculos…
          </p>
          <MultiFileField
            items={images}
            variant="photo"
            accept="image/jpeg,image/png,image/jpg"
            onAdd={async (file) => {
              const media = await uploadMediaFile(orderId, "fotos", file);
              onImagesChange([...images, media]);
            }}
            onRemove={(key) => onImagesChange(images.filter((img) => img.key !== key))}
            onCaptionChange={(key, caption) =>
              onImagesChange(images.map((img) => (img.key === key ? { ...img, caption } : img)))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Archivos adjuntos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-ink-faint">
            Cotización, ficha técnica, arte, documento del cliente, etc.
          </p>
          <MultiFileField
            items={files}
            variant="file"
            onAdd={async (file) => {
              const media = await uploadAttachmentFile(orderId, file);
              onFilesChange([...files, media]);
            }}
            onRemove={(key) => onFilesChange(files.filter((f) => f.key !== key))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
