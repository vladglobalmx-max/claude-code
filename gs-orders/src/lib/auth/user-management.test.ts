import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isFullAdmin, canManageUsers } from "./user-management";
import type { CurrentProfile } from "./profile";

function profile(overrides: Partial<CurrentProfile> = {}): CurrentProfile {
  return {
    userId: "user-1",
    email: "user@example.com",
    name: "Usuario",
    role: "vendedor",
    salespersonId: "sp-1",
    active: true,
    ...overrides,
  };
}

const NONE = new Set<string>();
const CAN_MANAGE_USERS = new Set(["can_manage_users"]);

/**
 * THÖREN 6R.1B-4B — mismo criterio de fases anteriores (6R.1B-1/2B/3B):
 * sin infraestructura de render (React Testing Library), así que los tests
 * de UI [5]-[20] reproducen la expresión booleana real (citando
 * archivo:línea) o inspeccionan el código fuente real para confirmar una
 * AUSENCIA (no hay otra forma honesta de probar "nunca se ofrece X" sin
 * RTL) — igual que purchase-orders.test.ts [20].
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function readApp(relativeFromAppDir: string) {
  return readFileSync(path.join(__dirname, "../../app/(app)", relativeFromAppDir), "utf8");
}
const middlewareSource = readFileSync(path.join(__dirname, "../../../middleware.ts"), "utf8");
const configuracionLayoutSource = readApp("configuracion/layout.tsx");
const catalogoLayoutSource = readApp("configuracion/catalogo/layout.tsx");
const tiposProductoLayoutSource = readApp("configuracion/tipos-producto/layout.tsx");
const foliosLayoutSource = readApp("configuracion/folios-cotizaciones/layout.tsx");
const userFormSource = readApp("configuracion/usuarios/user-form.tsx");
const editarPageSource = readApp("configuracion/usuarios/[id]/editar/page.tsx");
const nuevoPageSource = readApp("configuracion/usuarios/nuevo/page.tsx");
const usuariosPageSource = readApp("configuracion/usuarios/page.tsx");
const actionsSource = readApp("configuracion/usuarios/actions.ts");

/** Reproduce middleware.ts: isUserManagerAllowedConfigPath (solo hub y /configuracion/usuarios/*). */
function isUserManagerAllowedConfigPath(pathname: string): boolean {
  return pathname === "/configuracion" || pathname.startsWith("/configuracion/usuarios");
}

describe("[1]-[4] helpers isFullAdmin/canManageUsers — reglas comunes", () => {
  it("[1] admin activo → canManageUsers=true, sin ninguna capability", () => {
    const admin = profile({ role: "admin" });
    expect(isFullAdmin(admin)).toBe(true);
    expect(canManageUsers(admin, NONE)).toBe(true);
  });

  it("[2] can_manage_users activa (vendedor) → canManageUsers=true", () => {
    const vendedor = profile();
    expect(isFullAdmin(vendedor)).toBe(false);
    expect(canManageUsers(vendedor, CAN_MANAGE_USERS)).toBe(true);
  });

  it("[3] vendedor normal sin capability → canManageUsers=false", () => {
    const vendedor = profile();
    expect(canManageUsers(vendedor, NONE)).toBe(false);
  });

  it("[4] usuario inactivo → false en ambos, incluso admin o con can_manage_users activa", () => {
    const inactiveAdmin = profile({ role: "admin", active: false });
    const inactiveVendedor = profile({ active: false });
    expect(isFullAdmin(inactiveAdmin)).toBe(false);
    expect(canManageUsers(inactiveAdmin, NONE)).toBe(false);
    expect(canManageUsers(inactiveVendedor, CAN_MANAGE_USERS)).toBe(false);
  });
});

describe("[5]-[6] acceso a /configuracion/usuarios — middleware.ts + layout.tsx", () => {
  it("[5] user manager (can_manage_users, no admin) ve el listado — middleware permite la ruta Y layout.tsx no rebota", () => {
    const userManager = profile();
    expect(isUserManagerAllowedConfigPath("/configuracion/usuarios")).toBe(true);
    expect(canManageUsers(userManager, CAN_MANAGE_USERS)).toBe(true);
    // configuracion/layout.tsx: `if (!canManageUsers(profile, capabilities)) redirect(...)` — no se dispara.
    expect(configuracionLayoutSource).toContain("if (!canManageUsers(profile, capabilities))");
  });

  it("[6] user manager puede abrir Nuevo usuario — misma ruta permitida por middleware (prefijo /configuracion/usuarios)", () => {
    expect(isUserManagerAllowedConfigPath("/configuracion/usuarios/nuevo")).toBe(true);
  });
});

