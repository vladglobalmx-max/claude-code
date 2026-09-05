"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SingleImageField } from "./single-image-field";
import { MultiFileField } from "./multi-file-field";
import { uploadMediaFile } from "./media-client";
import { CatalogProductPicker } from "./catalog-product-picker";
import { emptyProductItem, type CatalogProductOption, type MediaDraft, type ProductItemDraft } from "./types";
import { buildItemPatchFromCatalogProduct, catalogProductsById } from "@/lib/orders/catalog-picker";
import { CustomFieldsRenderer } from "@/components/custom-fields/custom-fields-renderer";
import { scopeDefinitionsToBusinessUnit } from "@/lib/custom-fields/scope";
import {
  isLegacyOrderItemFieldKey,
  isLegacyOrderItemFileFieldKey,
  getLegacyOrderItemFieldRawValue,
  applyLegacyOrderItemFieldValue,
  getLegacyOrderItemFileValue,
  applyLegacyOrderItemFileValue,
} from "@/lib/custom-fields/legacy-order-item-adapter";
import type { CustomFieldDefinition } from "@/lib/custom-fields/types";

/**
 * THÖREN 8C — Vertical Residue Cleanup. Este componente ya no tiene NINGÚN
 * `isProjector`/`product_type === 'proyector_gobo'`: qué se captura para
 * un producto (equipo/proyección/instalación/superficie/adjuntos) sale
 * enteramente de `customFieldDefinitions`, scoped a la Business Unit
 * vigente. Los CORE fields (modelo, cantidad, descripción, unidad,
 * requisitos del cliente, observaciones, imagen principal, imágenes de
 * referencia) son los únicos que siempre se muestran, para cualquier
 * organización — nunca dependen de qué haya configurado Thunder.
 */
