"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SingleImageField } from "./single-image-field";
import { uploadMediaFile } from "./media-client";
import { emptyProductItem, type ProductItemDraft } from "./types";

export function ProductosSection({
  orderId,
  items,
  onChange,
}: {
  orderId: string;
  items: ProductItemDraft[];
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
                <Label htmlFor={`model-${item.key}`}>Modelo</Label>
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
