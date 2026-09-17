"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { resolveCurrentOrganizationId } from "@/lib/user-access";
import { CATALOG_PAGE_SIZE } from "@/lib/products/catalog-pagination";
import { catalogProductSchema, type CatalogProductPayload } from "@/lib/validations/catalog";
import {
  supplierProductReferencesPayloadSchema,
  type SupplierProductReferenceRow,
} from "@/lib/validations/supplier-product-reference";
import { mapDbError } from "@/lib/db-errors";
import type { Database } from "@/types/database.types";

export type CatalogActionResult = { error: string } | void;

/**
 * `category` (0009, texto libre) deliberadamente NO se incluye aquí desde
 * Fase 6C — el formulario ya no la captura (product_type_id es el eje de
 * clasificación nuevo, ver 0030_product_catalog_master.sql). Al omitir la
 * clave, un UPDATE de Supabase no la toca: un producto legado conserva su
 * category intacta; un producto nuevo simplemente la deja NULL (columna ya
 * nullable), nunca se inventa un valor.
 */
function buildRow(payload: CatalogProductPayload, organizationId: string) {
  return {
    sku: payload.sku,
    name: payload.name,
    description: payload.description || null,
    image_path: payload.image_path || null,
    product_type_id: payload.product_type_id,
    brand: payload.brand || null,
    model: payload.model || null,
    unit: payload.unit || null,
    power: payload.power || null,
    color: payload.color || null,
    lens_type: payload.lens_type || null,
    technical_notes: payload.technical_notes || null,
    organization_id: organizationId,
    default_price_mxn: payload.default_price_mxn ?? null,
    default_price_usd: payload.default_price_usd ?? null,
    active: payload.active,
  };
}

/**
 * Reemplaza por completo las Business Units asociadas a un producto
 * (borra todas las filas existentes y crea las nuevas). `businessUnitIds`
 * vacío es un estado válido: 0 filas = producto compartido con todas las
 * Business Units de su organización (ver 0019_core_product_catalog_pricing.sql).
 */
async function syncBusinessUnits(
  supabase: SupabaseClient<Database>,
  productId: string,
  businessUnitIds: string[]
) {
  const { error: deleteError } = await supabase.from("product_business_units").delete().eq("product_id", productId);
  if (deleteError) return deleteError;

  if (businessUnitIds.length === 0) return null;

  const { error: insertError } = await supabase
    .from("product_business_units")
    .insert(businessUnitIds.map((business_unit_id) => ({ product_id: productId, business_unit_id })));
  return insertError;
}

/**
 * Crea un producto del catálogo. `id` lo genera la página (randomUUID, igual
 * que orderId en pedidos) porque el formulario necesita el id antes de
 * guardar para poder subir la imagen principal a Storage.
 */
