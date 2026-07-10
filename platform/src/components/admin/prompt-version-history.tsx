import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeToNow } from "@/lib/utils/format";
import { History } from "lucide-react";
import type { PromptVersion } from "@/types/domain";

export function PromptVersionHistory({ versions }: { versions: PromptVersion[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de versiones</CardTitle>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <EmptyState icon={History} title="Esta es la primera versión" />
        ) : (
          <ul className="scrollbar-thin max-h-80 space-y-3 overflow-y-auto text-sm">
            {versions.map((v) => (
              <li key={v.id} className="rounded-md border border-border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-ink">v{v.version}</span>
                  <span className="text-xs text-ink-faint">{formatRelativeToNow(v.created_at)}</span>
                </div>
                <p className="line-clamp-2 text-xs text-ink-faint">{v.system_prompt}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
