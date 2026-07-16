"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { createTax, setTaxActive, TaxMutationError } from "@/lib/taxes/mutations";
import { taxSchema } from "@/lib/taxes/validation";

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
}

export async function createTaxAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  await requireBusinessUnitManager();

  const parsed = taxSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    ratePct: formData.get("ratePct"),
  });
  if (!parsed.success) return formatZodError(parsed.error);

  try {
    await createTax(parsed.data);
  } catch (error) {
    if (error instanceof TaxMutationError) return error.message;
    throw error;
  }

  redirect("/admin/taxes");
}

export async function toggleTaxActiveAction(taxId: string, active: boolean): Promise<void> {
  await requireBusinessUnitManager();
  await setTaxActive(taxId, active);
  redirect("/admin/taxes");
}
