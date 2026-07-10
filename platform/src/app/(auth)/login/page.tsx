"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="mb-1 text-lg font-semibold text-ink">Inicia sesión</h1>
        <p className="mb-6 text-sm text-ink-faint">Accede con tu correo corporativo de Global Supplier MTY.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Correo electrónico" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@globalsuppliermty.com"
            />
          </FormField>

          <FormField label="Contraseña" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </FormField>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" className="w-full" loading={loading}>
            Entrar
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/forgot-password" className="text-sm text-accent hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
