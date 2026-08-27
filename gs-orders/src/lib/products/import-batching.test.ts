import { describe, expect, it, vi } from "vitest";
import { buildErrorReportCsv, chunkRows, IMPORT_BATCH_SIZE, runBatchedImport, type BatchableRow } from "./import-batching";

function syntheticRows(n: number): BatchableRow[] {
  return Array.from({ length: n }, (_, i) => ({
    rowNumber: i + 1,
    sku: `JUNO-${String(i + 1).padStart(6, "0")}`,
    name: `Producto ${i + 1}`,
    classification: i % 5 === 0 ? "update" : "new",
  }));
}

describe("chunkRows", () => {
  it.each([
    [100, 500, 1],
    [500, 500, 1],
    [1000, 500, 2],
    [2500, 500, 5],
    [5397, 500, 11],
    [10000, 500, 20],
  ])("divide %i filas en %i por lote -> %i lotes", (total, batchSize, expectedBatches) => {
    const batches = chunkRows(syntheticRows(total), batchSize);
    expect(batches).toHaveLength(expectedBatches);
    expect(batches.reduce((sum, b) => sum + b.length, 0)).toBe(total);
  });

  it("5,397 filas -> el último lote tiene 397 filas, los otros 10 tienen 500", () => {
    const batches = chunkRows(syntheticRows(5397), 500);
    expect(batches).toHaveLength(11);
    expect(batches.slice(0, 10).every((b) => b.length === 500)).toBe(true);
    expect(batches[10]).toHaveLength(397);
  });

  it("lanza si batchSize <= 0", () => {
    expect(() => chunkRows(syntheticRows(10), 0)).toThrow();
  });

  it("IMPORT_BATCH_SIZE aprobado es 500", () => {
    expect(IMPORT_BATCH_SIZE).toBe(500);
  });
});

describe("runBatchedImport", () => {
  it("procesa 5,397 filas en 11 lotes SECUENCIALES (nunca en paralelo)", async () => {
    const rows = syntheticRows(5397);
    const callOrder: number[] = [];
    let concurrentCalls = 0;
    let maxConcurrentCalls = 0;

    const commit = vi.fn(async (batch: BatchableRow[]) => {
      concurrentCalls++;
      maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);
      callOrder.push(batch.length);
      await new Promise((r) => setTimeout(r, 0));
      concurrentCalls--;
      return { error: null };
    });

    const summary = await runBatchedImport(rows, { batchSize: 500, commit });

    expect(commit).toHaveBeenCalledTimes(11);
    expect(maxConcurrentCalls).toBe(1); // nunca Promise.all entre lotes
    expect(callOrder).toEqual([500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 397]);
    expect(summary.totalRows).toBe(5397);
    expect(summary.errorCount).toBe(0);
  });

  it("reporta progreso real por lote (batchIndex/totalBatches/processedRows/totalRows)", async () => {
    const rows = syntheticRows(1000);
    const progressSnapshots: { batchIndex: number; totalBatches: number; processedRows: number; totalRows: number }[] = [];

    await runBatchedImport(rows, {
      batchSize: 500,
      commit: async () => ({ error: null }),
      onProgress: (p) => progressSnapshots.push(p),
    });

    expect(progressSnapshots).toEqual([
      { batchIndex: 1, totalBatches: 2, processedRows: 500, totalRows: 1000 },
      { batchIndex: 2, totalBatches: 2, processedRows: 1000, totalRows: 1000 },
    ]);
  });

  it("cuenta correctamente nuevos vs actualizados en el resumen final", async () => {
    const rows = syntheticRows(10); // índices 0,5 -> update (2), resto -> new (8)
    const summary = await runBatchedImport(rows, { batchSize: 5, commit: async () => ({ error: null }) });

    expect(summary.newCount).toBe(8);
    expect(summary.updateCount).toBe(2);
    expect(summary.errorCount).toBe(0);
  });

  it("un lote con error ({ error }) se registra completo como error y NO detiene los lotes siguientes", async () => {
    const rows = syntheticRows(15);
    const commit = vi
      .fn()
      .mockResolvedValueOnce({ error: null }) // lote 1 (filas 1-5): OK
      .mockResolvedValueOnce({ error: "SKU duplicado en este lote." }) // lote 2 (filas 6-10): falla
      .mockResolvedValueOnce({ error: null }); // lote 3 (filas 11-15): OK, sí se ejecuta

    const summary = await runBatchedImport(rows, { batchSize: 5, commit });

    expect(commit).toHaveBeenCalledTimes(3); // continuó después del error
    expect(summary.errorCount).toBe(5);
    expect(summary.rowErrors.every((e) => e.message === "SKU duplicado en este lote.")).toBe(true);
    expect(summary.rowErrors.map((e) => e.rowNumber)).toEqual([6, 7, 8, 9, 10]);
    expect(summary.newCount + summary.updateCount).toBe(10); // 5 + 5 de los lotes exitosos
  });

  it("una excepción de transporte/Server Action en un lote también se captura y continúa (nunca silencioso)", async () => {
    const rows = syntheticRows(10);
    const commit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Body exceeded 1 MB limit."))
      .mockResolvedValueOnce({ error: null });

    const summary = await runBatchedImport(rows, { batchSize: 5, commit });

    expect(commit).toHaveBeenCalledTimes(2);
    expect(summary.errorCount).toBe(5);
    expect(summary.rowErrors[0]?.message).toBe("Body exceeded 1 MB limit.");
    expect(summary.newCount + summary.updateCount).toBe(5);
  });

  it("todos los lotes fallando produce un resumen 100% error sin lanzar", async () => {
    const rows = syntheticRows(20);
    const commit = vi.fn().mockResolvedValue({ error: "Falla de conexión." });

    const summary = await runBatchedImport(rows, { batchSize: 5, commit });

    expect(commit).toHaveBeenCalledTimes(4);
    expect(summary.errorCount).toBe(20);
    expect(summary.newCount + summary.updateCount).toBe(0);
  });

  it("reintentar (mismas filas, misma función) simplemente vuelve a llamar commit por lote — sin lógica de matching nueva", async () => {
    const rows = syntheticRows(6);
    const commit = vi.fn(async () => ({ error: null }));

    const first = await runBatchedImport(rows, { batchSize: 5, commit });
    const second = await runBatchedImport(rows, { batchSize: 5, commit });

    // Mismos lotes, mismo conteo de llamadas cada vez — el batching no
    // deduplica ni recuerda estado entre corridas; la idempotencia real
    // sigue viviendo enteramente en el upsert por SKU de
    // rpc_import_product_catalog (0030), sin tocar.
    expect(commit).toHaveBeenCalledTimes(4);
    expect(first).toEqual(second);
  });
});

describe("buildErrorReportCsv", () => {
  it("genera un CSV con fila,sku,nombre,mensaje y escapa comillas", () => {
    const csv = buildErrorReportCsv([
      { rowNumber: 6, sku: "JUNO-000006", name: 'Taza "Deluxe"', message: "Business Unit no existe." },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("fila,sku,nombre,mensaje");
    expect(lines[1]).toBe('6,"JUNO-000006","Taza ""Deluxe""","Business Unit no existe."');
  });

  it("sin errores produce solo el encabezado", () => {
    expect(buildErrorReportCsv([])).toBe("fila,sku,nombre,mensaje");
  });
});