export async function createCatalogProduct(id: string, payload: CatalogProductPayload): Promise<CatalogActionResult> {
  const parsed = catalogProductSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return { error: orgResult.error };

  const { error } = await supabase
    .from("product_catalog")
    .insert({ id, ...buildRow(parsed.data, orgResult.organizationId) });

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un producto con el SKU "${parsed.data.sku}"` };
    }
    return { error: mapDbError(error, "No se pudo crear el producto. Intenta de nuevo.") };
  }

  const buError = await syncBusinessUnits(supabase, id, parsed.data.business_unit_ids);
  if (buError) {
    return {
      error: mapDbError(
        buError,
        "El producto se creó, pero no se pudieron guardar sus Business Units. Edítalo para intentar de nuevo."
      ),
    };
  }

  revalidatePath("/configuracion/catalogo");
  redirect("/configuracion/catalogo");
}

export type BulkAssignProductTypeResult = { error: string | null; updatedCount: number };

/**
 * THÖREN — Catálogo UX (Organization → BU → Product Type → Products),
 * "Productos sin clasificar". Asigna un Tipo de Producto a varios
 * productos históricos con product_type_id NULL de una sola vez —
 * ACTUALIZA las filas existentes, nunca las recrea (mismo id, mismo SKU,
 * mismo modelo/nombre — solo cambia product_type_id, ver DECISIÓN "no
 * clasificación automática por SKU/nombre").
 *
 * Cross-org: `product_catalog_admin_write` (0011) solo exige
 * `current_user_is_admin()`, sin acotar por organization_id de la fila —
 * un ADMIN de otra organización nunca debería llegar aquí (RLS de
 * SELECT/UI ya lo evita), pero esta acción NUNCA confía únicamente en esa
 * policy para una operación masiva: valida explícitamente que el Tipo de
 * Producto elegido y CADA producto de `productIds` pertenezcan a la
 * organización del usuario actual (`.eq("organization_id", ...)` en el
 * UPDATE) — defensa en profundidad, no un parche a la policy existente
 * (fuera de alcance de este ticket).
 *
 * `.is("product_type_id", null)` en el WHERE: nunca pisa una
 * clasificación que alguien más ya hizo en paralelo — un producto que
 * dejó de estar sin clasificar entre que se listó y que se envió el
 * bulk-assign simplemente no se toca (se refleja en `updatedCount` <
 * `productIds.length`).
 */
export async function bulkAssignProductType(
  productIds: string[],
  productTypeId: string
): Promise<BulkAssignProductTypeResult> {
  if (productIds.length === 0) {
    return { error: "Selecciona al menos un producto.", updatedCount: 0 };
  }
  if (!productTypeId) {
    return { error: "Selecciona un Tipo de Producto.", updatedCount: 0 };
  }

  const supabase = createSupabaseServerClient();
  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return { error: orgResult.error, updatedCount: 0 };

  const { data: type } = await supabase
    .from("product_types")
    .select("id")
    .eq("id", productTypeId)
    .eq("organization_id", orgResult.organizationId)
    .maybeSingle();
  if (!type) {
    return { error: "El Tipo de Producto no existe en tu organización.", updatedCount: 0 };
  }

  const { data, error } = await supabase
    .from("product_catalog")
    .update({ product_type_id: productTypeId })
    .in("id", productIds)
    .eq("organization_id", orgResult.organizationId)
    .is("product_type_id", null)
    .select("id");

  if (error) {
    return { error: mapDbError(error, "No se pudo asignar el Tipo de Producto. Intenta de nuevo."), updatedCount: 0 };
  }

  revalidatePath("/configuracion/catalogo");
  revalidatePath("/configuracion/catalogo/sin-clasificar");
  return { error: null, updatedCount: (data ?? []).length };
}

export type BulkDeactivateCatalogProductsResult = { error: string | null; updatedCount: number };

/**
 * Máximo de ids aceptados por llamada — el doble de CATALOG_PAGE_SIZE
 * (page.tsx), suficiente holgura sobre lo que la UI puede seleccionar hoy
 * ("Seleccionar todos los visibles" nunca marca más que la página actual)
 * sin permitir un volumen absurdo. Fix de bug — un `selected` acumulado
 * entre páginas (arreglado en catalog-selection-table.tsx) llegó a mandar
 * 1,296 ids en producción: `.in("id", ids)` con esa cantidad genera una
 * URL PostgREST que Supabase rechaza con un Bad Request genérico, no un
 * error legible. Este límite es una segunda capa de defensa (nunca
 * confiar únicamente en que el cliente se comporte) que convierte ese caso
 * en un mensaje claro en vez de una falla opaca.
 */
const MAX_BULK_DEACTIVATE_IDS = CATALOG_PAGE_SIZE * 2;

/**
 * Ajuste de cierre — selección múltiple + "Eliminar del catálogo" masivo.
 * SIEMPRE soft-delete (`active = false`), NUNCA borrado físico — mismo
 * criterio ya establecido para la edición individual (ver
 * updateCatalogProduct abajo): conserva SKU, nombre y toda referencia
 * histórica en cotizaciones/Sales Orders/compras/inventario intacta (esta
 * función NUNCA toca ninguna otra tabla). Un producto inactivo ya
 * desaparece automáticamente de todos los selectores de nueva operación
 * (Cotizaciones/Sales Orders/Pedidos/Inventario ya filtran
 * `.eq("active", true)`, patrón preexistente) sin ningún cambio adicional
 * aquí.
 *
 * Autoridad: además de `product_catalog_admin_write` (RLS, 0019 —
 * `is_organization_admin`, la misma que ya protege cualquier UPDATE
 * directo a esta tabla), se agrega un chequeo explícito de
 * `profile.role === "admin"` — no es un permiso nuevo, es la MISMA señal
 * que ya usa layout.tsx para bloquear el acceso a toda la sección
 * /configuracion/catalogo; se repite aquí porque una Server Action se
 * puede invocar directo (fuera de la UI) sin pasar por ese layout guard.
 *
 * Cross-org: mismo criterio de defensa en profundidad que
 * bulkAssignProductType — `.eq("organization_id", ...)` explícito en el
 * UPDATE, nunca confía únicamente en RLS para una operación masiva.
 * `.eq("active", true)` en el WHERE: nunca vuelve a "tocar" un producto ya
 * inactivo (evita ruido en revalidación/auditoría sin cambiar nada real).
 */
export async function bulkDeactivateCatalogProducts(productIds: string[]): Promise<BulkDeactivateCatalogProductsResult> {
  if (productIds.length === 0) {
    return { error: "Selecciona al menos un producto.", updatedCount: 0 };
  }
  if (productIds.length > MAX_BULK_DEACTIVATE_IDS) {
    return {
      error: `No puedes eliminar más de ${MAX_BULK_DEACTIVATE_IDS} productos a la vez. Selecciona un grupo más pequeño.`,
      updatedCount: 0,
    };
  }

  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
    return { error: "Solo un administrador puede eliminar productos del catálogo.", updatedCount: 0 };
  }

  const supabase = createSupabaseServerClient();
  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return { error: orgResult.error, updatedCount: 0 };

  const { data, error } = await supabase
    .from("product_catalog")
    .update({ active: false })
    .in("id", productIds)
    .eq("organization_id", orgResult.organizationId)
    .eq("active", true)
    .select("id");

  if (error) {
    return { error: mapDbError(error, "No se pudieron eliminar los productos del catálogo. Intenta de nuevo."), updatedCount: 0 };
  }

  revalidatePath("/configuracion/catalogo");
  return { error: null, updatedCount: (data ?? []).length };
}

export type BulkDeactivateAllMatchingCatalogProductsResult = { error: string | null; updatedCount: number };

/**
 * "Seleccionar los N productos que coinciden con estos filtros" — V1
 * deliberadamente acotada a Business Unit (bu) y Tipo de Producto (tipo)
 * ÚNICAMENTE. NUNCA recibe ni envía una lista de ids desde el navegador
 * (el caso real que rompía: filtro BU con ~1,296 resultados generaba una
 * URL de PostgREST demasiado grande) — delega el conjunto completo a
 * `rpc_bulk_deactivate_catalog_products_by_filters` (0078), que resuelve y
 * desactiva TODO en una sola sentencia SQL dentro de Postgres.
 *
 * Deliberadamente SIN soporte para `q` (búsqueda de texto): `ILIKE`
 * (Postgres) no es insensible a acentos como `canonicalize()` (JS, usado
 * en pantalla) — podría desactivar un conjunto ligeramente distinto al que
 * el usuario vio contar. La UI (catalog-selection-table.tsx) solo ofrece
 * esta acción cuando no hay búsqueda activa y el filtro Estado es
 * "Activo"/default — nunca con "Inactivo"/"Todos" (evita un conteo que
 * ya incluya productos inactivos). Esta función no repite esas
 * validaciones porque son de UX/alcance, no de seguridad — la seguridad
 * real (organización, active=true, admin) vive en el RPC.
 *
 * Autoridad y organización: resueltas DENTRO del RPC
 * (current_user_organization_id()/current_user_is_admin()) — nunca se
 * confía en nada enviado desde el cliente, ni siquiera un organization_id.
 * Si el catálogo cambió entre que el usuario vio el conteo y confirmó, el
 * RPC opera sobre el conjunto vigente en el momento de ejecutar (una sola
 * sentencia UPDATE) y `updatedCount` refleja exactamente lo que en verdad
 * cambió.
 */
export async function bulkDeactivateAllMatchingCatalogProducts(filters: {
  bu?: string;
  tipo?: string;
}): Promise<BulkDeactivateAllMatchingCatalogProductsResult> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
    return { error: "Solo un administrador puede eliminar productos del catálogo.", updatedCount: 0 };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_bulk_deactivate_catalog_products_by_filters", {
    p_bu: filters.bu || null,
    p_tipo: filters.tipo || null,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron eliminar los productos del catálogo. Intenta de nuevo."), updatedCount: 0 };
  }

  revalidatePath("/configuracion/catalogo");
  return { error: null, updatedCount: data ?? 0 };
}

/** Edita un producto del catálogo, incluida su activación/desactivación. No borra el producto (sin borrado físico en esta fase). */
export async function updateCatalogProduct(id: string, payload: CatalogProductPayload): Promise<CatalogActionResult> {
  const parsed = catalogProductSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase.from("product_catalog").select("organization_id").eq("id", id).single();
  if (!existing) {
    return { error: "Producto no encontrado." };
  }

  const { error } = await supabase
    .from("product_catalog")
    .update(buildRow(parsed.data, existing.organization_id))
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un producto con el SKU "${parsed.data.sku}"` };
    }
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  const buError = await syncBusinessUnits(supabase, id, parsed.data.business_unit_ids);
  if (buError) {
    return {
      error: mapDbError(
        buError,
        "Los datos del producto se guardaron, pero no se pudieron actualizar sus Business Units. Intenta de nuevo."
      ),
    };
  }

  revalidatePath("/configuracion/catalogo");
  redirect("/configuracion/catalogo");
}

