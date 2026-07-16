import { issueTestFolioAction } from "./actions";

export function IssueTestFolioForm({
  businessUnits,
  defaults,
}: {
  businessUnits: { id: string; code: string; name: string }[];
  defaults: {
    businessUnitId: string;
    documentType: string;
    sellerCode: string;
    issueError?: string;
    issuedFolio?: string;
    issuedShortFolio?: string;
  };
}) {
  return (
    <form action={issueTestFolioAction} className="flex flex-col gap-4">
      <p className="text-xs text-zinc-500">
        Diagnóstico: emite un folio real (incrementa el consecutivo de verdad) para verificar el
        motor de folios antes de que exista el módulo de cotizaciones. No genera ningún documento.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Línea de negocio
          <select
            name="businessUnitId"
            defaultValue={defaults.businessUnitId || businessUnits[0]?.id}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {businessUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code} — {unit.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tipo de documento
          <select
            name="documentType"
            defaultValue={defaults.documentType || "QUOTATION"}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="QUOTATION">Cotización</option>
            <option value="ORDER">Pedido</option>
            <option value="CREDIT_NOTE">Nota de crédito</option>
            <option value="DELIVERY_NOTE">Remisión</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Código de vendedor
          <input
            name="sellerCode"
            defaultValue={defaults.sellerCode}
            maxLength={3}
            className="rounded-md border border-zinc-300 px-3 py-2 uppercase dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      {defaults.issueError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {defaults.issueError}
        </p>
      ) : null}
      {defaults.issuedFolio ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
          Folio emitido: <span className="font-mono font-semibold">{defaults.issuedFolio}</span> ·
          Folio corto:{" "}
          <span className="font-mono font-semibold">{defaults.issuedShortFolio}</span>
        </p>
      ) : null}

      <button
        type="submit"
        className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        Emitir folio de prueba
      </button>
    </form>
  );
}
