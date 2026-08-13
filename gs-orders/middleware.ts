import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/set-password"];
// Rutas cuya sección completa requiere rol ADMIN. Esto es defensa en
// profundidad a nivel de ruta (además de RLS, que es la protección real de
// los datos): un VENDEDOR que escriba manualmente /configuracion o
// /vendedores en el navegador debe ser redirigido aquí mismo, antes de que
// la página siquiera intente renderizar (ver CASO J del reporte de Fase 3).
const ADMIN_ONLY_PREFIXES = ["/configuracion", "/vendedores"];

/**
 * Protege toda la app: sin sesión válida, redirige a /login. Con sesión
 * válida pero sin perfil (user_profiles) o con el perfil desactivado,
 * cierra la sesión y redirige a /login — un token válido no basta para
 * operar si el ADMIN desactivó al usuario (ver CASO M/N). Con perfil activo
 * pero rol VENDEDOR, bloquea las rutas administrativas.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && !isPublicPath) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, active")
      .eq("user_id", user.id)
      .single();

    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("reason", "inactive");
      return NextResponse.redirect(loginUrl);
    }

    const isAdminOnlyPath = ADMIN_ONLY_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
    if (isAdminOnlyPath && profile.role !== "admin") {
      return NextResponse.redirect(new URL("/pedidos", request.url));
    }
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/pedidos", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
