"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Upload, FileWarning, ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils/format";
import {
  parseProductImportRow,
  classifyProductRows,
  formatBusinessUnitCell,
  type ImportRowError,
  type ParsedProductRow,
  type ClassifiedProductRow,
} from "@/lib/products/import-parsing";
import {
  runBatchedImport,
  buildErrorReportCsv,
  IMPORT_BATCH_SIZE,
  type BatchImportProgress,
  type BatchImportSummary,
} from "@/lib/products/import-batching";
import { getProductImportCandidates, commitProductImport } from "./actions";

/** Filas visibles por lista en el preview — con miles de filas, renderizar todo de golpe es innecesario; los conteos totales (Stat) siempre son reales. */
const PREVIEW_LIST_LIMIT = 100;

/**
 * Wizard de importación del Catálogo Maestro de Productos (Fase 6C, fix de
 * escala — ver auditoría "IMPORTACIÓN MASIVA DE PRODUCT CATALOG") —
 * parseo/preview 100% client-side con read-excel-file/browser, candidatos
 * leídos del servidor antes de construir el preview, commit final vía
 * Server Action → RPC atómico — ahora en LOTES SECUENCIALES de
 * IMPORT_BATCH_SIZE filas (ver import-batching.ts): evita exceder el
 * límite default de 1MB de los Next.js Server Actions con catálogos
 * grandes (medido: ~5,397 filas en un solo payload ≈2.4MB, muy por
 * encima del límite; en lotes de 500 ≈230KB por lote). Clasifica NUEVO/
 * ACTUALIZAR/SIN CAMBIOS/ERROR con diff real; cualquier error de parseo/
 * clasificación bloquea TODA la importación. Un lote que falla en el
 * commit (transporte, Server Action, Supabase o RPC) se reporta con sus
 * filas exactas y NO detiene los lotes siguientes — nunca vuelve a pasar
 * "clic Importar → silencio" (antes, handleConfirm no tenía `catch`).
 */
