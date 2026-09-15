import { afterEach, describe, expect, it, vi } from "vitest";

// "server-only" siempre lanza fuera del bundler de Next — mockear para
// poder ejercitar render.tsx (importado por route.ts) en Vitest.
vi.mock("server-only", () => ({}));

const getCurrentProfile = vi.fn();
const getCurrentCapabilities = vi.fn();
const buildMock = vi.fn();

vi.mock("@/lib/auth/profile", () => ({ getCurrentProfile: (...args: unknown[]) => getCurrentProfile(...args) }));
vi.mock("@/lib/auth/capabilities", () => ({ getCurrentCapabilities: (...args: unknown[]) => getCurrentCapabilities(...args) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => ({ __marker: "session-client" }) }));
vi.mock("@/lib/pdf/documents/registry", () => ({
  PDF_DOCUMENT_ADAPTERS: {
    "sales-order": { docType: "sales-order", build: (...args: unknown[]) => buildMock(...args) },
  },
}));

const { GET } = await import("./route");

/**
 * THÖREN 0078 — el endpoint único. La autorización real (RLS + capability
 * de comisiones) vive en los adapters (adapters.test.ts) y en Postgres;
 * estos tests fijan el contrato del propio route handler: qué responde
 * ante cada resultado posible del adapter, y que declara runtime=nodejs.
 */
describe("GET /api/pdf/[docType]/[id] (THÖREN 0078)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("declara runtime nodejs explícitamente — @react-pdf/renderer no corre en Edge", async () => {
    const mod = await import("./route");
    expect(mod.runtime).toBe("nodejs");
  });

  it("docType no registrado -> 404, nunca intenta autenticar ni construir nada", async () => {
    const response = await GET(new Request("http://localhost/api/pdf/no-existe/id-1"), {
      params: { docType: "no-existe", id: "id-1" },
    });

    expect(response.status).toBe(404);
    expect(getCurrentProfile).not.toHaveBeenCalled();
  });

  it("sin sesión -> 401, nunca llega a resolver el documento", async () => {
    getCurrentProfile.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/pdf/sales-order/so-1"), {
      params: { docType: "sales-order", id: "so-1" },
    });

    expect(response.status).toBe(401);
    expect(buildMock).not.toHaveBeenCalled();
  });

  it("adapter devuelve null (RLS lo oculta / cross-org / sin capability) -> 404", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    getCurrentCapabilities.mockResolvedValue(new Set());
    buildMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/pdf/sales-order/otra-org"), {
      params: { docType: "sales-order", id: "otra-org" },
    });

    expect(response.status).toBe(404);
  });

  it("documento autorizado -> 200, application/pdf, Content-Disposition con el filename del adapter, buffer PDF válido", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    getCurrentCapabilities.mockResolvedValue(new Set());
    buildMock.mockResolvedValue({
      filename: "SO-20261509-004.pdf",
      spec: {
        documentTypeLabel: "Sales Order",
        folio: "SO-20261509-004",
        statusLabel: "Confirmada",
        dateLabel: "Creada: 01/01/2026",
        relatedData: [],
        columns: [],
        rows: [],
        totals: null,
        notes: null,
        isTest: false,
        disclaimer: null,
        branding: { logoUrl: null, organizationName: "GS Orders", businessUnitName: null },
        generatedAtLabel: "01/01/2026 00:00",
      },
    });

    const response = await GET(new Request("http://localhost/api/pdf/sales-order/so-1"), {
      params: { docType: "sales-order", id: "so-1" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="SO-20261509-004.pdf"');

    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.subarray(-10).toString("latin1")).toContain("%%EOF");
  });
});
