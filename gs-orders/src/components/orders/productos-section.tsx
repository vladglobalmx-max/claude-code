"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SingleImageField } from "./single-image-field";
import { MultiFileField } from "./multi-file-field";
import { uploadMediaFile } from "./media-client";
import { CatalogProductPicker } from "./catalog-product-picker";
import { ORIENTATION_LABELS, SURFACE_MATERIAL_LABELS, SURFACE_TYPE_LABELS, USE_LABELS } from "@/types/domain";
import { emptyProductItem, type CatalogProductOption, type ProductItemDraft } from "./types";
import { buildItemPatchFromCatalogProduct, catalogProductsById } from "@/lib/orders/catalog-picker";
import { CustomFieldsRenderer } from "@/components/custom-fields/custom-fields-renderer";
import { scopeDefinitionsToBusinessUnit } from "@/lib/custom-fields/scope";
import {
  isLegacyOrderItemFieldKey,
  getLegacyOrderItemFieldRawValue,
  applyLegacyOrderItemFieldValue,
} from "@/lib/custom-fields/legacy-order-item-adapter";
import type { CustomFieldDefinition } from "@/lib/custom-fields/types";

export function ProductosSection({
  orderId,
  businessUnitId,
  items,
  isProjector,
  catalogProducts,
  customFieldDefinitions,
  onChange,
}: {
  orderId: string;
  /** "" = sin elegir — el picker de catálogo exige una Business Unit antes de habilitarse (Fase 6F §4). */
  businessUnitId: string;
  items: ProductItemDraft[];
  isProjector: boolean;
  catalogProducts: CatalogProductOption[];
  /**
   * THÖREN 8B — definiciones de custom_field_definitions (entity_type =
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

  // THÖREN 8B (Gap 1) — org-wide + la BU vigente del pedido, nunca la de
  // otra BU (misma regla que getCustomFieldDefinitions en el servidor,
  // aplicada aquí en el cliente porque businessUnitId puede cambiar sin
  // recargar la página). Esta lista maneja TANTO los 8 campos legacy de
  // Thunder (vía el adapter, siguen leyendo/escribiendo su columna nativa)
  // COMO cualquier campo genérico nuevo — el componente ya no conoce
  // "proyector_gobo" ni ningún concepto vertical para decidir qué mostrar.
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {items.map((item, index) => {
          const linkedProduct = item.catalogProductId ? productsById.get(item.catalogProductId) : undefined;
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

            {/* ---- Equipo ---- */}
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

              {!isProjector && (
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
              )}

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

            {isProjector && (
              <>
                {/* ---- Imagen a proyectar ---- */}
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Imagen a proyectar</p>
                  <div className="space-y-4">
                    <div>
                      <Label>Imagen(es) a proyectar</Label>
                      <MultiFileField
                        items={item.projectionImages}
                        variant="photo"
                        accept="image/jpeg,image/png,image/jpg,.pdf,.svg,application/pdf,image/svg+xml"
                        onAdd={async (file) => {
                          const media = await uploadMediaFile(orderId, "proyeccion", file);
                          updateItem(item.key, { projectionImages: [...item.projectionImages, media] });
                        }}
                        onRemove={(key) =>
                          updateItem(item.key, {
                            projectionImages: item.projectionImages.filter((img) => img.key !== key),
                          })
                        }
                      />
                      <p className="mt-1.5 text-xs text-ink-faint">
                        Puedes subir más de una imagen (por ejemplo, el diseño final y una referencia).
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <Label htmlFor={`proj-width-${item.key}`}>Ancho de imagen requerida</Label>
                        <Input
                          id={`proj-width-${item.key}`}
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.projectionWidth}
                          onChange={(e) => updateItem(item.key, { projectionWidth: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`proj-height-${item.key}`}>Alto de imagen requerida</Label>
                        <Input
                          id={`proj-height-${item.key}`}
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.projectionHeight}
                          onChange={(e) => updateItem(item.key, { projectionHeight: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`proj-unit-${item.key}`}>Unidad</Label>
                        <Select
                          id={`proj-unit-${item.key}`}
                          value={item.projectionSizeUnit}
                          onChange={(e) =>
                            updateItem(item.key, {
                              projectionSizeUnit: e.target.value as ProductItemDraft["projectionSizeUnit"],
                            })
                          }
                        >
                          <option value="m">Metros</option>
                          <option value="cm">Centímetros</option>
                        </Select>
                      </div>
                    </div>
                    {item.projectionWidth && item.projectionHeight && (
                      <p className="text-sm text-ink-soft">
                        Tamaño de proyección: {item.projectionWidth} {item.projectionSizeUnit} ×{" "}
                        {item.projectionHeight} {item.projectionSizeUnit}
                      </p>
                    )}
                  </div>
                </div>

                {/* ---- Instalación del proyector ---- */}
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">
                    Instalación del proyector
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`inst-height-${item.key}`}>Altura de instalación</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`inst-height-${item.key}`}
                          type="number"
                          step="0.01"
                          min={0}
                          className="flex-1"
                          value={item.installationHeight}
                          onChange={(e) => updateItem(item.key, { installationHeight: e.target.value })}
                        />
                        <Select
                          className="w-24 shrink-0"
                          value={item.installationHeightUnit}
                          onChange={(e) =>
                            updateItem(item.key, {
                              installationHeightUnit: e.target.value as ProductItemDraft["installationHeightUnit"],
                            })
                          }
                        >
                          <option value="m">m</option>
                          <option value="cm">cm</option>
                          <option value="pies">pies</option>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`inst-distance-${item.key}`}>Distancia proyector → superficie</Label>
                      <Input
                        id={`inst-distance-${item.key}`}
                        type="number"
                        step="0.01"
                        min={0}
                        value={item.installationDistance}
                        onChange={(e) => updateItem(item.key, { installationDistance: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`inst-orientation-${item.key}`}>Orientación</Label>
                      <Select
                        id={`inst-orientation-${item.key}`}
                        value={item.orientation}
                        onChange={(e) =>
                          updateItem(item.key, { orientation: e.target.value as ProductItemDraft["orientation"] })
                        }
                      >
                        <option value="">Selecciona…</option>
                        {Object.entries(ORIENTATION_LABELS).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`inst-use-${item.key}`}>Uso (opcional)</Label>
                      <Select
                        id={`inst-use-${item.key}`}
                        value={item.use}
                        onChange={(e) => updateItem(item.key, { use: e.target.value as ProductItemDraft["use"] })}
                      >
                        <option value="">Selecciona…</option>
                        {Object.entries(USE_LABELS).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>

                {/* ---- Superficie de proyección ---- */}
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">
                    Superficie de proyección
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`surf-type-${item.key}`}>Superficie</Label>
                      <Select
                        id={`surf-type-${item.key}`}
                        value={item.surfaceType}
                        onChange={(e) =>
                          updateItem(item.key, { surfaceType: e.target.value as ProductItemDraft["surfaceType"] })
                        }
                      >
                        <option value="">Selecciona…</option>
                        {Object.entries(SURFACE_TYPE_LABELS).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`surf-material-${item.key}`}>Material (opcional)</Label>
                      <Select
                        id={`surf-material-${item.key}`}
                        value={item.surfaceMaterial}
                        onChange={(e) =>
                          updateItem(item.key, {
                            surfaceMaterial: e.target.value as ProductItemDraft["surfaceMaterial"],
                          })
                        }
                      >
                        <option value="">Selecciona…</option>
                        {Object.entries(SURFACE_MATERIAL_LABELS).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
              </>
            )}

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
                    idPrefix={`custom-${item.key}`}
                    onChange={(fieldKey, value) => writeCustomFieldValue(item, fieldKey, value)}
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
