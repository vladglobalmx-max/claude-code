import { describe, expect, it } from "vitest";

import { canGenerateQuotationPdf } from "@/lib/quotations/pdf-gate";

describe("canGenerateQuotationPdf (docs/ARCHITECTURE.md §4.1/§6.2)", () => {
  it("blocks generation while the quotation is a draft or pending authorization", () => {
    expect(canGenerateQuotationPdf("DRAFT")).toBe(false);
    expect(canGenerateQuotationPdf("PENDING_APPROVAL")).toBe(false);
  });

  it("allows generation for every status after the quotation has been sent", () => {
    for (const status of [
      "SENT",
      "ACCEPTED",
      "REJECTED",
      "CANCELLED",
      "EXPIRED",
      "CONVERTED_TO_ORDER",
    ] as const) {
      expect(canGenerateQuotationPdf(status)).toBe(true);
    }
  });
});
