import { z } from "zod";

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/**
 * `code` es el identificador estable e interno (controla comportamiento,
 * p. ej. "proyector_gobo" activa toda la UI especial de Proyector/GOBO —
 * ver productos-section.tsx). Se normaliza a slug minúsculas/guion_bajo
 * para que sea seguro de usar como valor de orders.product_type y como
 * llave de la FK orders_product_type_fkey — nunca se expone editable
 * después de creado (ver product-type-form.tsx).
 */
const cleanCode = (value: unknown) =>
  typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(COMBINING_DIACRITICS, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
    : value;

export const productTypeSchema = z.object({
  code: z.preprocess(
    cleanCode,
    z
      .string()
      .min(2, "El código debe tener al menos 2 caracteres")
      .max(40, "El código debe tener máximo 40 caracteres")
      .regex(/^[a-z0-9_]+$/, "El código solo puede tener letras minúsculas, números y guion bajo")
  ),
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  active: z.boolean().default(true),
});

export type ProductTypeFormValues = z.infer<typeof productTypeSchema>;
