import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { customerScopeWhere } from "@/lib/customers/scope";

import { AddContactForm } from "./add-contact-form";

const STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospecto",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
};

const DECISION_POWER_LABELS: Record<string, string> = {
  LOW: "Bajo",
  MEDIUM: "Medio",
  HIGH: "Alto",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const role = session.user.role;

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
    include: {
      businessUnit: { select: { code: true, name: true } },
      assignedSeller: { select: { fullName: true } },
      paymentTerms: { select: { name: true } },
      priceList: { select: { name: true } },
      contacts: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!customer) {
    notFound();
  }

  const canManage = hasPermission(role, PERMISSIONS.MANAGE_CUSTOMERS);
  const canAddContact = hasPermission(role, PERMISSIONS.CREATE_CUSTOMER);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/customers" className="text-sm text-zinc-500 hover:underline">
            ← Clientes
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {customer.legalName}
          </h1>
          <p className="text-sm text-zinc-500">
            {customer.businessUnit.code} · {customer.businessUnit.name} ·{" "}
            {STATUS_LABELS[customer.status]}
          </p>
        </div>
        {canManage ? (
          <Link
            href={`/customers/${customer.id}/edit`}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Editar
          </Link>
        ) : null}
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Información comercial
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Nombre comercial</dt>
            <dd>{customer.tradeName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">RFC</dt>
            <dd>{customer.taxId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Industria</dt>
            <dd>{customer.industry ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Segmento</dt>
            <dd>{customer.segment ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Vendedor asignado</dt>
            <dd>{customer.assignedSeller?.fullName ?? "Sin asignar"}</dd>
          </div>
          {canManage ? (
            <>
              <div>
                <dt className="text-zinc-500">Condiciones de pago</dt>
                <dd>{customer.paymentTerms?.name ?? "Sin definir"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Lista de precios</dt>
                <dd>{customer.priceList?.name ?? "Sin definir"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Línea de crédito</dt>
                <dd>
                  {customer.creditLimit.toNumber().toLocaleString("es-MX", {
                    style: "currency",
                    currency: "MXN",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Descuento autorizado</dt>
                <dd>{customer.authorizedDiscountPct.toString()}%</dd>
              </div>
            </>
          ) : null}
        </dl>
        {customer.notes ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{customer.notes}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Contactos ({customer.contacts.length})
        </h2>
        {customer.contacts.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-3">
            {customer.contacts.map((contact) => (
              <li
                key={contact.id}
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {contact.name}
                  {contact.position ? ` — ${contact.position}` : ""}
                </p>
                <p className="text-xs text-zinc-500">
                  {[contact.email, contact.phone, contact.whatsapp ? `WhatsApp: ${contact.whatsapp}` : null]
                    .filter(Boolean)
                    .join(" · ") || "Sin datos de contacto"}
                </p>
                {contact.decisionPower ? (
                  <p className="text-xs text-zinc-500">
                    Poder de decisión: {DECISION_POWER_LABELS[contact.decisionPower]}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Sin contactos registrados todavía.</p>
        )}

        {canAddContact ? (
          <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <AddContactForm customerId={customer.id} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
