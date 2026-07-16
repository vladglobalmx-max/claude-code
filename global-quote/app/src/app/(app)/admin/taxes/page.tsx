import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

import { NewTaxForm } from "./new-tax-form";
import { toggleTaxActiveAction } from "./actions";

export default async function TaxesPage() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CONFIGURE_BUSINESS_UNITS)) {
    redirect("/dashboard?error=forbidden");
  }

  const taxes = await prisma.tax.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Impuestos</h1>
        <p className="text-sm text-zinc-500">
          Módulo 2 — ver docs/ARCHITECTURE.md §5.2. Catálogo global (no por línea de negocio);
          aplicarlos a una cotización queda fuera de este alcance.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <NewTaxForm />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Tasa</th>
              <th className="px-4 py-2">Estatus</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {taxes.map((tax) => (
              <tr key={tax.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                <td className="px-4 py-2 font-mono font-semibold">{tax.code}</td>
                <td className="px-4 py-2">{tax.name}</td>
                <td className="px-4 py-2">{tax.ratePct.toString()}%</td>
                <td className="px-4 py-2">
                  {tax.active ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Activo</span>
                  ) : (
                    <span className="text-zinc-400">Inactivo</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <form action={toggleTaxActiveAction.bind(null, tax.id, !tax.active)}>
                    <button
                      type="submit"
                      className={
                        tax.active
                          ? "text-xs text-red-600 hover:underline dark:text-red-400"
                          : "text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                      }
                    >
                      {tax.active ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
