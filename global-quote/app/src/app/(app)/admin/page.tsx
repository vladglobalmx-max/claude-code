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
        href="/admin/business-units"
        className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
      >
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">Líneas de negocio</p>
        <p className="text-sm text-zinc-500">
          Da de alta líneas nuevas y configura datos fiscales, cuentas bancarias y términos y
          condiciones de cada una.
        </p>
      </Link>

      <Link
        href="/admin/taxes"
        className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
      >
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">Impuestos</p>
        <p className="text-sm text-zinc-500">Catálogo global de impuestos (IVA, exento, tasa 0%).</p>
      </Link>

      <Link
        href="/admin/sequences"
        className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
      >
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">Folios y series</p>
        <p className="text-sm text-zinc-500">
          Consulta el consecutivo vigente de cada línea de negocio y emite folios de prueba.
        </p>
      </Link>

      <Link
        href="/admin/audit"
        className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
      >
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">Auditoría</p>
        <p className="text-sm text-zinc-500">
          Consulta los cambios registrados a campos sensibles (crédito, descuentos, márgenes).
        </p>
      </Link>

      <Link
        href="/admin/followups"
        className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
      >
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">Vencimiento automático</p>
        <p className="text-sm text-zinc-500">
          Corre a mano la tarea que marca &ldquo;Vencida&rdquo; una cotización enviada fuera de vigencia (en
          producción la dispara un cron real).
        </p>
      </Link>

      <div className="rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-400 dark:border-zinc-700">
        Usuarios, roles y plantillas de PDF llegan en módulos posteriores (ver
        docs/ARCHITECTURE.md §10).
      </div>
    </div>
  );
}
