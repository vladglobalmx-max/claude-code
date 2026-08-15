"use client";

import { useRouter } from "next/navigation";
import { LogOut, Menu, User } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { USER_ROLE_LABELS, type UserRole } from "@/types/domain";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Topbar({
  name,
  role,
  email,
  onOpenMobileMenu,
}: {
  name: string;
  role: UserRole;
  email: string | null;
  onOpenMobileMenu: () => void;
}) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="no-print flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="rounded-md p-1.5 text-ink-soft hover:bg-surface-2 hover:text-ink lg:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menú</span>
        </button>
        <Breadcrumbs />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
            {initials(name)}
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-ink">{name}</p>
            <p className="text-xs text-ink-faint">{USER_ROLE_LABELS[role]}</p>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            <div className="flex items-center gap-2 normal-case tracking-normal text-ink-soft">
              <User className="h-3.5 w-3.5" />
              {email ?? "Sin correo"}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