export function ProductosSection({
  orderId,
  businessUnitId,
  items,
  catalogProducts,
  customFieldDefinitions,
  onChange,
}: {
  orderId: string;
  /** "" = sin elegir — el picker de catálogo exige una Business Unit antes de habilitarse (Fase 6F §4). */
  businessUnitId: string;
  items: ProductItemDraft[];
  catalogProducts: CatalogProductOption[];
  /**
   * THÖREN 8B/8C — definiciones de custom_field_definitions (entity_type =
   * "order_item") de TODA la organización (cualquier BU), sin filtrar
   * todavía — este componente filtra por `businessUnitId` en cada
   * render, así reacciona de inmediato si el usuario cambia de Business
   * Unit en "Datos generales" sin necesidad de recargar la página.
   */
  customFieldDefinitions: CustomFieldDefinition[];
  onChange: (items: ProductItemDraft[]) => void;
}) {
  function updateItem(key: string, patch: Partial<ProductItemDraft>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function addItem() {
    onChange([...items, emptyProductItem()]);
  }

  function removeItem(key: string) {
    onChange(items.filter((item) => item.key !== key));
  }

  const productsById = catalogProductsById(catalogProducts);

  // THÖREN 8B/8C — org-wide + la BU vigente del pedido, nunca la de otra
  // BU (misma regla que getCustomFieldDefinitions en el servidor,
  // aplicada aquí en el cliente porque businessUnitId puede cambiar sin
  // recargar la página). Esta lista maneja TANTO los campos legacy de
  // Thunder (vía el adapter, siguen leyendo/escribiendo su columna/tabla
  // nativa) COMO cualquier campo genérico nuevo de cualquier tenant — el
  // componente nunca sabe cuáles son "de Thunder".
  const visibleCustomFieldDefinitions = scopeDefinitionsToBusinessUnit(customFieldDefinitions, businessUnitId);

  function readCustomFieldValue(item: ProductItemDraft, key: string): string {
    return isLegacyOrderItemFieldKey(key) ? getLegacyOrderItemFieldRawValue(item, key) : item.customFieldValues[key] ?? "";
  }

  function writeCustomFieldValue(item: ProductItemDraft, key: string, value: string) {
    if (isLegacyOrderItemFieldKey(key)) {
      updateItem(item.key, applyLegacyOrderItemFieldValue(key, value));
    } else {
      updateItem(item.key, { customFieldValues: { ...item.customFieldValues, [key]: value } });
    }
  }

  function readCustomFieldFiles(item: ProductItemDraft, key: string): MediaDraft[] {
    return isLegacyOrderItemFileFieldKey(key) ? getLegacyOrderItemFileValue(item, key) : item.customFieldFiles[key] ?? [];
  }

  function writeCustomFieldFiles(item: ProductItemDraft, key: string, files: MediaDraft[]) {
    if (isLegacyOrderItemFileFieldKey(key)) {
      updateItem(item.key, applyLegacyOrderItemFileValue(key, files));
    } else {
      updateItem(item.key, { customFieldFiles: { ...item.customFieldFiles, [key]: files } });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {items.map((item, index) => {
          const linkedProduct = item.catalogProductId ? productsById.get(item.catalogProductId) : undefined;
          const itemFileValues = Object.fromEntries(
            visibleCustomFieldDefinitions
              .filter((def) => def.fieldType === "file" || def.fieldType === "image")
              .map((def) => [def.key, readCustomFieldFiles(item, def.key)])
          );
          return (
          <div key={item.key} className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Producto {index + 1}
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="flex items-center gap-1 text-xs text-ink-faint hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </button>
              )}
            </div>

            {linkedProduct?.imagePreviewUrl && (
              <div className="mb-3 flex items-center gap-2 text-xs text-ink-faint">
                {/* Miniatura del catálogo — nunca se copia el archivo, solo se muestra (Fase 6F §9). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={linkedProduct.imagePreviewUrl}
                  alt={linkedProduct.name}
                  className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
                />
                <span>
                  Producto del catálogo: {linkedProduct.sku}
                  {!linkedProduct.active && " (desactivado en el catálogo — esta línea histórica se conserva sin cambios)"}
                </span>
              </div>
            )}

            {/* ---- Equipo (CORE — igual para cualquier organización) ---- */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Imagen principal</Label>
                <SingleImageField
                  value={item.image}
                  accept="image/jpeg,image/png,image/jpg"
                  onUpload={async (file) => {
                    const media = await uploadMediaFile(orderId, "productos", file);
                    updateItem(item.key, { image: media });
                  }}
                  onRemove={() => updateItem(item.key, { image: null })}
                />
              </div>

              <div className="sm:col-span-2">
                <Label>Imágenes adicionales (opcional)</Label>
                <MultiFileField
                  items={item.referenceImages}
                  variant="photo"
                  accept="image/jpeg,image/png,image/jpg"
                  onAdd={async (file) => {
                    const media = await uploadMediaFile(orderId, "productos", file);
                    updateItem(item.key, { referenceImages: [...item.referenceImages, media] });
                  }}
                  onRemove={(key) =>
                    updateItem(item.key, { referenceImages: item.referenceImages.filter((img) => img.key !== key) })
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <CatalogProductPicker
                  products={catalogProducts}
                  businessUnitId={businessUnitId}
                  onSelect={(product) =>
                    updateItem(item.key, {
                      ...buildItemPatchFromCatalogProduct(product, item.notes),
                      image: product.imagePath
                        ? {
                            key: crypto.randomUUID(),
                            path: product.imagePath,
                            name: product.imagePath.split("/").pop() ?? "imagen",
                            type: "image/*",
                            size: 0,
                            previewUrl: product.imagePreviewUrl,
                          }
                        : item.image,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor={`model-${item.key}`}>Modelo / SKU</Label>
                <Input
                  id={`model-${item.key}`}
                  value={item.model}
                  onChange={(e) => updateItem(item.key, { model: e.target.value, catalogProductId: null })}
                  placeholder="Modelo exacto"
                />
              </div>

              <div>
                <Label htmlFor={`quantity-${item.key}`}>Cantidad</Label>
                <Input
                  id={`quantity-${item.key}`}
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) || 1 })}
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor={`description-${item.key}`}>Descripción</Label>
                <Textarea
                  id={`description-${item.key}`}
                  rows={2}
                  value={item.description}
                  onChange={(e) => updateItem(item.key, { description: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor={`unit-${item.key}`}>Unidad (opcional)</Label>
                <Input
                  id={`unit-${item.key}`}
                  value={item.unit}
                  onChange={(e) => updateItem(item.key, { unit: e.target.value })}
                  placeholder="Ej. pza, caja, servicio"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor={`customer-requirements-${item.key}`}>Requisitos del cliente (opcional)</Label>
                <Textarea
                  id={`customer-requirements-${item.key}`}
                  rows={2}
                  value={item.customerRequirements}
                  onChange={(e) => updateItem(item.key, { customerRequirements: e.target.value })}
                  placeholder="Color, dimensiones, instalación, indicaciones particulares…"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor={`notes-${item.key}`}>Observaciones</Label>
                <Textarea
                  id={`notes-${item.key}`}
                  rows={2}
                  value={item.notes}
                  onChange={(e) => updateItem(item.key, { notes: e.target.value })}
                />
              </div>
            </div>

            {visibleCustomFieldDefinitions.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">
                  Campos personalizados
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CustomFieldsRenderer
                    definitions={visibleCustomFieldDefinitions}
                    values={Object.fromEntries(
                      visibleCustomFieldDefinitions.map((def) => [def.key, readCustomFieldValue(item, def.key)])
                    )}
                    onChange={(fieldKey, value) => writeCustomFieldValue(item, fieldKey, value)}
                    fileValues={itemFileValues}
                    onUploadFile={async (fieldKey, file) => {
                      const media = await uploadMediaFile(orderId, "custom", file);
                      writeCustomFieldFiles(item, fieldKey, [...readCustomFieldFiles(item, fieldKey), media]);
                    }}
                    onRemoveFile={(fieldKey, fileKey) =>
                      writeCustomFieldFiles(
                        item,
                        fieldKey,
                        readCustomFieldFiles(item, fieldKey).filter((f) => f.key !== fileKey)
                      )
                    }
                    idPrefix={`custom-${item.key}`}
                  />
                </div>
              </div>
            )}
          </div>
          );
        })}

        <Button type="button" variant="outline" onClick={addItem}>
          <Plus className="h-4 w-4" />
          Agregar producto
        </Button>
      </CardContent>
    </Card>
  );
}
