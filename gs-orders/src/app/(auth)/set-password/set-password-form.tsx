"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Página destino de los enlaces de invitación ("+ Nuevo usuario") y de
 * "Restablecer contraseña" (ver configuracion/usuarios/actions.ts). El
 * enlace de Supabase Auth trae el token en el fragmento de la URL (#...),
 * que nunca llega al servidor — createSupabaseBrowserClient() lo detecta
 * automáticamente en el navegador y establece una sesión temporal de tipo
 * recovery/invite. Por eso esta ruta está en PUBLIC_PATHS del middleware:
 * el servidor no puede ver todavía ninguna sesión válida en la primera
 * carga, solo el cliente puede, una vez procesa el fragmento.
 */
export function SetPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? "ready" : "invalid");
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("No se pudo guardar la contraseña. Solicita un nuevo enlace al administrador.");
      return;
    }

    router.push("/pedidos");
    router.refresh();
  }

  if (status === "checking") {
    return <p className="text-sm text-ink-faint">Verificando enlace…</p>;
  }

  if (status === "invalid") {
    return (
      <p className="text-sm text-danger">
        Este enlace no es válido o ya expiró. Pide al administrador que te envíe uno nuevo.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-soft">
          Nueva contraseña
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      <div>
        <label htmlFor="confirm_password" className="mb-1.5 block text-sm font-medium text-ink-soft">
          Confirmar contraseña
        </label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Guardando…" : "Guardar contraseña y entrar"}
      </Button>
    </form>
  );
}
