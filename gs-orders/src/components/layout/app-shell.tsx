"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { UserRole } from "@/types/domain";

const COLLAPSED_STORAGE_KEY = "thoren.sidebar.collapsed";

/**
 * Dueño del estado del shell (colapso de sidebar en desktop + drawer en
 * mobile). Vive en un client component separado porque
 * app/(app)/layout.tsx es un server component (necesita quedarse así para
 * leer getCurrentProfile() sin filtrar la sesión al cliente).
 */
export function AppShell({
  role,
  canManageUsers,
  name,
  email,
  children,
}: {
  role: UserRole;
  canManageUsers: boolean;
  name: string;
  email: string | null;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      <Sidebar
        role={role}
        canManageUsers={canManageUsers}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={name} role={role} email={email} onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
