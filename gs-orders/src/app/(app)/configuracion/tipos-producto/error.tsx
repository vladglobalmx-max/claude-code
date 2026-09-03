"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cubre /configuracion/tipos-producto — no afecta Usuarios ni Catálogo. */
export default function TiposProductoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-12 text-center">
        <AlertTriangle className="h-8 w-8 text-danger" />
        <p className="text-sm font-medium text-ink">No se pudo cargar Tipos de producto</p>
        <p className="max-w-sm text-sm text-ink-faint">
          Ocurrió un error inesperado. Puedes intentar de nuevo; si el problema continúa, contacta a soporte.
        </p>
        <Button type="button" variant="outline" onClick={() => reset()} className="mt-2">
          Reintentar
        </Button>
      </div>
    </div>
  );
}
