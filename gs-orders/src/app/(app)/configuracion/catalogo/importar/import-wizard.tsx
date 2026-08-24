"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Upload, FileWarning, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  parseProductImportRow,
  classifyProductRows,
  formatBusinessUnitCell,
  type ImportRowError,
  type ParsedProductRow,
  type ClassifiedProductRow,
} from "@/lib/products/import-parsing";
import { getProductImportCandidates, commitProductImport, type ImportCommitResult } from "./actions";

/**
 * Wizard de importación del Catálogo Maestro de Productos (Fase 6C) —
 * parseo/preview 100% client-side con read-excel-file/browser (ya
 * instalado), candidatos leídos del servidor antes de construir el
 * preview, commit final vía Server Action → RPC atómico. A diferencia de
 * la fase anterior: clasifica NUEVO/ACTUALIZAR/SIN CAMBIOS/ERROR con diff
 * real (no solo "duplicado, se omite"), y CUALQUIER error bloquea TODA la
 * importación — el botón "Importar" queda deshabilitado mientras existan
 * filas con error, no solo las excluye en silencio.
 */
export function ImportWizard() {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [classified, setClassified] = useState<ClassifiedProductRow[]>([]);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  async function handleFile(file: File) {
    setIsLoading(true);
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const rows = await readSheet(file);
      const [, ...dataRows] = rows; // primera fila = encabezado, se descarta

      const parsedErrors: ImportRowError[] = [];
      const parsedRows: ParsedProductRow[] = [];
      dataRows.forEach((cells, index) => {
        const isBlankRow = cells.every((c) => c === null || c === undefined || String(c).trim() === "");
        if (isBlankRow) return;
        const { row, error } = parseProductImportRow(index + 1, cells);
        if (error) parsedErrors.push(error);
        if (row) parsedRows.push(row);
      });

      const candidatesResult = await getProductImportCandidates();
      if ("error" in candidatesResult) {
        toast.error(candidatesResult.error);
        return;
      }

      const { classified: classifiedRows, errors: classifyErrors } = classifyProductRows(
        parsedRows,
        candidatesResult.businessUnits,
        candidatesResult.productTypes,
        candidatesResult.existingProducts
      );

      setTotalRows(parsedRows.length + parsedErrors.length);
      setRowErrors([...parsedErrors, ...classifyErrors].sort((a, b) => a.rowNumber - b.rowNumber));
      setClassified(classifiedRows);
      setStep("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer el archivo. Verifica que sea un .xlsx válido.");
    } finally {
      setIsLoading(false);
    }
  }

  const newRows = classified.filter((r) => r.classification === "new");
  const updateRows = classified.filter((r) => r.classification === "update");
  const unchangedRows = classified.filter((r) => r.classification === "unchanged");
  const hasBlockingErrors = rowErrors.length > 0;
  const rowsToImport = [...newRows, ...updateRows];

  async function handleConfirm() {
    if (hasBlockingErrors) return;
    setIsCommitting(true);
    try {
      const commitResult = await commitProductImport(
        rowsToImport.map((r) => ({
          action: r.classification === "new" ? "insert" : "update",
          existingId: r.existingId,
          sku: r.sku,
          name: r.name,
          description: r.description,
          businessUnitIds: r.businessUnitIds,
          productTypeId: r.productTypeId,
          brand: r.brand,
          model: r.model,
          unit: r.unit,
          currency: r.currency,
          basePrice: r.basePrice,
          active: r.active,
        }))
      );
      setResult(commitResult);
      setStep("done");
    } finally {
      setIsCommitting(false);
    }
  }

  if (step === "upload") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>1. Sube el archivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-soft">
            Usa la plantilla descargada arriba, sin cambiar el orden ni los nombres de las columnas.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-accent">
            <Upload className="h-6 w-6 text-ink-faint" />
            <span className="text-sm font-medium text-ink">
              {isLoading ? "Analizando archivo…" : "Selecciona un archivo .xlsx"}
            </span>
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              disabled={isLoading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </CardContent>
      </Card>
    );
  }

  if (step === "preview") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>2. Revisa antes de importar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Total filas" value={totalRows} />
              <Stat label="Nuevos" value={newRows.length} />
              <Stat label="Actualizaciones" value={updateRows.length} />
              <Stat label="Sin cambios" value={unchangedRows.length} />
              <Stat label="Errores" value={rowErrors.length} accent={rowErrors.length > 0 ? "danger" : undefined} />
            </div>
          </CardContent>
        </Card>

        {hasBlockingErrors && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-danger">
                <FileWarning className="h-4 w-4" />
                Filas con error — la importación está bloqueada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-sm text-ink-soft">
                Corrige estas filas en el Excel y vuelve a subirlo. Mientras existan errores, no se importa nada.
              </p>
              <ul className="space-y-1 text-sm text-danger">
                {rowErrors.map((e) => (
                  <li key={`${e.rowNumber}-${e.message}`}>{e.message}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {newRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-ink">
                <Badge variant="success">Nuevo</Badge>
                Productos que se crearán
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {newRows.map((r) => (
                  <li key={r.rowNumber} className="text-ink-soft">
                    Fila {r.rowNumber}: <span className="font-mono">{r.sku}</span> — {r.name} ·{" "}
                    <span className="text-ink-faint">{formatBusinessUnitCell(r.businessUnitNames)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {updateRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-ink">
                <Badge variant="warning">Actualizar</Badge>
                Productos que se actualizarán
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {updateRows.map((r) => (
                  <li key={r.rowNumber} className="text-ink-soft">
                    <div>
                      Fila {r.rowNumber}: <span className="font-mono">{r.sku}</span> — {r.name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {r.changedFields.map((field) => (
                        <Badge key={field} variant="neutral">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {unchangedRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-ink">Sin cambios (no se tocarán)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-ink-faint">
                {unchangedRows.map((r) => (
                  <li key={r.rowNumber}>
                    Fila {r.rowNumber}: <span className="font-mono">{r.sku}</span> — {r.name}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            loading={isCommitting}
            disabled={isCommitting || hasBlockingErrors || rowsToImport.length === 0}
            onClick={handleConfirm}
          >
            Importar {rowsToImport.length} producto{rowsToImport.length === 1 ? "" : "s"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("upload")}>
            <ArrowLeft className="h-4 w-4" />
            Elegir otro archivo
          </Button>
          {hasBlockingErrors && (
            <span className="text-xs text-danger">Corrige los errores antes de poder importar.</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importación completada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {result?.error ? (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {result.error}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Productos escritos" value={result?.productsWritten ?? 0} />
            <Stat label="Nuevos" value={newRows.length} />
            <Stat label="Actualizados" value={updateRows.length} />
          </div>
        )}
        <div className="flex gap-2">
          <Link href="/configuracion/catalogo">
            <Button type="button">Ir al catálogo</Button>
          </Link>
          <Button type="button" variant="outline" onClick={() => setStep("upload")}>
            Importar otro archivo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "danger" }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`text-xl font-semibold ${accent === "danger" && value > 0 ? "text-danger" : "text-ink"}`}>{value}</p>
    </div>
  );
}
