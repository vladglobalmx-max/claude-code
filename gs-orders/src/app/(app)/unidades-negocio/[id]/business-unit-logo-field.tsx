"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { SingleImageField } from "@/components/orders/single-image-field";
import type { MediaDraft } from "@/components/orders/types";
import { BUSINESS_UNIT_LOGO_ACCEPT, BUSINESS_UNIT_LOGO_MAX_SIZE_MB } from "@/lib/validations/business-unit";
import { removeBusinessUnitLogo, uploadBusinessUnitLogo } from "./actions";

/**
 * Sección "Identidad visual" (THÖREN Business Unit Branding, 0024).
 * Controles solo se montan si canEdit (VENDEDOR nunca ve el botón de
 * subir/quitar — pero aunque llamara la Server Action a mano, RLS la
 * rechaza igual: la protección real vive en business_units_update_admin +
 * las policies de storage.objects, no en ocultar este componente).
 */
export function BusinessUnitLogoField({
  businessUnitId,
  initialLogoPath,
  initialSignedUrl,
  canEdit,
}: {
  businessUnitId: string;
  initialLogoPath: string | null;
  initialSignedUrl: string | null;
  canEdit: boolean;
}) {
  const [logo, setLogo] = useState<MediaDraft | null>(
    initialLogoPath && initialSignedUrl
      ? {
          key: initialLogoPath,
          path: initialLogoPath,
          name: initialLogoPath.split("/").pop() ?? "logo",
          type: "image/*",
          size: 0,
          previewUrl: initialSignedUrl,
        }
      : null
  );

  async function handleUpload(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadBusinessUnitLogo(businessUnitId, fd);
    if (result?.error) throw new Error(result.error);
    setLogo({
      key: crypto.randomUUID(),
      path: `${businessUnitId}/logo`,
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    });
  }

  function handleRemove() {
    const previous = logo;
    setLogo(null);
    removeBusinessUnitLogo(businessUnitId).then((result) => {
      if (result?.error) {
        toast.error(result.error);
        setLogo(previous);
      }
    });
  }

  return (
    <div>
      <Label>Logo</Label>
      {!canEdit ? (
        logo ? (
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.previewUrl ?? undefined} alt="Logo" className="h-full w-full object-cover" />
          </div>
        ) : (
          <p className="text-sm text-ink-faint">Sin logo.</p>
        )
      ) : (
        <>
          <SingleImageField
            value={logo}
            onUpload={handleUpload}
            onRemove={handleRemove}
            accept={BUSINESS_UNIT_LOGO_ACCEPT}
            label="Subir logo"
            maxSizeMB={BUSINESS_UNIT_LOGO_MAX_SIZE_MB}
          />
          <p className="mt-2 text-xs text-ink-faint">
            PNG, JPG o WebP. Máximo {BUSINESS_UNIT_LOGO_MAX_SIZE_MB} MB. Se recomienda fondo transparente.
          </p>
        </>
      )}
    </div>
  );
}
