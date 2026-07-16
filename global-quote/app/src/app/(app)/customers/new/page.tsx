import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

import { NewCustomerForm } from "./new-customer-form";

export default async function NewCustomerPage() {
  const session = await requireSession();
  const role = session.user.role;

  if (!hasPermission(role, PERMISSIONS.CREATE_CUSTOMER)) {
    redirect("/dashboard?error=forbidden");
  }

  const canManage = hasPermission(role, PERMISSIONS.MANAGE_CUSTOMERS);

  const assignedUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    include: { businessUnit: true },
  });

  if (assignedUnits.length === 0) {
    return (
      <div className="max-w-xl rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
        No tienes ninguna línea de negocio asignada todavía.
      </div>
    );
  }

  // Alcance basico: por ahora se crea en la primera linea asignada (GFB en
  // los datos demo). Selector multi-linea se agrega junto con el resto de
  // lineas de negocio con catalogo propio.
  const businessUnit = assignedUnits[0].businessUnit;

  const [sellers, paymentTerms, priceLists] = await Promise.all([
    canManage
      ? prisma.user.findMany({
          where: {
            role: { code: "VENDEDOR" },
            active: true,
            deletedAt: null,
            userBusinessUnits: { some: { businessUnitId: businessUnit.id } },
          },
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([]),
    canManage ? prisma.paymentTerms.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    canManage
      ? prisma.priceList.findMany({
          where: { businessUnitId: businessUnit.id, active: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/customers" className="text-sm text-zinc-500 hover:underline">
          ← Clientes
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Nuevo cliente</h1>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <NewCustomerForm
          businessUnitId={businessUnit.id}
          businessUnitLabel={`${businessUnit.code} — ${businessUnit.name}`}
          canManage={canManage}
          sellers={sellers}
          paymentTerms={paymentTerms}
          priceLists={priceLists}
        />
      </div>
    </div>
  );
}
