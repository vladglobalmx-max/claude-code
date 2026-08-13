"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SingleImageField } from "@/components/orders/single-image-field";
import { uploadMediaFile } from "@/components/orders/media-client";
import type { MediaDraft } from "@/components/orders/types";
import type { CatalogProductPayload } from "@/lib/validations/catalog";
import type { CatalogActionResult } from "./actions";

const NEW_CATEGORY_VALUE = "__new__";

export interface CatalogFormInitialState {
  category: string;
  sku: string;
  name: string;
  description: string;
  power: string;
  color: string;
  lensType: string;
  technicalNotes: string;
  active: boolean;
  image: MediaDraft | null;
}

export function CatalogForm({
  productId,
  categories,
  initialState,
  submitLabel = "Guardar producto",
  onSubmit,
}: {
  productId: string;
  categories: string[];
  initialState: CatalogFormInitialState;
  submitLabel?: string;
  onSubmit: (id: string, payload: CatalogProductPayload) => Promise<CatalogActionResult>;
}) {
  const router = useRouter();
  const [isNewCategory, setIsNewCategory] = useState(
    categories.length === 0 || (initialState.category !== "" && !categories.includes(initialState.category))
  );
  const [category, setCategory] = useState(isNewCategory ? categories[0] ?? "" : initialState.category);
  const [newCategory, setNewCategory] = useState(isNewCategory ? initialState.category : "");
  const [sku, setSku] = useState(initialState.sku);
  const [name, setName] = useState(initialState.name);
  const [description, setDescription] = useState(initialState.description);
  const [power, setPower] = useState(initialState.power);
  const [color, setColor] = useState(initialState.color);
  const [lensType, setLensType] = useState(initialState.lensType);
  const [technicalNotes, setTechnicalNotes] = useState(initialState.technicalNotes);
  const [active, setActive] = useState(initialState.active);
  const [image, setImage] = useState<MediaDraft | null>(initialState.image);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const finalCategory = isNewCategory ? newCategory.trim() : category;
    if (!finalCategory) {
      toast.error("Selecciona o escribe una categoría");
      return;
    }
    if (!sku.trim()) {
      toast.error("El modelo/SKU es obligatorio");
      return;
    }
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    const payload: CatalogProductPayload = {
      category: finalCategory,
      sku: sku.trim(),
      name: name.trim(),
      description: description || undefined,
      image_path: image?.path ?? null,
      power: power || undefined,
      color: color || undefined,
      lens_type: lensType || undefined,
      technical_notes: technicalNotes || undefined,
      active,
    };

    setError(null);
    startTransition(async () => {
      const result = await onSubmit(productId, payload);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Producto del catálogo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div>
            <Label>Imagen principal (opcional)</Label>
            <SingleImageField
              value={image}
              accept="image/jpeg,image/png,image/jpg"
              onUpload={async (file) => {
                const media = await uploadMediaFile(productId, "catalogo", file);
                setImage(media);
              }}
              onRemove={() => setImage(null)}
            />
          </div>

          <div>
            <Label htmlFor="category">Categoría</Label>
            {!isNewCategory ? (
              <Select
                id="category"
                value={category}
                onChange={(e) => {
                  if (e.target.value === NEW_CATEGORY_VALUE) {
                    setIsNewCategory(true);
                    setNewCategory("");
                  } else {
                    setCategory(e.target.value);
                  }
                }}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={NEW_CATEGORY_VALUE}>+ Nueva categoría…</option>
              </Select>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Nombre de la categoría"
                  autoFocus
                />
                {categories.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsNewCategory(false);
                      setCategory(categories[0] ?? "");
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="sku">Modelo / SKU</Label>
              <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Ej. TLLTPB140R" />
            </div>
            <div>
              <Label htmlFor="color">Color (opcional)</Label>
              <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Luz LED Grúa Viajera Roja"
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea id="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="power">Potencia (opcional)</Label>
              <Input id="power" value={power} onChange={(e) => setPower(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lens_type">Tipo de lente (opcional)</Label>
              <Input id="lens_type" value={lensType} onChange={(e) => setLensType(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="technical_notes">Observaciones técnicas (opcional)</Label>
            <Textarea
              id="technical_notes"
              rows={2}
              value={technicalNotes}
              onChange={(e) => setTechnicalNotes(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
            />
            Activo (visible en Nuevo Pedido)
          </label>
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="button" loading={isPending} disabled={isPending} onClick={handleSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
