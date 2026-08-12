"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SingleImageField } from "./single-image-field";
import { uploadMediaFile } from "./media-client";
import { emptyProductItem, type ProductItemDraft } from "./types";

export function ProductosSection({
  orderId,
  items,
  isProjector,
  onChange,
}: {
  orderId: string;
  items: ProductItemDraft[];
  isProjector: boolean;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {items.map((item, index) => (
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

              <div>
                <Label htmlFor={`model-${item.key}`}>Modelo / SKU</Label>
                <Input
                  id={`model-${item.key}`}
                  value={item.model}
                  onChange={(e) => updateItem(item.key, { model: e.target.value })}
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

              {isProjector && (
                <>
                  <div>
                    <Label htmlFor={`power-${item.key}`}>Potencia / versión (opcional)</Label>
                    <Input
                      id={`power-${item.key}`}
                      value={item.power}
                      onChange={(e) => updateItem(item.key, { power: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`lens-${item.key}`}>Tipo de lente (opcional)</Label>
                    <Input
                      id={`lens-${item.key}`}
                      value={item.lensType}
                      disabled={item.lensPendingFactory}
                      onChange={(e) => updateItem(item.key, { lensType: e.target.value })}
                    />
                    <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-faint">
                      <input
                        type="checkbox"
                        checked={item.lensPendingFactory}
                        onChange={(e) => updateItem(item.key, { lensPendingFactory: e.target.checked, lensType: "" })}
                        className="h-3.5 w-3.5 rounded border-border text-accent focus:ring-accent/30"
                      />
                      Por definir por fábrica
                    </label>
                  </div>
                </>
              )}

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
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Imagen a proyectar</p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`proj-desc-${item.key}`}>¿Qué quiere proyectar el cliente?</Label>
                    <Textarea
                      id={`proj-desc-${item.key}`}
                      rows={2}
                      value={item.projectionDescription}
                      onChange={(e) => updateItem(item.key, { projectionDescription: e.target.value })}
                      placeholder="Ej. STOP, Cruce peatonal, Logo TENARIS, Zona restringida…"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`proj-desc-en-${item.key}`}>Texto para proveedor (inglés)</Label>
                    <Textarea
                      id={`proj-desc-en-${item.key}`}
                      rows={2}
                      value={item.projectionDescriptionEn}
                      onChange={(e) => updateItem(item.key, { projectionDescriptionEn: e.target.value })}
                      placeholder="Ej. STOP, Pedestrian crossing, TENARIS logo…"
                    />
                    <p className="mt-1 text-xs text-ink-faint">
                      Opcional. Se usa en el PDF para fábrica; si se deja vacío, se usa el texto en español.
                    </p>
                  </div>
                  <div>
                    <Label>Imagen a proyectar</Label>
                    <SingleImageField
                      value={item.projectionFile}
                      accept="image/jpeg,image/png,image/jpg,.pdf,.svg,application/pdf,image/svg+xml"
                      label="Subir imagen o diseño (JPG, PNG, PDF, SVG)"
                      onUpload={async (file) => {
                        const media = await uploadMediaFile(orderId, "proyeccion", file);
                        updateItem(item.key, { projectionFile: media });
                      }}
                      onRemove={() => updateItem(item.key, { projectionFile: null })}
                    />
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
                          updateItem(item.key, { projectionSizeUnit: e.target.value as ProductItemDraft["projectionSizeUnit"] })
                        }
                      >
                        <option value="m">Metros</option>
                        <option value="cm">Centímetros</option>
                      </Select>
                    </div>
                  </div>
                  {item.projectionWidth && item.projectionHeight && (
                    <p className="text-sm text-ink-soft">
                      Tamaño de proyección: {item.projectionWidth} {item.projectionSizeUnit} × {item.projectionHeight}{" "}
                      {item.projectionSizeUnit}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addItem}>
          <Plus className="h-4 w-4" />
          Agregar producto
        </Button>
      </CardContent>
    </Card>
  );
}
