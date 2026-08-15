import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/*
            Marca THÖREN — lockup "logotipo principal sobre fondo claro"
            (THOREN_Manual_de_Marca.pdf sección 01): símbolo Þ en Ember,
            directo sobre el fondo, junto al wordmark. Sustituto tipográfico
            temporal — sin los PNG/SVG fuente aprobados todavía, ver
            docs/THOREN_BRAND_SYSTEM.md.
          */}
          <div aria-hidden="true" className="mb-1 text-4xl font-bold leading-none text-accent">
            Þ
          </div>
          <h1 className="text-xl font-extrabold uppercase tracking-wide text-ink">THÖREN</h1>
          <p className="mt-1 text-sm text-ink-faint">Global Supplier MTY</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
