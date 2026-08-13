import "server-only";
import { headers } from "next/headers";

/**
 * Origen absoluto del request actual (para construir redirectTo de invites,
 * generateLink y restablecimiento de contraseña de Supabase Auth).
 *
 * Prioriza NEXT_PUBLIC_SITE_URL cuando está definida — fuente explícita y
 * estable para producción, independiente de qué headers reenvíe el proxy.
 * Si no está definida, se deriva del host real de la petición (funciona
 * igual en local y en previews de Vercel sin configurar nada). En
 * producción, si ninguna de las dos está disponible, falla de forma
 * explícita en vez de caer silenciosamente a localhost — un redirectTo mal
 * calculado hacia localhost en producción rompe el enlace para el usuario
 * sin que nadie lo note hasta que alguien reporta el error.
 */
export function getSiteUrl(): string {
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envSiteUrl) return envSiteUrl.replace(/\/$/, "");

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No se pudo determinar la URL del sitio: define NEXT_PUBLIC_SITE_URL o revisa que la petición incluya el header host."
    );
  }
  return "http://localhost:3000";
}
