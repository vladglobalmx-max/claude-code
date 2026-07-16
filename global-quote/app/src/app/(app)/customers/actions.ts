"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import {
  addContact,
  createCustomerFull,
  createProspect,
  updateCustomerCommercialInfo,
} from "@/lib/customers/mutations";
import { contactSchema, customerManagementSchema, prospectSchema } from "@/lib/customers/validation";

function formatZodError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    return issues.map((issue) => issue.message).join(" · ");
  }
  return error instanceof Error ? error.message : "Error de validación.";
}

export async function createCustomerAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();
  const role = session.user.role;

  if (!hasPermission(role, PERMISSIONS.CREATE_CUSTOMER)) {
    redirect("/dashboard?error=forbidden");
  }

  const prospectResult = prospectSchema.safeParse({
    businessUnitId: formData.get("businessUnitId"),
    legalName: formData.get("legalName"),
    tradeName: formData.get("tradeName"),
    taxId: formData.get("taxId"),
    industry: formData.get("industry"),
    segment: formData.get("segment"),
    notes: formData.get("notes"),
  });
  if (!prospectResult.success) return formatZodError(prospectResult.error);

  let customerId: string;

  if (hasPermission(role, PERMISSIONS.MANAGE_CUSTOMERS)) {
    const managementResult = customerManagementSchema.safeParse({
      assignedSellerId: formData.get("assignedSellerId"),
      paymentTermsId: formData.get("paymentTermsId"),
      priceListId: formData.get("priceListId"),
      creditLimit: formData.get("creditLimit"),
      authorizedDiscountPct: formData.get("authorizedDiscountPct"),
      status: formData.get("status"),
    });
    if (!managementResult.success) return formatZodError(managementResult.error);

    const customer = await createCustomerFull({
      prospect: prospectResult.data,
      management: managementResult.data,
    });
    customerId = customer.id;
  } else {
    const customer = await createProspect({
      prospect: prospectResult.data,
      sellerId: session.user.id,
    });
    customerId = customer.id;
  }

  redirect(`/customers/${customerId}`);
}

export async function updateCustomerAction(
  customerId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.MANAGE_CUSTOMERS)) {
    redirect("/dashboard?error=forbidden");
  }

  const prospectResult = prospectSchema.safeParse({
    businessUnitId: formData.get("businessUnitId"),
    legalName: formData.get("legalName"),
    tradeName: formData.get("tradeName"),
    taxId: formData.get("taxId"),
    industry: formData.get("industry"),
    segment: formData.get("segment"),
    notes: formData.get("notes"),
  });
  const managementResult = customerManagementSchema.safeParse({
    assignedSellerId: formData.get("assignedSellerId"),
    paymentTermsId: formData.get("paymentTermsId"),
    priceListId: formData.get("priceListId"),
    creditLimit: formData.get("creditLimit"),
    authorizedDiscountPct: formData.get("authorizedDiscountPct"),
    status: formData.get("status"),
  });

  if (!prospectResult.success) return formatZodError(prospectResult.error);
  if (!managementResult.success) return formatZodError(managementResult.error);

  await updateCustomerCommercialInfo(customerId, {
    ...prospectResult.data,
    ...managementResult.data,
  });

  redirect(`/customers/${customerId}`);
}

export async function addContactAction(
  customerId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CREATE_CUSTOMER)) {
    redirect("/dashboard?error=forbidden");
  }

  const result = contactSchema.safeParse({
    name: formData.get("name"),
    position: formData.get("position"),
    area: formData.get("area"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    decisionPower: formData.get("decisionPower"),
  });
  if (!result.success) return formatZodError(result.error);

  await addContact(customerId, result.data);

  redirect(`/customers/${customerId}`);
}
