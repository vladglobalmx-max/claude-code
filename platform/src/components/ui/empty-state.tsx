import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <Icon className="h-8 w-8 text-ink-faint" strokeWidth={1.5} />
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && <p className="mt-1 text-sm text-ink-faint">{description}</p>}
      </div>
      {action}
    </div>
  );
}
