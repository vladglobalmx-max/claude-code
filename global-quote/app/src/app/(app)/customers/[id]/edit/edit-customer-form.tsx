"use client";

import { useActionState } from "react";

import { updateCustomerAction } from "../../actions";

export function EditCustomerForm({
  customerId,
  businessUnitId,
  businessUnitLabel,
  sellers,
  paymentTerms,
  priceLists,
  defaults,
}: {
  customerId: string;
  businessUnitId: string;
  businessUnitLabel: string;
  sellers: { id: string; fullName: string }[];
  paymentTerms: { id: string; name: string }[];
  priceLists: { id: string; name: string }[];
  defaults: {
    legalName: string;
    tradeName: string;
    taxId: string;
    industry: string;
    segment: string;
    notes: string;
    assignedSellerId: string;
    status: string;
    paymentTermsId: string;
    priceListId: string;
    creditLimit: string;
    authorizedDiscountPct: string;
  };
}) {
  const boundAction = updateCustomerAction.bind(null, customerId);
  const [errorMessage, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="businessUnitId" value={businessUnitId} />

      <p className="text-sm text-zinc-500">
        Línea: <span className="font-semibold">{businessUnitLabel}</span>
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Razón social *
        <input
          name="legalName"
          required
          defaultValue={defaults.legalName}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Nombre comercial
          <input
            name="tradeName"
            defaultValue={defaults.tradeName}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          RFC
          <input
            name="taxId"
            defaultValue={defaults.taxId}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Industria
          <input
            name="industry"
            defaultValue={defaults.industry}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Segmento
          <input
            name="segment"
            defaultValue={defaults.segment}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Notas
        <textarea
          name="notes"
          rows={2}
          defaultValue={defaults.notes}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Condiciones comerciales
        </p>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Vendedor asignado
            <select
              name="assignedSellerId"
              defaultValue={defaults.assignedSellerId}
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Sin asignar</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Estatus
            <select
              name="status"
              defaultValue={defaults.status}
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="PROSPECT">Prospecto</option>
              <option value="ACTIVE">Activo</option>
              <option value="INACTIVE">Inactivo</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Condiciones de pago
            <select
              name="paymentTermsId"
              defaultValue={defaults.paymentTermsId}
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Sin definir</option>
              {paymentTerms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Lista de precios
            <select
              name="priceListId"
              defaultValue={defaults.priceListId}
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Sin definir</option>
              {priceLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Línea de crédito
            <input
              name="creditLimit"
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaults.creditLimit}
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Descuento autorizado (%)
            <input
              name="authorizedDiscountPct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={defaults.authorizedDiscountPct}
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
