import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import { decideApproval } from "@/lib/quotations/approvals";
import { QuotationMutationError } from "@/lib/quotations/mutations";
import { addQuotationItem, createQuotationDraft, submitQuotation } from "@/lib/quotations/mutations";

const createdQuotationIds: string[] = [];

afterEach(async () => {
  while (createdQuotationIds.length > 0) {
    const id = createdQuotationIds.pop()!;
    await prisma.quotationStatusHistory.deleteMany({ where: { quotationId: id } });
    await prisma.quotationItem.deleteMany({ where: { quotationId: id } });
    await prisma.quotation.deleteMany({ where: { id } });
  }
});

async function fixtures() {
  const businessUnit = await prisma.businessUnit.findUniqueOrThrow({ where: { code: "GFB" } });
  const seller = await prisma.user.findUniqueOrThrow({
    where: { email: "diego.ramirez@globalsuppliermty.com" },
  });
  const direccionGeneral = await prisma.user.findUniqueOrThrow({
    where: { email: "direccion.general.demo@globalsuppliermty.com" },
  });
  const gerenteVentas = await prisma.user.findUniqueOrThrow({
    where: { email: "carlos.medina@globalsuppliermty.com" },
  });
  const administracion = await prisma.user.findUniqueOrThrow({
    where: { email: "laura.gonzalez@globalsuppliermty.com" },
  });
  const customerWithPriceList = await prisma.customer.findFirstOrThrow({
    where: { legalName: { contains: "Higiene del Norte" } },
  });
  const staleMarginProduct = await prisma.product.findUniqueOrThrow({
    where: { internalSku: "GFB-ENJ-004" },
  });
  const healthyProduct = await prisma.product.findUniqueOrThrow({
    where: { internalSku: "GFB-ENJ-001" },
  });
  return {
    businessUnit,
    seller,
    direccionGeneral,
    gerenteVentas,
    administracion,
    customerWithPriceList,
    staleMarginProduct,
    healthyProduct,
  };
}

async function createPendingApprovalQuotation() {
  const { businessUnit, seller, customerWithPriceList, staleMarginProduct } = await fixtures();
  const draft = await createQuotationDraft({
    businessUnitId: businessUnit.id,
    customerId: customerWithPriceList.id,
    sellerId: seller.id,
    sellerCode: seller.folioCode!,
    validUntil: null,
    notes: null,
  });
  createdQuotationIds.push(draft.id);

  await addQuotationItem({
    quotationId: draft.id,
    productId: staleMarginProduct.id,
    qty: 1,
    discountPct: 0,
  });
  await submitQuotation({
    quotationId: draft.id,
    actorId: seller.id,
    justification: "Cliente estratégico, autorizado verbalmente por Dirección General.",
  });

  const approval = await prisma.quotationApproval.findFirstOrThrow({
    where: { quotationId: draft.id },
  });
  return { draft, approval };
}

