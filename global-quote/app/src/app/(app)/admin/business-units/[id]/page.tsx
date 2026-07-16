import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

import { EditBusinessUnitForm } from "./edit-business-unit-form";
import { AddBankAccountForm } from "./add-bank-account-form";
import { ReplaceTermsForm } from "./replace-terms-form";
import { toggleBankAccountActiveAction } from "../actions";

export default async function BusinessUnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CONFIGURE_BUSINESS_UNITS)) {
    redirect("/dashboard?error=forbidden");
  }

  const businessUnit = await prisma.businessUnit.findUnique({
    where: { id },
    include: {
      bankAccounts: { orderBy: { createdAt: "asc" } },
      termsAndConditions: {
        where: { effectiveTo: null },
        take: 1,
      },
    },
  });
  if (!businessUnit) {
    notFound();
  }

  const termsHistory = await prisma.termsAndConditions.findMany({
    where: { businessUnitId: id, effectiveTo: { not: null } },
    orderBy: { effectiveFrom: "desc" },
    include: { createdBy: { select: { fullName: true } } },
  });

  const currentTerms = businessUnit.termsAndConditions[0];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/admin/business-units" className="text-sm text-zinc-500 hover:underline">
          ← Líneas de negocio
        </Link>
        <h1 className="mt-1 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {businessUnit.code}
        </h1>
        <p className="text-sm text-zinc-500">{businessUnit.name}</p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Datos generales y fiscales
        </h2>
        <EditBusinessUnitForm
          businessUnitId={businessUnit.id}
          defaults={{
            name: businessUnit.name,
            legalName: businessUnit.legalName ?? "",
            taxId: businessUnit.taxId ?? "",
            address: businessUnit.address ?? "",
            colorPrimary: businessUnit.colorPrimary ?? "",
            colorSecondary: businessUnit.colorSecondary ?? "",
            minMarginDefault: businessUnit.minMarginDefault?.toString() ?? "",
            folioNumberingMode: businessUnit.folioNumberingMode,
            active: businessUnit.active,
          }}
        />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Cuentas bancarias
        </h2>

        {businessUnit.bankAccounts.length > 0 ? (
          <ul className="mb-4 flex flex-col gap-2">
            {businessUnit.bankAccounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {account.bankName} · {account.currency}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {account.accountHolder} — cuenta {account.accountNumber}
                    {account.clabe ? ` · CLABE ${account.clabe}` : ""}
                  </p>
                </div>
                <form
                  action={toggleBankAccountActiveAction.bind(
                    null,
                    businessUnit.id,
                    account.id,
                    !account.active,
                  )}
                >
                  <button
                    type="submit"
                    className={
                      account.active
                        ? "text-xs text-red-600 hover:underline dark:text-red-400"
                        : "text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                    }
                  >
                    {account.active ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-zinc-500">Sin cuentas bancarias registradas.</p>
        )}

        <AddBankAccountForm businessUnitId={businessUnit.id} />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Términos y condiciones
        </h2>
        <ReplaceTermsForm
          key={currentTerms?.id ?? "none"}
          businessUnitId={businessUnit.id}
          currentContent={currentTerms?.content ?? ""}
        />

        {termsHistory.length > 0 ? (
          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Versiones anteriores
            </p>
            <ul className="flex flex-col gap-2">
              {termsHistory.map((version) => (
                <li key={version.id} className="text-xs text-zinc-500">
                  Vigente del {version.effectiveFrom.toLocaleDateString("es-MX")} al{" "}
                  {version.effectiveTo?.toLocaleDateString("es-MX")} — guardada por{" "}
                  {version.createdBy.fullName}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
