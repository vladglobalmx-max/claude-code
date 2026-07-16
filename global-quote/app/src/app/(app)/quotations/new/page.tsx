import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { customerScopeWhere } from "@/lib/customers/scope";
import { defaultQuotationValidUntil } from "@/lib/quotations/dates";

import { NewQuotationForm } from "./new-quotation-form";

export default async function NewQuotationPage() {
  const session = await requireSession();
  const role = session.user.role;

  if (!hasPermission(role, PERMISSIONS.CREATE_QUOTATION)) {
    redirect("/dashboard?error=forbidden");
  }

  const assignedUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    include: {
      businessUnit: { include: { priceLists: { where: { active: true }, take: 1 } } },
    },
  });
  const unitsWithPriceList = assignedUnits
    .map((assignment) => assignment.businessUnit)
    .filter((unit) => unit.priceLists.length > 0);

  if (unitsWithPriceList.length === 0) {
    return (
      <div className="max-w-xl rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
        Ninguna de tus líneas de negocio tiene una lista de precios activa todavía.
      </div>
    );
  }
  const businessUnit = unitsWithPriceList[0];

  const businessUnitIds = assignedUnits.map((assignment) => assignment.businessUnitId);
  const customerWhere = customerScopeWhere({ role, userId: session.user.id, businessUnitIds });
  const customers = customerWhere
    ? await prisma.customer.findMany({
        where: { ...customerWhere, businessUnitId: businessUnit.id },
        select: { id: true, legalName: true, tradeName: true },
        orderBy: { legalName: "asc" },
      })
    : [];

  if (customers.length === 0) {
    return (
      <div className="max-w-xl rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
        No tienes clientes disponibles en {businessUnit.code} todavía. Da de alta uno desde{" "}
        <Link href="/customers/new" className="underline">
          Clientes
        </Link>
        .
      </div>
    );
  }

  const defaultValidUntil = defaultQuotationValidUntil();

  const taxes = await prisma.tax.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true, ratePct: true },
    orderBy: { code: "asc" },
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/quotations" className="text-sm text-zinc-500 hover:underline">
          ← Cotizaciones
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Nueva cotización
        </h1>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <NewQuotationForm
          businessUnitId={businessUnit.id}
          businessUnitLabel={`${businessUnit.code} — ${businessUnit.name}`}
          customers={customers}
          taxes={taxes.map((tax) => ({ ...tax, ratePct: tax.ratePct.toString() }))}
          defaultValidUntil={defaultValidUntil}
        />
      </div>
    </div>
  );
}
