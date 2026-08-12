"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError("No pudimos procesar la solicitud. Verifica el correo e intenta de nuevo.");
      return;
    }
    setSent(true);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="mb-1 text-lg font-semibold text-ink">Recuperar contraseña</h1>
        <p className="mb-6 text-sm text-ink-faint">Te enviaremos un enlace para restablecerla.</p>

        {sent ? (
          <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            Si el correo existe en el sistema, recibirás un enlace en unos minutos.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Correo electrónico" htmlFor="email">
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@globalsuppliermty.com"
              />
            </FormField>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Enviar enlace
            </Button>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link href="/login" className="text-sm text-accent hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
