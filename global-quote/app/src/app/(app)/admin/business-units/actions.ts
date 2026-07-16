"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import {
  BusinessUnitMutationError,
  createBankAccount,
  createBusinessUnit,
  replaceTermsAndConditions,
  setBankAccountActive,
  updateBusinessUnit,
} from "@/lib/business-units/mutations";
import {
  bankAccountSchema,
  businessUnitCreateSchema,
  businessUnitEditSchema,
  termsAndConditionsSchema,
} from "@/lib/business-units/validation";

function formatZodError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    return issues.map((issue) => issue.message).join(" · ");
  }
  return error instanceof Error ? error.message : "Error de validación.";
}

async function requireBusinessUnitManager() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CONFIGURE_BUSINESS_UNITS)) {
    redirect("/dashboard?error=forbidden");
  }
  return session;
}

export async function createBusinessUnitAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  await requireBusinessUnitManager();

  const parsed = businessUnitCreateSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
  });
  if (!parsed.success) return formatZodError(parsed.error);

  let businessUnit;
  try {
    businessUnit = await createBusinessUnit(parsed.data);
  } catch (error) {
    if (error instanceof BusinessUnitMutationError) return error.message;
    throw error;
  }

  redirect(`/admin/business-units/${businessUnit.id}`);
}

export async function updateBusinessUnitAction(
  businessUnitId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  await requireBusinessUnitManager();

  const parsed = businessUnitEditSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName"),
    taxId: formData.get("taxId"),
    address: formData.get("address"),
    colorPrimary: formData.get("colorPrimary"),
    colorSecondary: formData.get("colorSecondary"),
    minMarginDefault: formData.get("minMarginDefault"),
    folioNumberingMode: formData.get("folioNumberingMode"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return formatZodError(parsed.error);

  await updateBusinessUnit(businessUnitId, parsed.data);
  redirect(`/admin/business-units/${businessUnitId}`);
}

export async function addBankAccountAction(
  businessUnitId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  await requireBusinessUnitManager();

  const parsed = bankAccountSchema.safeParse({
    bankName: formData.get("bankName"),
    accountHolder: formData.get("accountHolder"),
    accountNumber: formData.get("accountNumber"),
    clabe: formData.get("clabe"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) return formatZodError(parsed.error);

  await createBankAccount({ businessUnitId, ...parsed.data });
  redirect(`/admin/business-units/${businessUnitId}`);
}

export async function toggleBankAccountActiveAction(
  businessUnitId: string,
  bankAccountId: string,
  active: boolean,
): Promise<void> {
  await requireBusinessUnitManager();
  await setBankAccountActive(bankAccountId, active);
  redirect(`/admin/business-units/${businessUnitId}`);
}

export async function replaceTermsAction(
  businessUnitId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireBusinessUnitManager();

  const parsed = termsAndConditionsSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return formatZodError(parsed.error);

  await replaceTermsAndConditions({
    businessUnitId,
    content: parsed.data.content,
    actorId: session.user.id,
  });
  redirect(`/admin/business-units/${businessUnitId}`);
}
