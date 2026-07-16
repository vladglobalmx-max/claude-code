import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

export default async function AdminIndexPage() {
  const session = await requireSession();
  const role = session.user.role;

  if (!hasPermission(role, PERMISSIONS.CONFIGURE_SEQUENCES)) {
    redirect("/dashboard?error=forbidden");
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Administración</h1>
        <p className="text-sm text-zinc-500">Configuración general del sistema.</p>
      </div>

      <Link
        href="/admin/sequences"
        className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
      >
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">Folios y series</p>
        <p className="text-sm text-zinc-500">
          Consulta el consecutivo vigente de cada línea de negocio y emite folios de prueba.
        </p>
      </Link>

      <div className="rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-400 dark:border-zinc-700">
        Usuarios, roles, plantillas de PDF y auditoría llegan en módulos posteriores (ver
        docs/ARCHITECTURE.md §10).
      </div>
    </div>
  );
}
