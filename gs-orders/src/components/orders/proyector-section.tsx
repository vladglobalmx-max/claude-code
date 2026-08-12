"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SingleImageField } from "./single-image-field";
import { uploadMediaFile } from "./media-client";
import {
  ORIENTATION_LABELS,
  SURFACE_MATERIAL_LABELS,
  SURFACE_TYPE_LABELS,
  USE_LABELS,
} from "@/types/domain";
import type { ProjectorDraft } from "./types";

export function ProyectorSection({
  orderId,
  value,
  onChange,
}: {
  orderId: string;
  value: ProjectorDraft;
  onChange: (patch: Partial<ProjectorDraft>) => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Equipo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="proj-model">Modelo exacto del proyector</Label>
            <Input
              id="proj-model"
              value={value.model}
              onChange={(e) => onChange({ model: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="proj-quantity">Cantidad</Label>
            <Input
              id="proj-quantity"
              type="number"
              min={1}
              value={value.quantity}
              onChange={(e) => onChange({ quantity: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="proj-power">Potencia / versión (opcional)</Label>
            <Input
              id="proj-power"
              value={value.power}
              onChange={(e) => onChange({ power: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="proj-lens">Tipo de lente (opcional)</Label>
            <Input
              id="proj-lens"
              value={value.lensType}
              disabled={value.lensPendingFactory}
              onChange={(e) => onChange({ lensType: e.target.value })}
            />
            <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-faint">
              <input
                type="checkbox"
                checked={value.lensPendingFactory}
                onChange={(e) => onChange({ lensPendingFactory: e.target.checked, lensType: "" })}
                className="h-3.5 w-3.5 rounded border-border text-accent focus:ring-accent/30"
              />
              Por definir por fábrica
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imagen que se proyectará</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="proj-description">¿Qué quiere proyectar el cliente?</Label>
            <Textarea
              id="proj-description"
              rows={2}
              value={value.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Ej. STOP, Cruce peatonal, Logo TENARIS, Zona restringida…"
            />
          </div>
          <div>
            <Label htmlFor="proj-description-en">Texto para proveedor (inglés)</Label>
            <Textarea
              id="proj-description-en"
              rows={2}
              value={value.descriptionEn}
              onChange={(e) => onChange({ descriptionEn: e.target.value })}
              placeholder="Ej. STOP, Pedestrian crossing, TENARIS logo…"
            />
            <p className="mt-1 text-xs text-ink-faint">Opcional. Se usa en el PDF para fábrica; si se deja vacío, se usa el texto en español.</p>
          </div>
          <div>
            <Label>Imagen a proyectar</Label>
            <SingleImageField
              value={value.file}
              accept="image/jpeg,image/png,image/jpg,.pdf,.svg,application/pdf,image/svg+xml"
              label="Subir imagen o diseño (JPG, PNG, PDF, SVG)"
              onUpload={async (file) => {
                const media = await uploadMediaFile(orderId, "proyeccion", file);
                onChange({ file: media });
              }}
              onRemove={() => onChange({ file: null })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medidas de la proyección</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="proj-width">Ancho de imagen requerida</Label>
            <Input
              id="proj-width"
              type="number"
              step="0.01"
              min={0}
              value={value.width}
              onChange={(e) => onChange({ width: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="proj-height">Alto de imagen requerida</Label>
            <Input
              id="proj-height"
              type="number"
              step="0.01"
              min={0}
              value={value.height}
              onChange={(e) => onChange({ height: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="proj-size-unit">Unidad</Label>
            <Select
              id="proj-size-unit"
              value={value.sizeUnit}
              onChange={(e) => onChange({ sizeUnit: e.target.value as ProjectorDraft["sizeUnit"] })}
            >
              <option value="m">Metros</option>
              <option value="cm">Centímetros</option>
            </Select>
          </div>
          {value.width && value.height && (
            <p className="text-sm text-ink-soft sm:col-span-3">
              Tamaño de proyección: {value.width} {value.sizeUnit} × {value.height} {value.sizeUnit}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instalación del proyector</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="proj-inst-height">Altura de instalación</Label>
            <div className="flex gap-2">
              <Input
                id="proj-inst-height"
                type="number"
                step="0.01"
                min={0}
                className="flex-1"
                value={value.installationHeight}
                onChange={(e) => onChange({ installationHeight: e.target.value })}
              />
              <Select
                className="w-24 shrink-0"
                value={value.installationHeightUnit}
                onChange={(e) =>
                  onChange({ installationHeightUnit: e.target.value as ProjectorDraft["installationHeightUnit"] })
                }
              >
                <option value="m">m</option>
                <option value="cm">cm</option>
                <option value="pies">pies</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="proj-distance">Distancia proyector–superficie</Label>
            <Input
              id="proj-distance"
              type="number"
              step="0.01"
              min={0}
              value={value.installationDistance}
              onChange={(e) => onChange({ installationDistance: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="proj-orientation">Orientación</Label>
            <Select
              id="proj-orientation"
              value={value.orientation}
              onChange={(e) => onChange({ orientation: e.target.value as ProjectorDraft["orientation"] })}
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
            <Label htmlFor="proj-use">Uso</Label>
            <Select
              id="proj-use"
              value={value.use}
              onChange={(e) => onChange({ use: e.target.value as ProjectorDraft["use"] })}
            >
              <option value="">Selecciona…</option>
              {Object.entries(USE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Superficie de proyección</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="proj-surface-type">Superficie</Label>
            <Select
              id="proj-surface-type"
              value={value.surfaceType}
              onChange={(e) => onChange({ surfaceType: e.target.value as ProjectorDraft["surfaceType"] })}
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
            <Label htmlFor="proj-surface-material">Material (opcional)</Label>
            <Select
              id="proj-surface-material"
              value={value.surfaceMaterial}
              onChange={(e) =>
                onChange({ surfaceMaterial: e.target.value as ProjectorDraft["surfaceMaterial"] })
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
          <div className="sm:col-span-2">
            <Label htmlFor="proj-surface-notes">Observaciones de superficie</Label>
            <Textarea
              id="proj-surface-notes"
              rows={2}
              value={value.surfaceNotes}
              onChange={(e) => onChange({ surfaceNotes: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="proj-surface-notes-en">Texto para proveedor (inglés)</Label>
            <Textarea
              id="proj-surface-notes-en"
              rows={2}
              value={value.surfaceNotesEn}
              onChange={(e) => onChange({ surfaceNotesEn: e.target.value })}
            />
            <p className="mt-1 text-xs text-ink-faint">Opcional. Se usa en el PDF para fábrica; si se deja vacío, se usa el texto en español.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
