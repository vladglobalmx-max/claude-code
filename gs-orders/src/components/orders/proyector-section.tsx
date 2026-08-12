"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ORIENTATION_LABELS,
  SURFACE_MATERIAL_LABELS,
  SURFACE_TYPE_LABELS,
  USE_LABELS,
} from "@/types/domain";
import type { ProjectorDraft } from "./types";

/**
 * Instalación y superficie del pedido — no varían por producto, así que
 * siguen siendo del pedido completo. El equipo y la imagen a proyectar de
 * cada producto se capturan en ProductosSection (ver 0006_item_projection.sql).
 */
export function ProyectorSection({
  value,
  onChange,
}: {
  value: ProjectorDraft;
  onChange: (patch: Partial<ProjectorDraft>) => void;
}) {
  return (
    <div className="space-y-5">
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
