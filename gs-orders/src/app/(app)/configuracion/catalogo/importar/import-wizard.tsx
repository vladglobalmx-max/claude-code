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
  type ImportRowError,
  type ParsedProductRow,
  type ValidProductRow,
  type DuplicateProductRow,
} from "@/lib/products/import-parsing";
import { getProductImportCandidates, commitProductImport, type ImportCommitResult } from "./actions";

/**
 * Wizard de importación de Productos — mismo patrón exacto que
 * ImportWizard de Clientes (clientes/importar/import-wizard.tsx):
 * parseo/preview 100% client-side con read-excel-file/browser (ya
 * instalado, sin dependencias nuevas), candidatos leídos del servidor
 * antes de construir el preview, commit final vía Server Action. Más
 * simple que el de Clientes: sin "resolución" por fila — un duplicado
 * simplemente no se importa, esta fase es INSERT de productos nuevos, no
 * actualización masiva (fuera de alcance explícito).
 */
export function ImportWizard() {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [validRows, setValidRows] = useState<ValidProductRow[]>([]);
  const [duplicateRows, setDuplicateRows] = useState<DuplicateProductRow[]>([]);
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

      const { valid, duplicates, errors: classifyErrors } = classifyProductRows(
        parsedRows,
        candidatesResult.businessUnits,
        candidatesResult.existingSkus
      );

      setTotalRows(parsedRows.length + parsedErrors.length);
      setRowErrors([...parsedErrors, ...classifyErrors].sort((a, b) => a.rowNumber - b.rowNumber));
      setValidRows(valid);
      setDuplicateRows(duplicates);
      setStep("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer el archivo. Verifica que sea un .xlsx válido.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm() {
    setIsCommitting(true);
    try {
      const commitResult = await commitProductImport(
        validRows.map((r) => ({
          businessUnitId: r.businessUnitId,
          category: r.category,
          sku: r.sku,
          name: r.name,
          description: r.description,
          priceMxn: r.priceMxn,
          priceUsd: r.priceUsd,
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total filas" value={totalRows} />
              <Stat label="Productos nuevos" value={validRows.length} />
              <Stat label="Posibles duplicados" value={duplicateRows.length} />
              <Stat label="Errores" value={rowErrors.length} />
            </div>
          </CardContent>
        </Card>

        {rowErrors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-danger">
                <FileWarning className="h-4 w-4" />
                Filas con error (no se importarán)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-danger">
                {rowErrors.map((e) => (
                  <li key={e.rowNumber}>{e.message}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {duplicateRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-ink">Posibles duplicados (no se importarán)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {duplicateRows.map((d) => (
                  <li key={d.rowNumber} className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-soft">
                      Fila {d.rowNumber}: modelo <span className="font-mono">{d.sku}</span> ({d.name})
                    </span>
                    <Badge variant="warning">
                      {d.reason === "existing" ? "ya existe en el catálogo" : "repetido en el mismo archivo"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {validRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-ink">Productos que se importarán</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {validRows.map((r) => (
                  <li key={r.rowNumber} className="text-ink-soft">
                    Fila {r.rowNumber}: <span className="font-mono">{r.sku}</span> — {r.name} ·{" "}
                    <span className="text-ink-faint">{r.businessUnitName}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" loading={isCommitting} disabled={isCommitting || validRows.length === 0} onClick={handleConfirm}>
            Importar productos
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("upload")}>
            <ArrowLeft className="h-4 w-4" />
            Elegir otro archivo
          </Button>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Productos importados" value={result?.productsCreated ?? 0} />
          <Stat label="Duplicados omitidos" value={duplicateRows.length} />
          <Stat label="Filas con error" value={rowErrors.length + (result?.errors.length ?? 0)} />
        </div>
        {result && result.errors.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium text-danger">Errores durante la importación</p>
            <ul className="space-y-1 text-sm text-danger">
              {result.errors.map((e, i) => (
                <li key={i}>
                  {e.row}: {e.message}
                </li>
              ))}
            </ul>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}
