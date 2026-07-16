"use client";

import { useActionState } from "react";

import { addQuotationItemAction } from "../actions";

export function AddQuotationItemForm({
  quotationId,
  products,
}: {
  quotationId: string;
  products: { id: string; internalSku: string; name: string }[];
}) {
  const boundAction = addQuotationItemAction.bind(null, quotationId);
  const [errorMessage, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-3">
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          Producto
          <select
            name="productId"
            required
            defaultValue=""
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              Selecciona un producto
            </option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.internalSku} — {product.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Cantidad
          <input
            name="qty"
            type="number"
            min="1"
            step="1"
            defaultValue="1"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Descuento (%)
          <input
            name="discountPct"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue="0"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        {isPending ? "Agregando…" : "+ Agregar producto"}
      </button>
    </form>
  );
}