export function ImportWizard() {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [classified, setClassified] = useState<ClassifiedProductRow[]>([]);
  const [importProgress, setImportProgress] = useState<BatchImportProgress | null>(null);
  const [importSummary, setImportSummary] = useState<BatchImportSummary | null>(null);
  const [importFatalError, setImportFatalError] = useState<string | null>(null);

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

  function resetToUpload() {
    setClassified([]);
    setRowErrors([]);
    setTotalRows(0);
    setImportProgress(null);
    setImportSummary(null);
    setImportFatalError(null);
    setStep("upload");
  }

  async function handleConfirm() {
    if (hasBlockingErrors || rowsToImport.length === 0) return;
    setImportFatalError(null);
    setImportProgress({
      batchIndex: 0,
      totalBatches: Math.ceil(rowsToImport.length / IMPORT_BATCH_SIZE),
      processedRows: 0,
      totalRows: rowsToImport.length,
    });
    setStep("importing");
    try {
      const summary = await runBatchedImport(rowsToImport, {
        batchSize: IMPORT_BATCH_SIZE,
        commit: (batch) =>
          commitProductImport(
            batch.map((r) => ({
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
          ),
        onProgress: setImportProgress,
      });
      setImportSummary(summary);
      if (summary.errorCount === 0) {
        toast.success("Importación completada.");
      } else if (summary.newCount + summary.updateCount === 0) {
        toast.error("No se pudo importar ningún producto. Revisa el resumen de errores.");
      } else {
        toast.error(`${summary.errorCount} fila(s) no se importaron. Revisa el resumen de errores.`);
      }
    } catch (e) {
      // Red de seguridad: runBatchedImport ya captura los errores por
      // lote (transporte/Server Action/Supabase/RPC) y los deja en el
      // resumen — este catch solo cubre un fallo fuera de esa
      // orquestación. De cualquier forma, SIEMPRE termina en la pantalla
      // "done" con un mensaje visible: nunca más "clic Importar → nada".
      setImportFatalError(e instanceof Error ? e.message : "No se pudo completar la importación. Intenta de nuevo.");
      toast.error("No se pudo completar la importación. Intenta de nuevo.");
    } finally {
      setStep("done");
    }
  }

  function handleDownloadErrorReport() {
    if (!importSummary || importSummary.rowErrors.length === 0) return;
    const csv = buildErrorReportCsv(importSummary.rowErrors);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "errores-importacion-catalogo.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
                {rowErrors.slice(0, PREVIEW_LIST_LIMIT).map((e) => (
                  <li key={`${e.rowNumber}-${e.message}`}>{e.message}</li>
                ))}
              </ul>
              {rowErrors.length > PREVIEW_LIST_LIMIT && (
                <p className="mt-2 text-xs text-ink-faint">
                  Mostrando {PREVIEW_LIST_LIMIT} de {rowErrors.length}.
                </p>
              )}
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
                {newRows.slice(0, PREVIEW_LIST_LIMIT).map((r) => (
                  <li key={r.rowNumber} className="text-ink-soft">
                    Fila {r.rowNumber}: <span className="font-mono">{r.sku}</span> — {r.name} ·{" "}
                    <span className="text-ink-faint">{formatBusinessUnitCell(r.businessUnitNames)}</span>
                  </li>
                ))}
              </ul>
              {newRows.length > PREVIEW_LIST_LIMIT && (
                <p className="mt-2 text-xs text-ink-faint">
                  Mostrando {PREVIEW_LIST_LIMIT} de {newRows.length}.
                </p>
              )}
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
                {updateRows.slice(0, PREVIEW_LIST_LIMIT).map((r) => (
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
              {updateRows.length > PREVIEW_LIST_LIMIT && (
                <p className="mt-2 text-xs text-ink-faint">
                  Mostrando {PREVIEW_LIST_LIMIT} de {updateRows.length}.
                </p>
              )}
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
                {unchangedRows.slice(0, PREVIEW_LIST_LIMIT).map((r) => (
                  <li key={r.rowNumber}>
                    Fila {r.rowNumber}: <span className="font-mono">{r.sku}</span> — {r.name}
                  </li>
                ))}
              </ul>
              {unchangedRows.length > PREVIEW_LIST_LIMIT && (
                <p className="mt-2 text-xs text-ink-faint">
                  Mostrando {PREVIEW_LIST_LIMIT} de {unchangedRows.length}.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={hasBlockingErrors || rowsToImport.length === 0} onClick={handleConfirm}>
              Importar {rowsToImport.length} producto{rowsToImport.length === 1 ? "" : "s"}
            </Button>
            <Button type="button" variant="outline" onClick={resetToUpload}>
              <ArrowLeft className="h-4 w-4" />
              Elegir otro archivo
            </Button>
            {hasBlockingErrors && (
              <span className="text-xs text-danger">Corrige los errores antes de poder importar.</span>
            )}
          </div>
          {rowsToImport.length > IMPORT_BATCH_SIZE && (
            <p className="text-xs text-ink-faint">
              Se importará en lotes de {formatNumber(IMPORT_BATCH_SIZE)} productos (
              {Math.ceil(rowsToImport.length / IMPORT_BATCH_SIZE)} lotes en total).
            </p>
          )}
          <p className="text-xs text-ink-faint">
            Puedes volver a importar el mismo archivo cuando quieras: los productos existentes se actualizarán y no
            se duplicarán.
          </p>
        </div>
      </div>
    );
  }

  if (step === "importing") {
    const processedRows = importProgress?.processedRows ?? 0;
    const totalRowsToImport = importProgress?.totalRows ?? rowsToImport.length;
    const percent = totalRowsToImport > 0 ? Math.round((processedRows / totalRowsToImport) * 100) : 0;
    const totalBatches = importProgress?.totalBatches ?? Math.ceil(rowsToImport.length / IMPORT_BATCH_SIZE);
    // batchIndex empieza en 0 (antes de que termine el primer lote) — se
    // muestra como "Lote 1" mientras el primer lote está en curso, nunca
    // "Lote 0".
    const currentBatchDisplay = totalBatches === 0 ? 0 : Math.min(Math.max(importProgress?.batchIndex ?? 0, 1), totalBatches);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Importando catálogo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="flex items-center justify-between text-sm text-ink-soft">
            <span>
              {formatNumber(processedRows)} / {formatNumber(totalRowsToImport)}
            </span>
            <span>{percent}%</span>
          </div>
          <p className="text-xs text-ink-faint">
            Lote {currentBatchDisplay} de {totalBatches}
          </p>
          <p className="text-sm text-ink-faint">No cierres esta pestaña mientras se completa la importación.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importación completada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {importFatalError ? (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {importFatalError}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Procesados" value={importSummary?.totalRows ?? 0} />
              <Stat label="Nuevos" value={importSummary?.newCount ?? 0} />
              <Stat label="Actualizados" value={importSummary?.updateCount ?? 0} />
              <Stat label="Sin cambios" value={unchangedRows.length} />
              <Stat
                label="Errores"
                value={importSummary?.errorCount ?? 0}
                accent={importSummary && importSummary.errorCount > 0 ? "danger" : undefined}
              />
            </div>
            {importSummary && importSummary.errorCount > 0 && (
              <div className="space-y-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
                <p className="text-sm text-danger">
                  {importSummary.errorCount} fila{importSummary.errorCount === 1 ? "" : "s"} no se{" "}
                  {importSummary.errorCount === 1 ? "importó" : "importaron"}. Descarga el reporte, corrige esas filas
                  en el Excel y vuelve a subir el mismo archivo — lo ya importado no se duplicará.
                </p>
                <Button type="button" variant="outline" onClick={handleDownloadErrorReport}>
                  <Download className="h-4 w-4" />
                  Descargar reporte de errores (CSV)
                </Button>
              </div>
            )}
            <p className="text-xs text-ink-faint">
              Puedes volver a importar el mismo archivo cuando quieras: los productos existentes se actualizarán y no
              se duplicarán.
            </p>
          </>
        )}
        <div className="flex gap-2">
          <Link href="/configuracion/catalogo">
            <Button type="button">Ir al catálogo</Button>
          </Link>
          <Button type="button" variant="outline" onClick={resetToUpload}>
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
