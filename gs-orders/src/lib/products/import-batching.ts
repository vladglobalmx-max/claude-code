/**
 * Batching del commit de importación del Catálogo Maestro (Fase 6C —
 * Fix escala) — puro, sin acceso a red ni a Supabase, para poder probar
 * chunking/progreso/manejo de errores sin backend. La llamada real a
 * Supabase (commitProductImport, un solo payload por lote) se inyecta
 * como función — este módulo solo orquesta la secuencia de lotes.
 *
 * DECISIÓN — por qué 500 filas por lote: medido en la auditoría previa,
 * un payload de ~500 filas (~230 KB con datos representativos) queda muy
 * por debajo del límite default de 1MB de los Next.js Server Actions
 * (que ~5,397 filas en un solo payload sí excede, ~2.4MB) — ver auditoría
 * "IMPORTACIÓN MASIVA DE PRODUCT CATALOG". rpc_import_product_catalog
 * (0030) no se modifica: sigue siendo atómico por lote (todo el lote se
 * revierte si cualquier fila del lote falla), solo se le llama varias
 * veces en vez de una.
 */
export const IMPORT_BATCH_SIZE = 500;

export function chunkRows<T>(rows: T[], batchSize: number): T[][] {
  if (batchSize <= 0) throw new Error("batchSize debe ser mayor a 0");
  const batches: T[][] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push(rows.slice(i, i + batchSize));
  }
  return batches;
}

export interface BatchImportProgress {
  batchIndex: number; // 1-based
  totalBatches: number;
  processedRows: number;
  totalRows: number;
}

export interface BatchRowError {
  rowNumber: number;
  sku: string;
  name: string;
  message: string;
}

export interface BatchImportSummary {
  totalRows: number;
  newCount: number;
  updateCount: number;
  errorCount: number;
  rowErrors: BatchRowError[];
}

export interface BatchableRow {
  rowNumber: number;
  sku: string;
  name: string;
  classification: "new" | "update" | "unchanged" | "error";
}

export interface BatchCommitResult {
  error: string | null;
}

/**
 * Procesa `rows` en lotes SECUENCIALES (nunca Promise.all entre lotes —
 * cada lote espera al anterior) llamando `commit` una vez por lote. Un
 * lote que falla (excepción de transporte/Server Action, o `{ error }`
 * devuelto por commitProductImport) se registra completo como error
 * (mismo mensaje para todas sus filas, porque el RPC revierte el lote
 * entero) y NO detiene los lotes siguientes — cada lote es una
 * transacción independiente, así que continuar es seguro.
 */
export async function runBatchedImport<TRow extends BatchableRow>(
  rows: TRow[],
  options: {
    batchSize: number;
    commit: (batch: TRow[]) => Promise<BatchCommitResult>;
    onProgress?: (progress: BatchImportProgress) => void;
  }
): Promise<BatchImportSummary> {
  const batches = chunkRows(rows, options.batchSize);
  const totalRows = rows.length;
  let processedRows = 0;
  let newCount = 0;
  let updateCount = 0;
  const rowErrors: BatchRowError[] = [];

  for (const [i, batch] of batches.entries()) {
    let batchErrorMessage: string | null = null;

    try {
      const result = await options.commit(batch);
      batchErrorMessage = result.error;
    } catch (e) {
      batchErrorMessage = e instanceof Error ? e.message : "Error inesperado al importar este lote.";
    }

    if (batchErrorMessage) {
      const message = batchErrorMessage;
      for (const row of batch) {
        rowErrors.push({ rowNumber: row.rowNumber, sku: row.sku, name: row.name, message });
      }
    } else {
      for (const row of batch) {
        if (row.classification === "new") newCount++;
        else if (row.classification === "update") updateCount++;
      }
    }

    processedRows += batch.length;
    options.onProgress?.({
      batchIndex: i + 1,
      totalBatches: batches.length,
      processedRows,
      totalRows,
    });
  }

  return { totalRows, newCount, updateCount, errorCount: rowErrors.length, rowErrors };
}

/** CSV de errores para descarga — fila, SKU, nombre, mensaje (pedido explícito de la auditoría). */
export function buildErrorReportCsv(rowErrors: BatchRowError[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = ["fila", "sku", "nombre", "mensaje"].join(",");
  const lines = rowErrors.map((e) => [e.rowNumber, escape(e.sku), escape(e.name), escape(e.message)].join(","));
  return [header, ...lines].join("\n");
}
