import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { customerScopeWhere } from "@/lib/customers/scope";

import { EditCustomerForm } from "./edit-customer-form";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const role = session.user.role;

  if (!hasPermission(role, PERMISSIONS.MANAGE_CUSTOMERS)) {
    redirect("/dashboard?error=forbidden");
  }

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const businessUnitIds = userBusinessUnits.map((ubu) => ubu.businessUnitId);
  const where = customerScopeWhere({ role, userId: session.user.id, businessUnitIds });
  if (!where) {
    notFound();
  }

  const customer = await prisma.customer.findFirst({
    where: { ...where, id },
    include: { businessUnit: true },
  });
  if (!customer) {
    notFound();
  }

  const [sellers, paymentTerms, priceLists] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: { code: "VENDEDOR" },
        active: true,
        deletedAt: null,
        userBusinessUnits: { some: { businessUnitId: customer.businessUnitId } },
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.paymentTerms.findMany({ orderBy: { name: "asc" } }),
    prisma.priceList.findMany({
      where: { businessUnitId: customer.businessUnitId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href={`/customers/${customer.id}`} className="text-sm text-zinc-500 hover:underline">
          ← {customer.legalName}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Editar cliente</h1>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <EditCustomerForm
          customerId={customer.id}
          businessUnitId={customer.businessUnitId}
          businessUnitLabel={`${customer.businessUnit.code} — ${customer.businessUnit.name}`}
          sellers={sellers}
          paymentTerms={paymentTerms}
          priceLists={priceLists}
          defaults={{
            legalName: customer.legalName,
            tradeName: customer.tradeName ?? "",
            taxId: customer.taxId ?? "",
            industry: customer.industry ?? "",
            segment: customer.segment ?? "",
            notes: customer.notes ?? "",
            assignedSellerId: customer.assignedSellerId ?? "",
            status: customer.status,
            paymentTermsId: customer.paymentTermsId ?? "",
            priceListId: customer.priceListId ?? "",
            creditLimit: customer.creditLimit.toString(),
            authorizedDiscountPct: customer.authorizedDiscountPct.toString(),
          }}
        />
      </div>
    </div>
  );
}
