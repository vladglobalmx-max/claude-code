"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function StatusToggle({
  status,
  onToggle,
}: {
  status: "active" | "inactive";
  onToggle: (next: "active" | "inactive") => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const next = status === "active" ? "inactive" : "active";
    startTransition(async () => {
      try {
        await onToggle(next);
        toast.success(next === "active" ? "Activado" : "Desactivado");
      } catch {
        toast.error("No se pudo actualizar el estado");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Badge tone={status === "active" ? "success" : "neutral"}>{status === "active" ? "Activo" : "Inactivo"}</Badge>
      <Button size="sm" variant="ghost" onClick={handleClick} disabled={isPending}>
        {status === "active" ? "Desactivar" : "Activar"}
      </Button>
    </div>
  );
}
