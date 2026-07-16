import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { quotationScopeWhere } from "@/lib/quotations/scope";

import { AddQuotationItemForm } from "./add-quotation-item-form";
import { SubmitQuotationForm } from "./submit-quotation-form";
import { AddFollowupForm } from "./add-followup-form";
import { QuotationDecisionForm } from "./quotation-decision-form";
import { removeQuotationItemAction, convertQuotationToOrderAction } from "../actions";
import { APPROVAL_RULE_LABELS } from "@/lib/quotations/approval-rules";
import { QUOTATION_STATUS_LABELS } from "@/lib/quotations/status-labels";
import { canGenerateQuotationPdf } from "@/lib/quotations/pdf-gate";
import { displayFolio } from "@/lib/folio/format";
import { computeWeightedAmount } from "@/lib/followups/rules";

const DECISION_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

const CONTACT_METHOD_LABELS: Record<string, string> = {
  EMAIL: "Correo",
  PHONE: "Teléfono",
  WHATSAPP: "WhatsApp",
  IN_PERSON: "En persona",
  OTHER: "Otro",
};

/** Forma del snapshot congelado en `quotation_versions.snapshot` (Módulo 8) — la escribe únicamente `freezeQuotationVersionSnapshot` en `lib/quotations/mutations.ts`. */
type QuotationVersionSnapshot = {
  status: string;
  total: string;
  requiresApproval: boolean;
  items: { description: string; qty: number }[];
};

const currency = (value: number, code: string) =>
  value.toLocaleString("es-MX", { style: "currency", currency: code });

