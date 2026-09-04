"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Cubre /login y /set-password — pantallas previas a autenticarse, sin el
 * app shell (sidebar/topbar) alrededor. Mismo lockup THÖREN centrado que
 * esas pantallas (ver login/page.tsx, set-password/page.tsx), no el patrón
 * de error.tsx de (app) (que asume un contenedor dentro del shell
 * autenticado) — este boundary reemplaza la página completa.
 */
export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div aria-hidden="true" className="mb-1 text-4xl font-bold leading-none text-accent">
            Þ
          </div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-ink">THÖREN</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-danger" />
            <p className="text-sm font-medium text-ink">No se pudo cargar esta pantalla</p>
            <p className="max-w-sm text-sm text-ink-faint">
              Ocurrió un error inesperado. Puedes intentar de nuevo; si el problema continúa, pide al administrador
              que te envíe un enlace nuevo.
            </p>
            <Button type="button" variant="outline" onClick={() => reset()} className="mt-2">
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