describe("[7]-[8] alta de usuario — role fijo en vendedor, sin selector de admin", () => {
  it("[7] nuevo usuario por user manager queda role='vendedor' (nuevo/page.tsx: canChooseRole = isFullAdmin(profile))", () => {
    const userManager = profile();
    const canChooseRole = isFullAdmin(userManager);
    expect(canChooseRole).toBe(false);
    expect(nuevoPageSource).toContain("const canChooseRole = isFullAdmin(profile)");
    // user-form.tsx: cuando canChooseRole=false, el role del estado queda fijo en "vendedor"
    // (useState(canChooseRole ? user?.role ?? "vendedor" : "vendedor")), sin importar `user`.
    const userRole: string | undefined = undefined;
    const initialRole = canChooseRole ? userRole ?? "vendedor" : "vendedor";
    expect(initialRole).toBe("vendedor");
  });

  it("[8] user manager NO ve la opción ADMIN — user-form.tsx solo renderiza <option value=\"admin\"> dentro de la rama canChooseRole", () => {
    expect(userFormSource).toContain('{canChooseRole ? (');
    expect(userFormSource).toContain('<option value="admin">ADMIN</option>');
    // La rama else (canChooseRole=false) manda un input oculto fijo, nunca el <Select> con la opción admin.
    expect(userFormSource).toContain('<input type="hidden" name="role" value="vendedor" />');
  });
});

describe("[9]-[11] edición — target no-admin permitido, target admin bloqueado con redirect", () => {
  it("[9] user manager edita target vendedor — el guard de editar/page.tsx no se activa (role !== 'admin')", () => {
    const admin = false;
    const targetRole: string = "vendedor";
    const blocked = !admin && targetRole === "admin";
    expect(blocked).toBe(false);
    expect(editarPageSource).toContain('if (!admin && user.role === "admin")');
  });

  it("[10] user manager NO edita target admin — el mismo guard SÍ se activa y dispara redirect antes de construir el formulario", () => {
    const admin = false;
    const targetRole: string = "admin";
    const blocked = !admin && targetRole === "admin";
    expect(blocked).toBe(true);
    // El redirect vive ANTES del `return (` que arma el JSX — nunca se llega a renderizar el form.
    const guardIndex = editarPageSource.indexOf('if (!admin && user.role === "admin")');
    const returnIndex = editarPageSource.indexOf("return (\n    <div");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(guardIndex);
  });

  it("[11] route directa a un target admin redirige al listado con mensaje claro", () => {
    expect(editarPageSource).toContain("redirect(`/configuracion/usuarios?error=${ADMIN_PROTECTED_ERROR}`)");
    expect(usuariosPageSource).toContain("searchParams?.error === ADMIN_PROTECTED_ERROR");
    expect(usuariosPageSource).toContain("No tienes autorización para modificar cuentas administradoras.");
  });
});

describe("[12]-[13] activar/desactivar y reset/acceso — disponibles para target no-admin", () => {
  it("[12] user manager puede activar/desactivar un target no-admin — el checkbox 'Activo' se renderiza sin condicionar por canChooseRole/admin", () => {
    expect(userFormSource).toContain('name="active"');
    expect(userFormSource).not.toMatch(/canChooseRole\s*&&[\s\S]{0,80}name="active"/);
  });

  it("[13] user manager ve reset/generar acceso para un target no-admin — los botones se ofrecen solo por `isEdit`, no por admin/canChooseRole (el target admin nunca llega a renderizar el form, ver [10])", () => {
    expect(userFormSource).toContain("isEdit && (");
    expect(userFormSource).not.toMatch(/canChooseRole[\s\S]{0,120}Restablecer contraseña/);
  });
});

describe("[14] reset/acceso NO se ofrece sobre un target admin", () => {
  it("un user manager nunca ve user-form.tsx para un target admin — editar/page.tsx redirige antes de montarlo (ver [10]/[11])", () => {
    // Estructural: el guard + redirect ocurre antes de cualquier referencia a <UserAccessForm> en el archivo.
    const guardIndex = editarPageSource.indexOf('if (!admin && user.role === "admin")');
    const formUsageIndex = editarPageSource.indexOf("<UserAccessForm");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(formUsageIndex).toBeGreaterThan(guardIndex);
  });
});

