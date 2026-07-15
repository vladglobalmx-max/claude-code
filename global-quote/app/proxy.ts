import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { findRequiredPermissionForPath, hasPermission } from "@/lib/auth/permissions";

// Next.js 16 renombro "middleware" a "proxy" (ver AGENTS.md). Esta capa es la
// primera linea de defensa (redirige sin sesion, bloquea /admin sin permiso),
// pero cada Server Action/Route Handler valida sesion y permiso de nuevo:
// nunca confiamos solo en el proxy para proteger datos de costo/margen.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requiredPermission = findRequiredPermissionForPath(pathname);
  if (requiredPermission && !hasPermission(req.auth.user.role, requiredPermission)) {
    return NextResponse.redirect(new URL("/dashboard?error=forbidden", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
