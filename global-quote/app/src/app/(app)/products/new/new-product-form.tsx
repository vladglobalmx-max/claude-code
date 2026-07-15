"use client";

import { useActionState } from "react";

import { createProductAction } from "../actions";
import { ProductCostPriceFields } from "../product-cost-price-fields";

export function NewProductForm({
  businessUnitId,
  businessUnitLabel,
  priceListId,
  priceListLabel,
  categories,
}: {
  businessUnitId: string;
  businessUnitLabel: string;
  priceListId: string;
  priceListLabel: string;
  categories: { id: string; name: string }[];
}) {
  const [errorMessage, formAction, isPending] = useActionState(createProductAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="businessUnitId" value={businessUnitId} />
      <input type="hidden" name="priceListId" value={priceListId} />

      <p className="text-sm text-zinc-500">
        Línea: <span className="font-semibold">{businessUnitLabel}</span> · Lista de precios:{" "}
        <span className="font-semibold">{priceListLabel}</span>
      </p>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          SKU interno *
          <input
            name="internalSku"
            required
            placeholder="GFB-XXX-001"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Categoría
          <select
            name="categoryId"
            defaultValue=""
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Nombre comercial *
        <input
          name="name"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Descripción corta
        <textarea
          name="shortDescription"
          rows={2}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Unidad de medida
          <input
            name="uom"
            defaultValue="PZA"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Estatus
          <select
            name="status"
            defaultValue="ACTIVE"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="DRAFT">Borrador</option>
            <option value="ACTIVE">Activo</option>
            <option value="DISCONTINUED">Descontinuado</option>
          </select>
        </label>
      </div>

      <ProductCostPriceFields
        defaults={{
          purchaseCost: "",
          logisticsCost: "0",
          importExpenses: "0",
          targetMarginPct: "",
          minMarginPct: "",
          listPrice: "",
        }}
      />

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
        {isPending ? "Guardando…" : "Crear producto"}
      </button>
    </form>
  );
}
