import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  prospect: "Prospecto",
};

const STATUS_TONE: Record<string, "success" | "neutral" | "accent"> = {
  active: "success",
  inactive: "neutral",
  prospect: "accent",
};

export function ClientStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}
