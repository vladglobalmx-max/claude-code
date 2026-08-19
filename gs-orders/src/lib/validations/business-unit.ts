import { z } from "zod";

/**
 * THÖREN Business Unit Branding (0024_business_unit_branding.sql). Solo
 * name/active — code y organization_id nunca se exponen aquí porque son
 * inmutables (RLS + trigger trg_business_units_prevent_org_code_change).
 */
export const businessUnitDetailsSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120, "El nombre debe tener máximo 120 caracteres"),
  active: z.boolean(),
});

export type BusinessUnitDetailsInput = z.infer<typeof businessUnitDetailsSchema>;

/**
 * Logo de Business Unit: PNG/JPG/JPEG/WebP, máximo 2 MB. SVG excluido a
 * propósito — un SVG puede contener <script>/foreignObject, y una signed
 * URL sigue siendo navegable directamente en el navegador durante su TTL;
 * sin beneficio claro sobre PNG/WebP con fondo transparente para un logo.
 */
export const BUSINESS_UNIT_LOGO_MAX_SIZE_MB = 2;
export const BUSINESS_UNIT_LOGO_ACCEPT = "image/png,image/jpeg,image/webp";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function validateBusinessUnitLogoFile(file: File): { extension: string } | { error: string } {
  const extension = EXTENSION_BY_MIME[file.type];
  if (!extension) {
    return { error: "Formato no permitido. Usa PNG, JPG o WebP." };
  }
  if (file.size > BUSINESS_UNIT_LOGO_MAX_SIZE_MB * 1024 * 1024) {
    return { error: `El archivo no puede pesar más de ${BUSINESS_UNIT_LOGO_MAX_SIZE_MB} MB.` };
  }
  return { extension };
}
