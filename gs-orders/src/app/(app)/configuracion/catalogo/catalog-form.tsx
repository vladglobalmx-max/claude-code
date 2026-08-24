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

export interface CatalogFormInitialState {
  sku: string;
  name: string;
  description: string;
  productTypeId: string;
  brand: string;
  model: string;
  unit: string;
  power: string;
  color: string;
  lensType: string;
  technicalNotes: string;
  currency: "MXN" | "USD";
  basePrice: string;
  businessUnitIds: string[];
  active: boolean;
  image: MediaDraft | null;
}

export interface BusinessUnitOption {
  id: string;
  name: string;
}

export interface ProductTypeOption {
  id: string;
  name: string;
}

export function CatalogForm({
  productId,
  businessUnits,
  productTypes,
  initialState,
  submitLabel = "Guardar producto",
  onSubmit,
}: {
  productId: string;
  businessUnits: BusinessUnitOption[];
  productTypes: ProductTypeOption[];
  initialState: CatalogFormInitialState;
  submitLabel?: string;
  onSubmit: (id: string, payload: CatalogProductPayload) => Promise<CatalogActionResult>;
}) {
  const router = useRouter();
  const [sku, setSku] = useState(initialState.sku);
  const [name, setName] = useState(initialState.name);
  const [description, setDescription] = useState(initialState.description);
  const [productTypeId, setProductTypeId] = useState(initialState.productTypeId);
  const [brand, setBrand] = useState(initialState.brand);
  const [model, setModel] = useState(initialState.model);
  const [unit, setUnit] = useState(initialState.unit);
  const [power, setPower] = useState(initialState.power);
  const [color, setColor] = useState(initialState.color);
  const [lensType, setLensType] = useState(initialState.lensType);
  const [technicalNotes, setTechnicalNotes] = useState(initialState.technicalNotes);
  const [currency, setCurrency] = useState<"MXN" | "USD">(initialState.currency);
  const [basePrice, setBasePrice] = useState(initialState.basePrice);
  const [shareAllBusinessUnits, setShareAllBusinessUnits] = useState(initialState.businessUnitIds.length === 0);
  const [businessUnitIds, setBusinessUnitIds] = useState<string[]>(initialState.businessUnitIds);
  const [active, setActive] = useState(initialState.active);
  const [image, setImage] = useState<MediaDraft | null>(initialState.image);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleBusinessUnit(id: string) {
    setBusinessUnitIds((prev) => (prev.includes(id) ? prev.filter((buId) => buId !== id) : [...prev, id]));
  }

  function handleSubmit() {
    if (!sku.trim()) {
      toast.error("El SKU es obligatorio");
      return;
    }
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!productTypeId) {
      toast.error("Selecciona un tipo de producto");
      return;
    }
    if (basePrice.trim() && Number(basePrice) < 0) {
      toast.error("El precio base no puede ser negativo");
      return;
    }

    const priceValue = basePrice.trim() ? Number(basePrice) : undefined;

    const payload: CatalogProductPayload = {
      sku: sku.trim(),
      name: name.trim(),
      description: description || undefined,
      image_path: image?.path ?? null,
      product_type_id: productTypeId || null,
      brand: brand || undefined,
      model: model || undefined,
      unit: unit || undefined,
      power: power || undefined,
      color: color || undefined,
      lens_type: lensType || undefined,
      technical_notes: technicalNotes || undefined,
      // Moneda + Precio base (UI) se mapean a las 2 columnas reales
      // (default_price_mxn/default_price_usd, 0019) según la moneda
      // elegida — ver DECISIÓN en 0030_product_catalog_master.sql.
      default_price_mxn: currency === "MXN" ? priceValue : null,
      default_price_usd: currency === "USD" ? priceValue : null,
      business_unit_ids: shareAllBusinessUnits ? [] : businessUnitIds,
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Ej. TP-RT40076-2" />
            </div>
            <div>
              <Label htmlFor="product_type">Tipo de producto</Label>
              <Select id="product_type" value={productTypeId} onChange={(e) => setProductTypeId(e.target.value)}>
                <option value="">Selecciona un tipo…</option>
                {productTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              {productTypes.length === 0 && (
                <p className="mt-1 text-xs text-warning">
                  No hay tipos de producto activos. Créalos primero en Configuración → Tipos de producto.
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Proyector señalización LED dual"
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea id="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="brand">Marca (opcional)</Label>
              <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="model">Modelo (opcional)</Label>
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="unit">Unidad (opcional)</Label>
              <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pza" />
            </div>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="color">Color (opcional)</Label>
              <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="technical_notes">Observaciones técnicas (opcional)</Label>
              <Input id="technical_notes" value={technicalNotes} onChange={(e) => setTechnicalNotes(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="currency">Moneda</Label>
              <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as "MXN" | "USD")}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="base_price">Precio base (opcional)</Label>
              <Input
                id="base_price"
                type="number"
                min="0"
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <p className="text-xs text-ink-faint">
            Precio de referencia para futuras cotizaciones. No es un precio fijo ni histórico: cada cotización captura
            su propio precio al momento de crearse.
          </p>

          <div>
            <Label>Business Units</Label>
            <label className="mt-1 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={shareAllBusinessUnits}
                onChange={(e) => setShareAllBusinessUnits(e.target.checked)}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
              />
              Todas las unidades de negocio
            </label>
            {!shareAllBusinessUnits && (
              <div className="mt-2 space-y-1.5 rounded-lg border border-border p-3">
                {businessUnits.length === 0 ? (
                  <p className="text-xs text-ink-faint">No hay Business Units activas para seleccionar.</p>
                ) : (
                  businessUnits.map((bu) => (
                    <label key={bu.id} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={businessUnitIds.includes(bu.id)}
                        onChange={() => toggleBusinessUnit(bu.id)}
                        className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                      />
                      {bu.name}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
            />
            Activo (visible en Cotizaciones y Pedidos)
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