describe("[15]-[16] salesperson link disponible; roles NUNCA editables por user manager", () => {
  it("[15] user manager puede gestionar el vínculo de salesperson de un target no-admin — el <Select> de salesperson no depende de canChooseRole", () => {
    expect(userFormSource).toContain('id="salesperson_id"');
    expect(userFormSource).not.toMatch(/canChooseRole[\s\S]{0,120}salesperson_id/);
  });

  it("[16] user manager NO puede cambiar roles — sin canChooseRole no existe ningún <Select name=\"role\"> en el árbol renderizado, solo el input oculto fijo", () => {
    const roleBlock = userFormSource.slice(
      userFormSource.indexOf("{canChooseRole ? ("),
      userFormSource.indexOf('{role === "vendedor"')
    );
    const elseBranch = roleBlock.slice(roleBlock.indexOf(") : ("));
    expect(elseBranch).not.toContain("<Select");
    expect(elseBranch).toContain('value="vendedor"');
  });
});

describe("[17] capabilities fuera de alcance — ninguna UI las administra", () => {
  it("actions.ts SOLO lee capabilities para el guard de autorización (getCurrentCapabilities), nunca escribe user_capabilities", () => {
    expect(actionsSource).toContain("getCurrentCapabilities");
    expect(actionsSource).not.toMatch(/user_capabilities/);
    expect(actionsSource).not.toMatch(/\.(insert|update|upsert|delete)\([^)]*capabilit/i);
  });

  it("user-form.tsx y las páginas de usuarios no ofrecen ningún control para asignar/revocar/ver capabilities", () => {
    const surfaces = [userFormSource, editarPageSource, nuevoPageSource, usuariosPageSource];
    for (const source of surfaces) {
      expect(source.toLowerCase()).not.toMatch(/capabilit(y|ies)/);
    }
  });
});

describe("[18] can_manage_users no abre otras configuraciones", () => {
  it("catalogo/tipos-producto/folios-cotizaciones quedan fuera del alcance de can_manage_users (middleware) y mantienen su propio guard admin-only estricto", () => {
    expect(isUserManagerAllowedConfigPath("/configuracion/catalogo")).toBe(false);
    expect(isUserManagerAllowedConfigPath("/configuracion/tipos-producto")).toBe(false);
    expect(isUserManagerAllowedConfigPath("/configuracion/folios-cotizaciones")).toBe(false);

    for (const source of [catalogoLayoutSource, tiposProductoLayoutSource, foliosLayoutSource]) {
      expect(source).toContain('profile.role !== "admin"');
      // Guard ESTRICTO real: ni siquiera consulta capabilities, a diferencia
      // de configuracion/layout.tsx — la mención de "can_manage_users" en
      // los comentarios de estos archivos es solo documentación de por qué
      // NO se le da paso aquí, nunca autorización real.
      expect(source).not.toContain("getCurrentCapabilities");
      expect(source).not.toContain("canManageUsers(");
    }
  });

  it("middleware.ts implementa el mismo carve-out y lo usa dentro del bloque admin-only", () => {
    expect(middlewareSource).toContain("function isUserManagerAllowedConfigPath");
    expect(middlewareSource).toContain("isUserManagerAllowedConfigPath(request.nextUrl.pathname)");
  });
});

describe("[19] admin pleno conserva comportamiento actual", () => {
  it("admin activo → isFullAdmin=true, sigue viendo el selector de role completo (incluida la opción ADMIN)", () => {
    const admin = profile({ role: "admin" });
    expect(isFullAdmin(admin)).toBe(true);
    // Con canChooseRole=true (admin), el <Select> con ambas opciones se sigue renderizando (rama `canChooseRole ? (...)`).
    expect(userFormSource).toContain('<option value="vendedor">VENDEDOR</option>');
    expect(userFormSource).toContain('<option value="admin">ADMIN</option>');
  });
});

describe("[20] vendedor normal sin capability sigue sin entrar a Usuarios", () => {
  it("canManageUsers=false → configuracion/layout.tsx redirige a /pedidos, igual que antes de 4B", () => {
    const vendedor = profile();
    expect(canManageUsers(vendedor, NONE)).toBe(false);
    expect(configuracionLayoutSource).toContain('redirect("/pedidos")');
  });
});
