"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function Topbar({ email }: { email: string | null }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="no-print flex h-14 shrink-0 items-center justify-end border-b border-border bg-surface px-6">
      <div className="flex items-center gap-3">
        {email && <span className="text-sm text-ink-faint">{email}</span>}
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Salir
        </Button>
      </div>
    </header>
  );
}
