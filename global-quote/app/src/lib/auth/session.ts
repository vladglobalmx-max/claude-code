import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";

/**
 * Vuelve a validar la sesion dentro de la pagina/accion (defensa en
 * profundidad ademas de proxy.ts y del layout de (app) — ver
 * docs/ARCHITECTURE.md §3.1). Nunca usar `session!.user` sin este chequeo:
 * `auth()` puede devolver null si la pagina se alcanza sin pasar por el
 * layout autenticado, o si el JWT expiro entre el proxy y el render.
 */
export async function requireSession() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  return session;
}
