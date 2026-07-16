"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import {
  addQuotationItem,
  createQuotationDraft,
  QuotationMutationError,
  removeQuotationItem,
  submitQuotation,
} from "@/lib/quotations/mutations";
import { quotationHeaderSchema, quotationItemSchema } from "@/lib/quotations/validation";
import { addFollowup, FollowupMutationError } from "@/lib/followups/mutations";
import { followupSchema } from "@/lib/followups/validation";

function formatZodError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    return issues.map((issue) => issue.message).join(" · ");
  }
  return error instanceof Error ? error.message : "Error de validación.";
}

export async function createQuotationAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CREATE_QUOTATION)) {
    redirect("/dashboard?error=forbidden");
  }

  const currentUser = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!currentUser.folioCode) {
    return "Tu usuario no tiene un código de folio configurado — contacta a un Super Admin.";
  }

  const parsed = quotationHeaderSchema.safeParse({
    businessUnitId: formData.get("businessUnitId"),
    customerId: formData.get("customerId"),
    validUntil: formData.get("validUntil"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return formatZodError(parsed.error);

  const quotation = await createQuotationDraft({
    businessUnitId: parsed.data.businessUnitId,
    customerId: parsed.data.customerId,
    sellerId: session.user.id,
    sellerCode: currentUser.folioCode,
    validUntil: parsed.data.validUntil,
    notes: parsed.data.notes,
  });

  redirect(`/quotations/${quotation.id}`);
}

/**
 * Una cotización en `DRAFT` solo requiere el permiso general de crear
 * cotizaciones; editarla después de enviada (Módulo 8) requiere
 * `EDIT_APPROVED_QUOTATION` — Super Admin/Administración únicamente (ver
 * docs/ARCHITECTURE.md §4.1). Se resuelve aquí, no en `mutations.ts`, para
 * mantener la autorización por rol siempre en la capa de Server Action.
 */
async function requiredItemEditPermission(quotationId: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    select: { status: true },
  });
  if (!quotation) return null;
  return quotation.status === "DRAFT" ? PERMISSIONS.CREATE_QUOTATION : PERMISSIONS.EDIT_APPROVED_QUOTATION;
}

export async function addQuotationItemAction(
  quotationId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();

  const requiredPermission = await requiredItemEditPermission(quotationId);
  if (!requiredPermission || !hasPermission(session.user.role, requiredPermission)) {
    redirect("/dashboard?error=forbidden");
  }

  const parsed = quotationItemSchema.safeParse({
    productId: formData.get("productId"),
    qty: formData.get("qty"),
    discountPct: formData.get("discountPct"),
  });
  if (!parsed.success) return formatZodError(parsed.error);

  if (
    parsed.data.discountPct > 0 &&
    !hasPermission(session.user.role, PERMISSIONS.APPLY_DISCOUNT)
  ) {
    return "Tu rol no puede aplicar descuentos.";
  }

  try {
    await addQuotationItem({ quotationId, actorId: session.user.id, ...parsed.data });
  } catch (error) {
    if (error instanceof QuotationMutationError) return error.message;
    throw error;
  }

  redirect(`/quotations/${quotationId}`);
}

export async function removeQuotationItemAction(
  quotationId: string,
  itemId: string,
): Promise<void> {
  const session = await requireSession();

  const requiredPermission = await requiredItemEditPermission(quotationId);
  if (!requiredPermission || !hasPermission(session.user.role, requiredPermission)) {
    redirect("/dashboard?error=forbidden");
  }

  try {
    await removeQuotationItem({ quotationId, itemId, actorId: session.user.id });
  } catch (error) {
    if (!(error instanceof QuotationMutationError)) throw error;
  }

  redirect(`/quotations/${quotationId}`);
}

export async function submitQuotationAction(
  quotationId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CREATE_QUOTATION)) {
    redirect("/dashboard?error=forbidden");
  }

  const justification = formData.get("justification");

  try {
    await submitQuotation({
      quotationId,
      actorId: session.user.id,
      justification: typeof justification === "string" ? justification : null,
    });
  } catch (error) {
    if (error instanceof QuotationMutationError) return error.message;
    throw error;
  }

  redirect(`/quotations/${quotationId}`);
}

export async function addFollowupAction(
  quotationId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CREATE_QUOTATION)) {
    redirect("/dashboard?error=forbidden");
  }

  const parsed = followupSchema.safeParse({
    contactMethod: formData.get("contactMethod"),
    nextFollowupAt: formData.get("nextFollowupAt"),
    closeProbabilityPct: formData.get("closeProbabilityPct"),
    competitor: formData.get("competitor"),
    objection: formData.get("objection"),
    comments: formData.get("comments"),
  });
  if (!parsed.success) return formatZodError(parsed.error);

  try {
    await addFollowup({ quotationId, ownerId: session.user.id, ...parsed.data });
  } catch (error) {
    if (error instanceof FollowupMutationError) return error.message;
    throw error;
  }

  redirect(`/quotations/${quotationId}`);
}
