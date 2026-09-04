"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveSetPasswordRedemption } from "@/lib/user-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Página destino de "Generar enlace de acceso" y "Generar nuevo enlace de
 * acceso" (ver configuracion/usuarios/actions.ts). Los enlaces que
 * generamos nosotros (buildSetPasswordLink) traen
 * ?token_hash=...&type=invite|recovery, que se redime aquí con
 * supabase.auth.verifyOtp({ token_hash, type }) — un intercambio
 * autocontenido en un solo POST que NO depende de que este mismo navegador
 * haya iniciado el flujo (a diferencia del intercambio automático de
 * PKCE/código que usa createBrowserClient() por defecto, que requiere un
 * code_verifier guardado localmente y por eso nunca funciona para un link
 * generado server-side y compartido manualmente). Por eso esta ruta está en
 * PUBLIC_PATHS del middleware: el servidor no ve ninguna sesión válida
 * hasta que el cliente completa este intercambio.
 *
 * NOTA: el correo automático de inviteUserByEmail()/resetPasswordForEmail()
 * sigue usando el mecanismo de Supabase (action_link), no este. Esta
 * pantalla ya no intenta detectar sesión desde ese formato — si se abre un
 * enlace de ese tipo, se muestra directamente como inválido (mismo
 * resultado visible que antes del fix, sin regresión: ver diagnóstico del
 * hallazgo de que ese flujo comparte la misma causa raíz, pendiente de
 * tratarse aparte).
 */
export function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Evita que Strict Mode (u otro re-render/re-montaje del efecto) dispare
  // verifyOtp() dos veces — el token es de un solo uso, una segunda llamada
  // lo encontraría ya consumido y el usuario vería "enlace inválido" pese a
  // que el primer intercambio sí funcionó.
  const verifyStartedRef = useRef(false);

  useEffect(() => {
    if (verifyStartedRef.current) return;
    verifyStartedRef.current = true;

    const redemption = resolveSetPasswordRedemption(searchParams);
    if (redemption.action === "invalid") {
      // THÖREN — instrumentación mínima: nunca el token_hash en sí (es una
      // credencial de un solo uso), solo si estaba presente y qué type traía
      // — suficiente para diagnosticar en Runtime Logs/Console sin exponer
      // nada sensible.
      console.error("[set-password] enlace sin token_hash/type reconocible", {
        hasTokenHash: searchParams.has("token_hash"),
        type: searchParams.get("type"),
      });
      setStatus("invalid");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .verifyOtp(redemption.params)
      .then(({ data, error: verifyError }) => {
        if (verifyError || !data.session) {
          console.error("[set-password] verifyOtp falló", {
            type: redemption.params.type,
            message: verifyError?.message,
            code: verifyError?.code,
          });
          setStatus("invalid");
          return;
        }
        // Limpia el token de la barra de direcciones ahora que ya se consumió.
        window.history.replaceState(null, "", "/set-password");
        setStatus("ready");
      })
      .catch((err: unknown) => {
        // Antes de este fix, un rechazo de la promesa (ej. fallo de red) no
        // se capturaba en ningún lado: dejaba status="checking" para
        // siempre, sin loguear nada. Ahora se registra y se resuelve a un
        // estado visible en vez de quedar colgado en silencio.
        console.error("[set-password] excepción inesperada verificando el enlace", {
          type: redemption.params.type,
          message: err instanceof Error ? err.message : String(err),
        });
        setStatus("invalid");
      });
  }, [searchParams]);

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
