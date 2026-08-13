import { Suspense } from "react";
import { SetPasswordForm } from "./set-password-form";

export default function SetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-ink">
            GS
          </div>
          <h1 className="text-xl font-semibold text-ink">Define tu contraseña</h1>
          <p className="mt-1 text-sm text-ink-faint">GS Orders — Global Supplier MTY</p>
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
