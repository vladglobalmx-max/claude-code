import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar email={user.email ?? null} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
