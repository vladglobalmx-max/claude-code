import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export interface SummaryCardData {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "neutral" | "warning" | "danger" | "success";
}

const TONE_CLASSES: Record<NonNullable<SummaryCardData["tone"]>, string> = {
  neutral: "text-accent bg-accent/15",
  warning: "text-warning bg-warning/15",
  danger: "text-danger bg-danger/15",
  success: "text-success bg-success/15",
};

export function SummaryCards({ items }: { items: SummaryCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="flex items-start justify-between pt-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{item.label}</p>
                <p className="mt-1.5 text-2xl font-semibold text-ink">{item.value}</p>
              </div>
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", TONE_CLASSES[item.tone ?? "neutral"])}>
                <Icon className="h-4.5 w-4.5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
