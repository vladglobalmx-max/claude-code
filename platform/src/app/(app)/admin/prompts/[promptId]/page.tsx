import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { PromptEditor } from "@/components/admin/prompt-editor";
import { PromptVersionHistory } from "@/components/admin/prompt-version-history";

export const dynamic = "force-dynamic";

export default async function AdminPromptDetailPage({ params }: { params: { promptId: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();
  const supabase = createSupabaseServerClient();

  const { data: prompt } = await supabase
    .from("prompts")
    .select("*")
    .eq("id", params.promptId)
    .eq("company_id", user.companyId)
    .single();

  if (!prompt) notFound();

  const { data: versions } = await supabase
    .from("prompt_versions")
    .select("*")
    .eq("prompt_id", prompt.id)
    .order("version", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{prompt.name}</h1>
        <p className="font-mono text-xs text-ink-faint">
          {prompt.code} · v{prompt.version}
        </p>
      </div>

      <PromptEditor prompt={prompt} />
      <PromptVersionHistory versions={versions ?? []} />
    </div>
  );
}
