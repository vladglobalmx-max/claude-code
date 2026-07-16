"use client";

import { useActionState } from "react";

import { confirmImportAction, previewImportAction, type ImportPreview } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  creatable: "Se creará",
  duplicate: "Duplicado — se omite",
  error: "Error",
};

const STATUS_STYLES: Record<string, string> = {
  creatable: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
  duplicate: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export function ImportForm({
  businessUnits,
}: {
  businessUnits: { id: string; code: string; name: string }[];
}) {
  const [previewState, previewFormAction, isPreviewing] = useActionState(previewImportAction, undefined);
  const [confirmState, confirmFormAction, isConfirming] = useActionState(confirmImportAction, undefined);

  const preview: ImportPreview | null = previewState && "preview" in previewState ? previewState.preview : null;
  const previewError = previewState && "error" in previewState ? previewState.error : null;
  const confirmResult = confirmState && "result" in confirmState ? confirmState.result : null;
  const confirmError = confirmState && "error" in confirmState ? confirmState.error : null;

  if (confirmResult) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
        <p className="font-semibold">Importación completada.</p>
        <p className="mt-1">
          {confirmResult.createdCount} de {confirmResult.totalRows} fila(s) creadas
          {confirmResult.skippedDuplicateCount > 0
            ? ` · ${confirmResult.skippedDuplicateCount} duplicada(s) omitida(s)`
            : ""}
          .
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium hover:bg-emerald-100 dark:border-emerald-900 dark:hover:bg-emerald-900"
        >
          Nueva importación
        </button>
      </div>
    );
  }

  if (preview) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
          <p>
            <span className="font-semibold">{preview.fileName}</span> · {preview.businessUnitCode} ·{" "}
            {preview.rows.length} fila(s): {preview.creatableCount} se crearán
            {preview.duplicateCount > 0 ? `, ${preview.duplicateCount} duplicada(s)` : ""}
            {preview.errorCount > 0 ? `, ${preview.errorCount} con error` : ""}.
          </p>
          {preview.errorCount > 0 ? (
            <p className="mt-1 font-medium text-red-600 dark:text-red-400">
              Hay filas con error: no se puede confirmar esta importación (todo o nada). Corrige el
              archivo y vuelve a subirlo.
            </p>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2">Fila</th>
                <th className="px-3 py-2">{preview.entityType === "PRODUCT" ? "SKU" : "Razón social"}</th>
                <th className="px-3 py-2">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.rowNumber} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-3 py-2 text-zinc-500">{row.rowNumber}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.label}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
                      {STATUS_LABELS[row.status]}
                    </span>
                    {row.message ? <span className="ml-2 text-xs text-zinc-500">{row.message}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2">
          <form action={confirmFormAction}>
            <input type="hidden" name="entityType" value={preview.entityType} />
            <input type="hidden" name="businessUnitId" value={preview.businessUnitId} />
            <input type="hidden" name="businessUnitCode" value={preview.businessUnitCode} />
            <input type="hidden" name="fileName" value={preview.fileName} />
            <input type="hidden" name="csvText" value={preview.csvText} />
            <button
              type="submit"
              disabled={isConfirming || preview.errorCount > 0 || preview.creatableCount === 0}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isConfirming ? "Importando…" : "Confirmar importación"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Cancelar
          </button>
          {confirmError ? (
            <p role="alert" className="self-center text-sm text-red-600 dark:text-red-400">
              {confirmError}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form action={previewFormAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Tipo de importación
          <select
            name="entityType"
            defaultValue="PRODUCT"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="PRODUCT">Productos</option>
            <option value="CUSTOMER">Clientes</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Línea de negocio
          <select
            name="businessUnitId"
            defaultValue=""
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              Selecciona…
            </option>
            {businessUnits.map((bu) => (
              <option key={bu.id} value={bu.id}>
                {bu.code} — {bu.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Archivo CSV
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      {previewError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {previewError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPreviewing}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPreviewing ? "Analizando…" : "Vista previa"}
      </button>
    </form>
  );
}
