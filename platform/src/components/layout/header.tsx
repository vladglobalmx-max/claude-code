"use client";

import { Search, Bell } from "lucide-react";
import { initials } from "@/lib/utils/format";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function Header({ userName, roleName }: { userName: string; roleName: string }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-5">
      <div className="flex w-full max-w-md items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-ink-faint">
        <Search className="h-4 w-4" />
        <span>Buscar clientes, oportunidades, herramientas…</span>
      </div>

      <div className="flex items-center gap-4">
        <button className="text-ink-faint hover:text-ink" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2"
          title="Cerrar sesión"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
            {initials(userName)}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm leading-tight text-ink">{userName}</p>
            <p className="text-xs leading-tight text-ink-faint">{roleName}</p>
          </div>
        </button>
      </div>
    </header>
  );
}
