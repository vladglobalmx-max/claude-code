"use client";

import { useActionState } from "react";

import { updateProductAction } from "../../actions";
import { ProductCostPriceFields } from "../../product-cost-price-fields";

export function EditProductForm({
  productId,
  businessUnitLabel,
  priceListId,
  priceListLabel,
  categories,
  defaults,
}: {
  productId: string;
  businessUnitLabel: string;
  priceListId: string;
  priceListLabel: string;
  categories: { id: string; name: string }[];
  defaults: {
    categoryId: string;
    name: string;
    shortDescription: string;
    uom: string;
    status: string;
    purchaseCost: string;
    logisticsCost: string;
    importExpenses: string;
    targetMarginPct: string;
    minMarginPct: string;
    listPrice: string;
  };
}) {
  const boundAction = updateProductAction.bind(null, productId);
  const [errorMessage, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="priceListId" value={priceListId} />

      <p className="text-sm text-zinc-500">
        Línea: <span className="font-semibold">{businessUnitLabel}</span> · Lista de precios:{" "}
        <span className="font-semibold">{priceListLabel}</span>
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Categoría
        <select
          name="categoryId"
          defaultValue={defaults.categoryId}
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

      <label className="flex flex-col gap-1 text-sm">
        Nombre comercial *
        <input
          name="name"
          required
          defaultValue={defaults.name}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Descripción corta
        <textarea
          name="shortDescription"
          rows={2}
          defaultValue={defaults.shortDescription}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Unidad de medida
          <input
            name="uom"
            defaultValue={defaults.uom}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Estatus
          <select
            name="status"
            defaultValue={defaults.status}
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
          purchaseCost: defaults.purchaseCost,
          logisticsCost: defaults.logisticsCost,
          importExpenses: defaults.importExpenses,
          targetMarginPct: defaults.targetMarginPct,
          minMarginPct: defaults.minMarginPct,
          listPrice: defaults.listPrice,
        }}
      />

      <p className="text-xs text-zinc-500">
        Guardar un nuevo costo cierra la vigencia actual y crea una nueva — el historial de costos
        se conserva completo (docs/ARCHITECTURE.md §7.3).
      </p>

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
