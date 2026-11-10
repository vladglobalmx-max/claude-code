// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "./sidebar";
import { NAV_GROUPS } from "./nav-config";

let mockPathname = "/inicio";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

afterEach(() => {
  cleanup();
});

/**
 * THÖREN | SIDEBAR DESPLEGABLE — props que muestran las 19 entradas (admin
 * + comisiones + ningún módulo deshabilitado), para poder afirmar sobre el
 * conteo total real, no un subconjunto.
 */
const baseProps = {
  role: "admin" as const,
  canManageUsers: true,
  canManageCommissions: true,
  canViewOwnCommissions: false,
  disabledModules: [],
  departments: [],
  organizationName: "THÖREN Test",
  collapsed: false,
  onToggleCollapsed: vi.fn(),
  mobileOpen: false,
  onCloseMobile: vi.fn(),
};

const ALL_19_HREFS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));

describe("Sidebar — menú desplegable por departamento", () => {
  it("son exactamente 19 entradas en nav-config.ts (fixture de este archivo de test)", () => {
    expect(ALL_19_HREFS).toHaveLength(19);
  });

  it("al entrar a una página, su departamento (Compras) aparece abierto automáticamente — Ventas, otro departamento, permanece cerrado", () => {
    mockPathname = "/compras";
    render(<Sidebar {...baseProps} />);

    // Compras (departamento activo) — su entrada visible sin clic.
    expect(screen.getByRole("link", { name: /^Compras$/ })).toBeTruthy();
    // Ventas (no activo) — Clientes no debe estar en el DOM todavía.
    expect(screen.queryByRole("link", { name: /^Clientes$/ })).toBeNull();
  });

  it("cada departamento se abre y cierra de forma independiente con clic en su encabezado", () => {
    mockPathname = "/inicio"; // ningún departamento activo por defecto
    render(<Sidebar {...baseProps} />);

    expect(screen.queryByRole("link", { name: /^Clientes$/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Ventas/ }));
    expect(screen.getByRole("link", { name: /^Clientes$/ })).toBeTruthy();
    // Logística, sin tocar, sigue cerrado.
    expect(screen.queryByRole("link", { name: /^Entregas$/ })).toBeNull();

    // Cerrar Ventas de nuevo.
    fireEvent.click(screen.getByRole("button", { name: /Ventas/ }));
    expect(screen.queryByRole("link", { name: /^Clientes$/ })).toBeNull();
  });

  it("abriendo los 5 departamentos, las 19 entradas existen (ninguna desapareció)", () => {
    mockPathname = "/inicio";
    render(<Sidebar {...baseProps} />);

    for (const label of ["Ventas", "Logística", "Compras", "Almacén", "Administración"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
    }

    const links = screen.getAllByRole("link");
    const hrefs = links.map((a) => a.getAttribute("href")).sort();
    expect(hrefs).toEqual([...ALL_19_HREFS].sort());
  });

  it("Inicio está siempre visible, sin encabezado colapsable, incluso con los 5 departamentos cerrados", () => {
    mockPathname = "/compras";
    render(<Sidebar {...baseProps} />);
    expect(screen.getByRole("link", { name: /^Inicio$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Inicio$/ })).toBeNull();
  });

  it("en modo colapsado (riel de iconos) el acordeón se omite — las 19 entradas se muestran siempre", () => {
    mockPathname = "/inicio";
    render(<Sidebar {...baseProps} collapsed />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(19);
  });
});

describe("Sidebar — control de acceso por departamentos (filtro ADITIVO sobre el de siempre)", () => {
  const vendedorBaseProps = {
    ...baseProps,
    role: "vendedor" as const,
    canManageUsers: false,
    canManageCommissions: false,
    canViewOwnCommissions: false,
  };

  it("transición segura — sin ninguna asignación todavía, un vendedor conserva exactamente su acceso actual", () => {
    mockPathname = "/inicio";
    render(<Sidebar {...vendedorBaseProps} departments={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /Ventas/ }));
    fireEvent.click(screen.getByRole("button", { name: /Compras/ }));

    expect(screen.getByRole("link", { name: /^Clientes$/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Compras$/ })).toBeTruthy();
  });

  it("vendedor con Ventas asignado ve únicamente el departamento de Ventas — Compras no aparece ni siquiera su encabezado", () => {
    mockPathname = "/inicio";
    render(<Sidebar {...vendedorBaseProps} departments={["ventas"]} />);

    fireEvent.click(screen.getByRole("button", { name: /^Ventas$/ }));
    expect(screen.getByRole("link", { name: /^Clientes$/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Cotizaciones$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Compras$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Almacén$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Logística$/ })).toBeNull();
  });

  it("vendedor con Compras+Almacén asignados ve ambos departamentos, nada de Ventas", () => {
    mockPathname = "/inicio";
    render(<Sidebar {...vendedorBaseProps} departments={["compras", "almacen"]} />);

    fireEvent.click(screen.getByRole("button", { name: /^Compras$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Almacén$/ }));

    expect(screen.getByRole("link", { name: /^Proveedores$/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Inventario$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Ventas$/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Clientes$/ })).toBeNull();
  });

  it("admin conserva acceso completo sin importar los departamentos asignados", () => {
    mockPathname = "/inicio";
    render(<Sidebar {...baseProps} departments={["ventas"]} />);

    fireEvent.click(screen.getByRole("button", { name: /^Compras$/ }));
    expect(screen.getByRole("link", { name: /^Proveedores$/ })).toBeTruthy();
  });

  it("Inicio/Configuración (sin moduleKey) y Unidades de Negocio nunca se restringen por departamento", () => {
    mockPathname = "/inicio";
    render(<Sidebar {...vendedorBaseProps} departments={["ventas"]} />);

    expect(screen.getByRole("link", { name: /^Inicio$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Administración$/ }));
    expect(screen.getByRole("link", { name: /^Unidades de Negocio$/ })).toBeTruthy();
  });
});
