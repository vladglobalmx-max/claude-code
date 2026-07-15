"use client";

import { useMemo, useState } from "react";

import {
  computeLandedCost,
  computeMarginPctFromSalePrice,
  computeSalePriceFromMargin,
} from "@/lib/catalog/margin";

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function ProductCostPriceFields({
  defaults,
}: {
  defaults: {
    purchaseCost: string;
    logisticsCost: string;
    importExpenses: string;
    targetMarginPct: string;
    minMarginPct: string;
    listPrice: string;
  };
}) {
  const [values, setValues] = useState(defaults);

  const update = (field: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [field]: event.target.value }));

  const { landedCost, suggestedPrice, actualMarginPct, belowMin } = useMemo(() => {
    const purchaseCost = toNumber(values.purchaseCost);
    const logisticsCost = toNumber(values.logisticsCost) ?? 0;
    const importExpenses = toNumber(values.importExpenses) ?? 0;
    const targetMarginPct = toNumber(values.targetMarginPct);
    const minMarginPct = toNumber(values.minMarginPct);
    const listPrice = toNumber(values.listPrice);

    if (purchaseCost === null) {
      return { landedCost: null, suggestedPrice: null, actualMarginPct: null, belowMin: false };
    }

    const landed = computeLandedCost({ purchaseCost, logisticsCost, importExpenses });

    let suggested: string | null = null;
    if (targetMarginPct !== null && targetMarginPct < 100) {
      try {
        suggested = computeSalePriceFromMargin({ landedCost: landed, marginPct: targetMarginPct })
          .toDecimalPlaces(2)
          .toString();
      } catch {
        suggested = null;
      }
    }

    let actual: string | null = null;
    let below = false;
    if (listPrice !== null && listPrice > 0) {
      const marginPct = computeMarginPctFromSalePrice({ landedCost: landed, salePrice: listPrice });
      actual = marginPct.toDecimalPlaces(2).toString();
      if (minMarginPct !== null) {
        below = marginPct.lessThan(minMarginPct);
      }
    }

    return {
      landedCost: landed.toDecimalPlaces(2).toString(),
      suggestedPrice: suggested,
      actualMarginPct: actual,
      belowMin: below,
    };
  }, [values]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Costo de compra *
          <input
            name="purchaseCost"
            type="number"
            step="0.0001"
            min="0"
            required
            value={values.purchaseCost}
            onChange={update("purchaseCost")}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Costo logístico
          <input
            name="logisticsCost"
            type="number"
            step="0.0001"
            min="0"
            value={values.logisticsCost}
            onChange={update("logisticsCost")}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Gastos de importación
          <input
            name="importExpenses"
            type="number"
            step="0.0001"
            min="0"
            value={values.importExpenses}
            onChange={update("importExpenses")}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Margen objetivo (%) *
          <input
            name="targetMarginPct"
            type="number"
            step="0.01"
            min="0"
            max="99.99"
            required
            value={values.targetMarginPct}
            onChange={update("targetMarginPct")}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Margen mínimo (%) *
          <input
            name="minMarginPct"
            type="number"
            step="0.01"
            min="0"
            max="99.99"
            required
            value={values.minMarginPct}
            onChange={update("minMarginPct")}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Precio de lista *
          <input
            name="listPrice"
            type="number"
            step="0.01"
            min="0"
            required
            value={values.listPrice}
            onChange={update("listPrice")}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p>
          Costo aterrizado: <span className="font-semibold">{landedCost ?? "—"}</span>
          {suggestedPrice ? (
            <>
              {" "}
              · Precio sugerido al margen objetivo:{" "}
              <span className="font-semibold">${suggestedPrice}</span>
            </>
          ) : null}
        </p>
        {actualMarginPct ? (
          <p
            className={
              belowMin
                ? "mt-1 font-semibold text-red-600 dark:text-red-400"
                : "mt-1 text-emerald-600 dark:text-emerald-400"
            }
          >
            Margen resultante del precio de lista: {actualMarginPct}%
            {belowMin ? " — por debajo del mínimo, requeriría autorización de Dirección General ⚠" : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
