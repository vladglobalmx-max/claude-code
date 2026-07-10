import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeToNow } from "@/lib/utils/format";
import { Activity } from "lucide-react";

export interface ActivityItem {
  id: string;
  description: string;
  actor: string;
  timestamp: string;
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad reciente</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={Activity} title="Sin actividad todavía" description="Aquí verás las últimas acciones del equipo." />
        ) : (
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <span className="font-medium text-ink">{item.actor}</span>{" "}
                  <span className="text-ink-soft">{item.description}</span>
                </div>
                <span className="shrink-0 text-xs text-ink-faint">{formatRelativeToNow(item.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
