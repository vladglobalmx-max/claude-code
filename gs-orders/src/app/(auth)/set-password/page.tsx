import { Suspense } from "react";
import { SetPasswordForm } from "./set-password-form";

export default function SetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/*
            Marca THÖREN — mismo lockup que /login (THOREN_Manual_de_Marca.pdf
            sección 01): símbolo Þ en Ember + wordmark. Sustituto tipográfico
            temporal, ver docs/THOREN_BRAND_SYSTEM.md.
          */}
          <div aria-hidden="true" className="mb-1 text-4xl font-bold leading-none text-accent">
            Þ
          </div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-ink">THÖREN</p>
          <h1 className="mt-3 text-xl font-semibold text-ink">Define tu contraseña</h1>
          <p className="mt-1 text-sm text-ink-faint">Global Supplier MTY</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <Suspense fallback={null}>
            <SetPasswordForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