describe("decideApproval (docs/ARCHITECTURE.md §12)", () => {
  it("approving a MARGIN_BELOW_MIN exception sends the quotation to SENT", async () => {
    const { draft, approval } = await createPendingApprovalQuotation();
    const { direccionGeneral } = await fixtures();

    await decideApproval({
      approvalId: approval.id,
      approverId: direccionGeneral.id,
      approverRole: "DIRECCION_GENERAL",
      decision: "APPROVED",
      decisionNote: null,
    });

    const quotation = await prisma.quotation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(quotation.status).toBe("SENT");

    const decided = await prisma.quotationApproval.findUniqueOrThrow({ where: { id: approval.id } });
    expect(decided.decision).toBe("APPROVED");
    expect(decided.approverId).toBe(direccionGeneral.id);
    expect(decided.decidedAt).not.toBeNull();

    const history = await prisma.quotationStatusHistory.findMany({
      where: { quotationId: draft.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((h) => h.toStatus)).toEqual(["DRAFT", "PENDING_APPROVAL", "SENT"]);
  });

  it("rejecting sends the quotation back to DRAFT (not a terminal rejection) and requires a note", async () => {
    const { draft, approval } = await createPendingApprovalQuotation();
    const { direccionGeneral } = await fixtures();

    await expect(
      decideApproval({
        approvalId: approval.id,
        approverId: direccionGeneral.id,
        approverRole: "DIRECCION_GENERAL",
        decision: "REJECTED",
        decisionNote: null,
      }),
    ).rejects.toThrow(QuotationMutationError);

    await decideApproval({
      approvalId: approval.id,
      approverId: direccionGeneral.id,
      approverRole: "DIRECCION_GENERAL",
      decision: "REJECTED",
      decisionNote: "El margen es demasiado bajo, ajusta el precio.",
    });

    const quotation = await prisma.quotation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(quotation.status).toBe("DRAFT");

    const decided = await prisma.quotationApproval.findUniqueOrThrow({ where: { id: approval.id } });
    expect(decided.decision).toBe("REJECTED");
    expect(decided.decisionNote).toBe("El margen es demasiado bajo, ajusta el precio.");
  });

  it("rejects a decision from a role without authority over MARGIN_BELOW_MIN", async () => {
    const { approval } = await createPendingApprovalQuotation();
    const { gerenteVentas } = await fixtures();

    await expect(
      decideApproval({
        approvalId: approval.id,
        approverId: gerenteVentas.id,
        approverRole: "GERENTE_VENTAS",
        decision: "APPROVED",
        decisionNote: null,
      }),
    ).rejects.toThrow(QuotationMutationError);

    const untouched = await prisma.quotationApproval.findUniqueOrThrow({ where: { id: approval.id } });
    expect(untouched.decision).toBe("PENDING");
  });

  it("rejects a decision from ADMINISTRACION despite holding the general approve-exception permission", async () => {
    const { approval } = await createPendingApprovalQuotation();
    const { administracion } = await fixtures();

    await expect(
      decideApproval({
        approvalId: approval.id,
        approverId: administracion.id,
        approverRole: "ADMINISTRACION",
        decision: "APPROVED",
        decisionNote: null,
      }),
    ).rejects.toThrow(QuotationMutationError);
  });

  it("rejects deciding an approval that was already decided", async () => {
    const { approval } = await createPendingApprovalQuotation();
    const { direccionGeneral } = await fixtures();

    await decideApproval({
      approvalId: approval.id,
      approverId: direccionGeneral.id,
      approverRole: "DIRECCION_GENERAL",
      decision: "APPROVED",
      decisionNote: null,
    });

    await expect(
      decideApproval({
        approvalId: approval.id,
        approverId: direccionGeneral.id,
        approverRole: "DIRECCION_GENERAL",
        decision: "APPROVED",
        decisionNote: null,
      }),
    ).rejects.toThrow(QuotationMutationError);
  });

  it("allows a rejected-then-resubmitted quotation to be approved on its second pass", async () => {
    const { draft, approval } = await createPendingApprovalQuotation();
    const { direccionGeneral, seller } = await fixtures();

    await decideApproval({
      approvalId: approval.id,
      approverId: direccionGeneral.id,
      approverRole: "DIRECCION_GENERAL",
      decision: "REJECTED",
      decisionNote: "Ajusta el precio y vuelve a enviar.",
    });

    const resubmitted = await submitQuotation({
      quotationId: draft.id,
      actorId: seller.id,
      justification: "Ajustado según observación de Dirección General, se mantiene la excepción.",
    });
    expect(resubmitted.status).toBe("PENDING_APPROVAL");

    const secondApproval = await prisma.quotationApproval.findFirstOrThrow({
      where: { quotationId: draft.id, decision: "PENDING" },
    });

    await decideApproval({
      approvalId: secondApproval.id,
      approverId: direccionGeneral.id,
      approverRole: "DIRECCION_GENERAL",
      decision: "APPROVED",
      decisionNote: null,
    });

    const quotation = await prisma.quotation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(quotation.status).toBe("SENT");
  });
});
