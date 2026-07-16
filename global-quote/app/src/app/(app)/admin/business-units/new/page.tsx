import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

import { NewBusinessUnitForm } from "./new-business-unit-form";

export default async function NewBusinessUnitPage() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CONFIGURE_BUSINESS_UNITS)) {
    redirect("/dashboard?error=forbidden");
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <Link href="/admin/business-units" className="text-sm text-zinc-500 hover:underline">
          ← Líneas de negocio
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Nueva línea de negocio</h1>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <NewBusinessUnitForm />
      </div>
    </div>
  );
}