export type SupplierReferencesActionResult = { error: string | null };

/**
 * THÖREN — Supplier Product References (0066). Reemplaza el conjunto
 * COMPLETO de referencias de proveedor de un producto vía
 * rpc_replace_supplier_product_references — UNA sola invocación de
 * función, UNA sola transacción implícita (mismo criterio que
 * rpc_replace_purchase_order_items, 0045): el DELETE del set anterior y
 * el INSERT del nuevo ocurren dentro de la MISMA transacción, así que si
 * cualquier validación o el propio INSERT falla, TODO se revierte — el
 * producto conserva su set anterior intacto, nunca queda vacío ni a
 * medias. Dos llamadas PostgREST separadas (.delete() + .insert()) NUNCA
 * habrían sido atómicas — cada una es su propia transacción — por eso
 * esta operación vive en una RPC, no en el cliente Supabase directo.
 *
 * Nunca crea/edita el producto en sí (SKU/modelo interno) — sección
 * completamente separada, ver DECISIÓN "no mezclar visualmente" del
 * ticket. La validación zod de aquí es capa 2 (mensaje legible sin viaje
 * redondo); la RPC repite las mismas validaciones como capa 3 real —
 * nunca confía en que el cliente ya validó.
 */
export async function updateSupplierProductReferences(
  catalogProductId: string,
  rows: SupplierProductReferenceRow[]
): Promise<SupplierReferencesActionResult> {
  const parsed = supplierProductReferencesPayloadSchema.safeParse(rows);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();

  const { error } = await supabase.rpc("rpc_replace_supplier_product_references", {
    p_catalog_product_id: catalogProductId,
    p_references: parsed.data.map((row) => ({
      supplier_id: row.supplierId,
      supplier_sku: row.supplierSku || null,
      supplier_model: row.supplierModel || null,
      supplier_description: row.supplierDescription || null,
      supplier_uom: row.supplierUom || null,
      preferred: row.preferred,
      active: row.active,
    })),
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar las referencias de proveedor. Intenta de nuevo.") };
  }

  revalidatePath(`/configuracion/catalogo/${catalogProductId}/editar`);
  return { error: null };
}
