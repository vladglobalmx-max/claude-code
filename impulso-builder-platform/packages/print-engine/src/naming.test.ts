import { describe, expect, it } from "vitest";
import { buildPrintFilename } from "./naming.js";

const BASE = { projectName: "Mi Sticker", profile: "print-pdf" as const, pageCount: 1, date: "2026-07-20T10:00:00.000Z", extension: "pdf" as const };

describe("buildPrintFilename", () => {
  it("produce el patrón nombre_perfil_fecha.ext para un solo archivo", () => {
    expect(buildPrintFilename(BASE)).toBe("Mi Sticker_print-pdf_2026-07-20.pdf");
  });

  it("agrega page-NN con padding de 2 dígitos cuando hay más de una página", () => {
    const name = buildPrintFilename({ ...BASE, pageCount: 3, pageIndex: 1, extension: "pdf" });
    expect(name).toBe("Mi Sticker_print-pdf_page-01_2026-07-20.pdf");
  });

  it("no agrega page-NN si pageCount es 1, aunque se pase pageIndex", () => {
    const name = buildPrintFilename({ ...BASE, pageCount: 1, pageIndex: 1 });
    expect(name).toBe("Mi Sticker_print-pdf_2026-07-20.pdf");
  });

  it("sanitiza caracteres inválidos del nombre del proyecto (reutiliza sanitizeFilename de export-engine)", () => {
    const name = buildPrintFilename({ ...BASE, projectName: 'Sticker "raro"/prueba' });
    expect(name).not.toMatch(/["/]/);
  });

  it("rechaza un nombre de proyecto vacío (mismo comportamiento que sanitizeFilename)", () => {
    expect(() => buildPrintFilename({ ...BASE, projectName: "   " })).toThrow();
  });

  it("usa solo la parte de fecha (YYYY-MM-DD) de un instant ISO completo", () => {
    const name = buildPrintFilename({ ...BASE, date: "2026-07-20T23:59:59.999Z" });
    expect(name).toContain("2026-07-20");
    expect(name).not.toContain("23:59");
  });

  it("es determinista: mismos inputs producen el mismo nombre", () => {
    expect(buildPrintFilename(BASE)).toBe(buildPrintFilename(BASE));
  });

  it("usa la extensión pedida (pdf/png) sin importar el perfil", () => {
    expect(buildPrintFilename({ ...BASE, extension: "png" })).toMatch(/\.png$/);
  });

  it("distintas páginas de un mismo job producen nombres distintos entre sí", () => {
    const page1 = buildPrintFilename({ ...BASE, pageCount: 2, pageIndex: 1 });
    const page2 = buildPrintFilename({ ...BASE, pageCount: 2, pageIndex: 2 });
    expect(page1).not.toBe(page2);
  });

  it("label 'sheet' (Fase 9.4, imposición) numera hojas en vez de páginas", () => {
    const name = buildPrintFilename({ ...BASE, pageCount: 2, pageIndex: 1, label: "sheet" });
    expect(name).toBe("Mi Sticker_print-pdf_sheet-01_2026-07-20.pdf");
    expect(name).not.toContain("page-");
  });

  it("sin label explícito, usa 'page' por defecto (compatibilidad con Fase 9.2)", () => {
    const name = buildPrintFilename({ ...BASE, pageCount: 2, pageIndex: 1 });
    expect(name).toContain("page-01");
  });
});
