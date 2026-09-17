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

// THÖREN — fix bug "Descargar PDF baja un .txt" (0081): las pruebas de las
// rutas de falla necesitan forzar que renderDocumentPdf rechace en un caso
// controlado, sin perder la implementación REAL para el resto de las
// pruebas (que sí validan bytes de PDF reales) — de ahí `importOriginal`.
const { renderDocumentPdf: realRenderDocumentPdf } = await vi.importActual<typeof import("@/lib/pdf/render")>("@/lib/pdf/render");
const renderDocumentPdfMock = vi.fn(realRenderDocumentPdf);
vi.mock("@/lib/pdf/render", () => ({
  renderDocumentPdf: (...args: Parameters<typeof realRenderDocumentPdf>) => renderDocumentPdfMock(...args),
}));

const { GET } = await import("./route");

const validSpec = {
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
};

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

  /**
   * THÖREN — fix bug "Descargar PDF en Orden de Compra baja un .txt"
   * (0081). Antes de este fix ninguna de estas 4 rutas de falla estaba
   * capturada: la excepción escapaba sin manejar, Next.js respondía su
   * error por defecto (Content-Type: text/plain, sin Content-Disposition)
   * y el navegador — al no tener extensión en la URL ni filename del
   * header — infería `.txt` del MIME type. Ahora TODA falla responde JSON
   * con Content-Type explícito, nunca una excepción cruda; y un logo de
   * Business Unit roto/inalcanzable (causa real más probable, ver
   * comentario del route.ts) se recupera con un reintento sin logo en vez
   * de tumbar la descarga completa.
   */
  it("adapter.build() lanza una excepción -> 500 JSON con Content-Type explícito, nunca escapa sin manejar", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    getCurrentCapabilities.mockResolvedValue(new Set());
    buildMock.mockRejectedValue(new Error("boom en el adapter"));

    const response = await GET(new Request("http://localhost/api/pdf/sales-order/so-1"), {
      params: { docType: "sales-order", id: "so-1" },
    });

    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const body = await response.json();
    expect(typeof body.error).toBe("string");
  });

  it("renderDocumentPdf() falla con un logo de Business Unit configurado -> reintenta UNA vez sin logo y responde el PDF real igualmente", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    getCurrentCapabilities.mockResolvedValue(new Set());
    buildMock.mockResolvedValue({
      filename: "OC-20261709-001.pdf",
      spec: { ...validSpec, branding: { logoUrl: "https://example.com/logo-roto.png", organizationName: "GS Orders", businessUnitName: "BU Uno" } },
    });
    renderDocumentPdfMock.mockRejectedValueOnce(new Error("no se pudo obtener la imagen del logo"));

    const response = await GET(new Request("http://localhost/api/pdf/sales-order/so-1"), {
      params: { docType: "sales-order", id: "so-1" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="OC-20261709-001.pdf"');
    expect(renderDocumentPdfMock).toHaveBeenCalledTimes(2);
    // El reintento debe pedir el spec SIN logo (cae a texto, PdfBranding).
    expect(renderDocumentPdfMock.mock.calls[1]![0].branding.logoUrl).toBeNull();

    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.subarray(-10).toString("latin1")).toContain("%%EOF");
  });

  it("renderDocumentPdf() falla y el reintento sin logo TAMBIÉN falla -> 500 JSON, nunca una excepción cruda", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    getCurrentCapabilities.mockResolvedValue(new Set());
    buildMock.mockResolvedValue({
      filename: "OC-20261709-001.pdf",
      spec: { ...validSpec, branding: { logoUrl: "https://example.com/logo-roto.png", organizationName: "GS Orders", businessUnitName: "BU Uno" } },
    });
    renderDocumentPdfMock.mockRejectedValue(new Error("sigue fallando, incluso sin logo"));

    const response = await GET(new Request("http://localhost/api/pdf/sales-order/so-1"), {
      params: { docType: "sales-order", id: "so-1" },
    });

    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(renderDocumentPdfMock).toHaveBeenCalledTimes(2);
  });

  it("renderDocumentPdf() falla SIN logo configurado -> 500 JSON directo, sin reintento (nada que reintentar)", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    getCurrentCapabilities.mockResolvedValue(new Set());
    buildMock.mockResolvedValue({ filename: "SO-20261509-004.pdf", spec: validSpec });
    renderDocumentPdfMock.mockRejectedValueOnce(new Error("boom en el render, sin logo de por medio"));

    const response = await GET(new Request("http://localhost/api/pdf/sales-order/so-1"), {
      params: { docType: "sales-order", id: "so-1" },
    });

    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(renderDocumentPdfMock).toHaveBeenCalledTimes(1);
  });
});
