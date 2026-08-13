import "server-only";
import { headers } from "next/headers";

/**
 * Origen absoluto del request actual (para construir redirectTo de invites
 * y de restablecimiento de contraseña de Supabase Auth). No depende de una
 * variable de entorno nueva: se deriva del host real de la petición, así
 * que funciona igual en local, preview de Vercel y producción.
 */
export function getSiteUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
