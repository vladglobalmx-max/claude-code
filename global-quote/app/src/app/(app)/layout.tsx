import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { ROLE_LABELS } from "@/lib/auth/permissions";

import { logout } from "./actions";

const NAV_ITEMS = [
  { label: "Inicio · Dashboard", href: "/dashboard", enabled: true },
  { label: "Cotizaciones", enabled: false },
  { label: "Autorizaciones", enabled: false },
  { label: "Clientes · Contactos", enabled: false },
  { label: "Productos · Precios", enabled: false },
  { label: "Líneas de negocio", enabled: false },
  { label: "Pedidos", enabled: false },
  { label: "Reportes", enabled: false },
  { label: "Administración", enabled: false },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Defensa en profundidad: proxy.ts ya protege esta ruta, pero el layout
  // vuelve a validar sesion por si algun dia el matcher del proxy cambia.
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen w-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-8 px-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Global Supplier MTY
          </p>
          <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">GLOBAL QUOTE</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 text-sm">
          {NAV_ITEMS.map((item) =>
            item.enabled && item.href ? (
              <a
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-2 font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                {item.label}
              </a>
            ) : (
              <span
                key={item.label}
                className="cursor-not-allowed rounded-md px-3 py-2 text-zinc-400 dark:text-zinc-600"
                title="Módulo pendiente de construir (ver docs/ARCHITECTURE.md §10)"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {session.user.fullName}
            </p>
            <p className="text-xs text-zinc-500">{ROLE_LABELS[session.user.role]}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Cerrar sesión
            </button>
          </form>
        </header>

        <main className="flex-1 bg-zinc-50 p-6 dark:bg-zinc-900">{children}</main>
      </div>
    </div>
  );
}
