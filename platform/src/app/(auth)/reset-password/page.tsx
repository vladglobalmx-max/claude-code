"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("No pudimos actualizar tu contraseña. El enlace pudo haber expirado.");
      return;
    }
    router.push("/login");
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="mb-1 text-lg font-semibold text-ink">Nueva contraseña</h1>
        <p className="mb-6 text-sm text-ink-faint">Define tu nueva contraseña de acceso.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Nueva contraseña" htmlFor="password">
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <FormField label="Confirmar contraseña" htmlFor="confirm">
            <Input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Guardar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
