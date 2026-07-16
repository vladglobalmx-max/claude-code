"use client";

import { useActionState } from "react";

import { createCustomerAction } from "../actions";

export function NewCustomerForm({
  businessUnitId,
  businessUnitLabel,
  canManage,
  sellers,
  paymentTerms,
  priceLists,
}: {
  businessUnitId: string;
  businessUnitLabel: string;
  canManage: boolean;
  sellers: { id: string; fullName: string }[];
  paymentTerms: { id: string; name: string }[];
  priceLists: { id: string; name: string }[];
}) {
  const [errorMessage, formAction, isPending] = useActionState(createCustomerAction, undefined);

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
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Nombre comercial
          <input
            name="tradeName"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          RFC
          <input
            name="taxId"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Industria
          <input
            name="industry"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Segmento
          <input
            name="segment"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Notas
        <textarea
          name="notes"
          rows={2}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {canManage ? (
        <div className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Condiciones comerciales (solo Administración)
          </p>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Vendedor asignado
              <select
                name="assignedSellerId"
                defaultValue=""
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
                defaultValue="PROSPECT"
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
                defaultValue=""
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
                defaultValue=""
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
                defaultValue="0"
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
                defaultValue="0"
                className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          Este cliente quedará registrado como prospecto asignado a ti. Administración puede
          completar condiciones comerciales después (docs/ARCHITECTURE.md §4).
        </p>
      )}

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
        {isPending ? "Guardando…" : "Crear cliente"}
      </button>
    </form>
  );
}