export default async function QuotationDetailPage({
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
  const where = quotationScopeWhere({ role, userId: session.user.id, businessUnitIds });
  if (!where) {
    notFound();
  }

  const quotation = await prisma.quotation.findFirst({
    where: { ...where, id },
    include: {
      businessUnit: { select: { code: true, name: true } },
      customer: { select: { legalName: true, tradeName: true } },
      seller: { select: { fullName: true } },
      order: { select: { id: true, folio: true } },
      items: {
        include: { product: { select: { internalSku: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      approvals: {
        include: {
          requestedBy: { select: { fullName: true } },
          approver: { select: { fullName: true } },
        },
        orderBy: { requestedAt: "desc" },
      },
      versions: {
        include: { createdBy: { select: { fullName: true } } },
        orderBy: { versionNumber: "desc" },
      },
      followups: {
        include: { owner: { select: { fullName: true } } },
        orderBy: { sentAt: "desc" },
      },
    },
  });
  if (!quotation) {
    notFound();
  }

  const canAddFollowup = quotation.status === "SENT" && hasPermission(role, PERMISSIONS.CREATE_QUOTATION);
  const canRecordDecision =
    quotation.status === "SENT" && hasPermission(role, PERMISSIONS.CREATE_QUOTATION);
  const canConvertToOrder =
    quotation.status === "ACCEPTED" && hasPermission(role, PERMISSIONS.CONVERT_TO_ORDER);
  const canEditAfterSend =
    (quotation.status === "SENT" || quotation.status === "ACCEPTED") &&
    hasPermission(role, PERMISSIONS.EDIT_APPROVED_QUOTATION);
  const canManageItems =
    (quotation.status === "DRAFT" && hasPermission(role, PERMISSIONS.CREATE_QUOTATION)) ||
    canEditAfterSend;
  const canViewMarginPct =
    hasPermission(role, PERMISSIONS.VIEW_COSTS) || hasPermission(role, PERMISSIONS.VIEW_MARGIN_PCT);
  const canDownloadPdf =
    hasPermission(role, PERMISSIONS.GENERATE_PDF) && canGenerateQuotationPdf(quotation.status);

  let availableProducts: { id: string; internalSku: string; name: string }[] = [];
  if (canManageItems) {
    availableProducts = await prisma.product.findMany({
      where: { businessUnitId: quotation.businessUnitId, status: "ACTIVE", deletedAt: null },
      select: { id: true, internalSku: true, name: true },
      orderBy: { internalSku: "asc" },
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/quotations" className="text-sm text-zinc-500 hover:underline">
            ← Cotizaciones
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {displayFolio(quotation.folio, quotation.currentVersion)}
          </h1>
          <p className="text-sm text-zinc-500">
            {quotation.businessUnit.code} · {quotation.customer.legalName} · Vendedor:{" "}
            {quotation.seller.fullName} · {QUOTATION_STATUS_LABELS[quotation.status]}
          </p>
        </div>
        {canDownloadPdf ? (
          <a
            href={`/quotations/${quotation.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Descargar PDF
          </a>
        ) : null}
      </div>

      {quotation.requiresApproval ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          <p className="font-semibold">Requiere autorización</p>
          <p>{quotation.approvalReason}</p>
        </div>
      ) : null}

      {canEditAfterSend ? (
        <div className="rounded-md border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-400">
          Esta cotización ya fue enviada. Agregar o quitar productos aquí congela el estado actual
          como Versión {quotation.currentVersion} y crea la Versión {quotation.currentVersion + 1}{" "}
          (docs/ARCHITECTURE.md §7.3) — el folio raíz nunca cambia.
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Productos</h2>

        {quotation.items.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Sin productos agregados todavía.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="py-2 pr-3">Producto</th>
                  <th className="py-2 pr-3">Cant.</th>
                  <th className="py-2 pr-3">Precio</th>
                  <th className="py-2 pr-3">Desc.</th>
                  <th className="py-2 pr-3">Importe</th>
                  {canManageItems ? <th className="py-2 pr-3" /> : null}
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{item.product.name}</p>
                      <p className="font-mono text-xs text-zinc-500">{item.product.internalSku}</p>
                    </td>
                    <td className="py-2 pr-3">{item.qty}</td>
                    <td className="py-2 pr-3">{currency(item.unitPrice.toNumber(), quotation.currency)}</td>
                    <td className="py-2 pr-3">{item.discountPct.toString()}%</td>
                    <td className="py-2 pr-3 font-semibold">
                      {currency(item.lineTotal.toNumber(), quotation.currency)}
                    </td>
                    {canManageItems ? (
                      <td className="py-2 pr-3">
                        <form action={removeQuotationItemAction.bind(null, quotation.id, item.id)}>
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:underline dark:text-red-400"
                          >
                            Quitar
                          </button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800 sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500">Subtotal</dt>
            <dd>{currency(quotation.subtotal.toNumber(), quotation.currency)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Descuento</dt>
            <dd>{currency(quotation.discountTotal.toNumber(), quotation.currency)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Total</dt>
            <dd className="font-semibold">{currency(quotation.total.toNumber(), quotation.currency)}</dd>
          </div>
          {canViewMarginPct ? (
            <div>
              <dt className="text-zinc-500">Margen</dt>
              <dd
                className={
                  quotation.requiresApproval
                    ? "font-semibold text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }
              >
                {quotation.marginPct != null ? `${quotation.marginPct.toString()}%` : "—"}
              </dd>
            </div>
          ) : null}
        </dl>

        {canManageItems ? (
          <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <AddQuotationItemForm quotationId={quotation.id} products={availableProducts} />
          </div>
        ) : null}
      </section>

      {quotation.status === "DRAFT" && quotation.items.length > 0 ? (
        <SubmitQuotationForm quotationId={quotation.id} requiresApproval={quotation.requiresApproval} />
      ) : null}

      {canRecordDecision ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Decisión del cliente
          </h2>
          <div className="mt-3">
            <QuotationDecisionForm quotationId={quotation.id} />
          </div>
        </section>
      ) : null}

      {quotation.status === "ACCEPTED" ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Pedido</h2>
          {canConvertToOrder ? (
            <form action={convertQuotationToOrderAction.bind(null, quotation.id)} className="mt-3">
              <button
                type="submit"
                className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
              >
                Convertir a pedido
              </button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              Cotización aceptada, lista para convertirse en pedido. Tu rol no tiene permiso para
              convertirla.
            </p>
          )}
        </section>
      ) : null}

      {quotation.order ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Pedido</h2>
          <p className="mt-2 text-sm">
            Esta cotización se convirtió en el pedido{" "}
            <Link href={`/orders/${quotation.order.id}`} className="font-mono text-sky-600 hover:underline dark:text-sky-400">
              {quotation.order.folio}
            </Link>
            .
          </p>
        </section>
      ) : null}

      {quotation.approvals.length > 0 ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Historial de autorizaciones
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {quotation.approvals.map((approval) => (
              <li
                key={approval.id}
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {APPROVAL_RULE_LABELS[approval.ruleType]} — {DECISION_LABELS[approval.decision]}
                </p>
                <p className="text-xs text-zinc-500">
                  Solicitada por {approval.requestedBy.fullName} el{" "}
                  {approval.requestedAt.toLocaleString("es-MX")}
                </p>
                {approval.justification ? (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    Justificación: {approval.justification}
                  </p>
                ) : null}
                {approval.decision !== "PENDING" ? (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {DECISION_LABELS[approval.decision]} por {approval.approver?.fullName} el{" "}
                    {approval.decidedAt?.toLocaleString("es-MX")}
                    {approval.decisionNote ? ` — ${approval.decisionNote}` : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {quotation.versions.length > 0 ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Historial de versiones
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Versión actual (viva, editable): {quotation.currentVersion}.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {quotation.versions.map((version) => {
              const snapshot = version.snapshot as unknown as QuotationVersionSnapshot;
              return (
                <li
                  key={version.id}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    Versión {version.versionNumber} (congelada) —{" "}
                    {currency(Number(snapshot.total), quotation.currency)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {snapshot.items.length} producto(s) · Editada por {version.createdBy.fullName}{" "}
                    el {version.createdAt.toLocaleString("es-MX")}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {canAddFollowup || quotation.followups.length > 0 ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Seguimiento</h2>

          {canAddFollowup ? (
            <div className="mt-3">
              <AddFollowupForm quotationId={quotation.id} />
            </div>
          ) : null}

          {quotation.followups.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              {quotation.followups.map((followup) => {
                const weighted = computeWeightedAmount(quotation.total, followup.closeProbabilityPct);
                return (
                  <li
                    key={followup.id}
                    className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                  >
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {CONTACT_METHOD_LABELS[followup.contactMethod]} — {followup.owner.fullName} el{" "}
                      {followup.sentAt.toLocaleString("es-MX")}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {followup.nextFollowupAt
                        ? `Próximo seguimiento: ${followup.nextFollowupAt.toLocaleDateString("es-MX")}`
                        : "Sin próximo seguimiento programado"}
                      {followup.closeProbabilityPct != null
                        ? ` · Probabilidad de cierre: ${followup.closeProbabilityPct.toString()}%`
                        : ""}
                      {weighted != null
                        ? ` · Ponderado: ${currency(weighted.toNumber(), quotation.currency)}`
                        : ""}
                    </p>
                    {followup.competitor ? (
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        Competidor mencionado: {followup.competitor}
                      </p>
                    ) : null}
                    {followup.objection ? (
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        Objeción: {followup.objection}
                      </p>
                    ) : null}
                    {followup.comments ? (
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{followup.comments}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
