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
 * THÖREN Business Units — Crear nuevas (0026_business_unit_creation.sql).
 * `code` espeja la CHECK constraint `business_units_code_format` agregada
 * en esa migración: minúsculas, empieza con letra, solo [a-z0-9_] después,
 * 2-60 caracteres — mismo patrón que los 6 codes reales ya existentes
 * (got_fresh_breath, gtx_systems, juno_promotional, the_fire_spot,
 * thunder_led, thunder_safety). `active` con default true en la UI, nunca
 * inventado aquí — el schema lo exige explícito. `organization_id` NUNCA
 * forma parte de este schema: se resuelve server-side en el Server Action
 * (resolveCurrentOrganizationId), el navegador no lo manda.
 */
export const businessUnitCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120, "El nombre debe tener máximo 120 caracteres"),
  code: z
    .string()
    .trim()
    .min(2, "El código debe tener al menos 2 caracteres")
    .max(60, "El código debe tener máximo 60 caracteres")
    .regex(/^[a-z][a-z0-9_]*$/, "El código debe empezar con una letra y usar solo minúsculas, números y guion bajo"),
  active: z.boolean(),
});

export type BusinessUnitCreateInput = z.infer<typeof businessUnitCreateSchema>;

/**
 * Sugerencia automática de `code` a partir de `name` — solo UX, nunca se
 * envía sin pasar por businessUnitCreateSchema en el servidor. El ADMIN
 * puede corregirlo libremente antes de guardar (el formulario deja de
 * auto-sugerir en cuanto edita el campo code a mano).
 */
export function slugifyBusinessUnitCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

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
