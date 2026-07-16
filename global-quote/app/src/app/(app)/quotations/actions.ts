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

export async function addQuotationItemAction(
  quotationId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CREATE_QUOTATION)) {
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
    await addQuotationItem({ quotationId, ...parsed.data });
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
  if (!hasPermission(session.user.role, PERMISSIONS.CREATE_QUOTATION)) {
    redirect("/dashboard?error=forbidden");
  }

  try {
    await removeQuotationItem({ quotationId, itemId });
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
