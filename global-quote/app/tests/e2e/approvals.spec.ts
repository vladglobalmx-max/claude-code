import "dotenv/config";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = "GlobalQuote2026!";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}

async function deleteE2eTestQuotations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(`
    select q.id from quotations q
    join customers c on c.id = q.customer_id
    where c.legal_name ilike '%Higiene del Norte%'
  `);
  for (const row of rows) {
    await pool.query("delete from quotation_approvals where quotation_id = $1", [row.id]);
    await pool.query("delete from quotation_status_history where quotation_id = $1", [row.id]);
    await pool.query("delete from quotation_items where quotation_id = $1", [row.id]);
    await pool.query("delete from quotations where id = $1", [row.id]);
  }
  await pool.end();
}

async function createFlaggedQuotationPendingApproval(page: import("@playwright/test").Page) {
  await login(page, "diego.ramirez@globalsuppliermty.com");
  await page.goto("/quotations/new");

  await page.selectOption('select[name="customerId"]', {
    label: "Distribuidora Higiene del Norte S.A. de C.V. (Higiene del Norte)",
  });
  await page.click('button:has-text("Crear cotización")');
  await page.waitForURL(/\/quotations\/[0-9a-f-]+$/);

  await page.selectOption('select[name="productId"]', {
    label: "GFB-ENJ-004 — Enjuague Bucal Profesional 1L",
  });
  await page.click('button:has-text("+ Agregar producto")');

  await page.fill(
    'textarea[name="justification"]',
    "Cliente estratégico, autorizado verbalmente por Dirección General.",
  );
  await page.click('button:has-text("Enviar a autorización")');
  await expect(page.getByText("· Pendiente de autorización")).toBeVisible();

  return page.url();
}

test.describe("approvals workflow (Módulo 7)", () => {
  test.beforeAll(deleteE2eTestQuotations);
  test.afterAll(deleteE2eTestQuotations);

  test("Dirección General sees the pending MARGIN_BELOW_MIN exception and approves it", async ({
    page,
  }) => {
    const quotationUrl = await createFlaggedQuotationPendingApproval(page);

    await login(page, "direccion.general.demo@globalsuppliermty.com");
    await page.goto("/approvals");

    await expect(page.getByText("Margen por debajo del mínimo").first()).toBeVisible();
    await expect(
      page.getByText("Justificación de Diego Ramírez", { exact: false }),
    ).toBeVisible();

    await page.click('button:has-text("Aprobar")');
    await expect(page.getByText("No hay autorizaciones pendientes para ti.")).toBeVisible();

    await page.goto(quotationUrl);
    await expect(page.getByText("· Enviada")).toBeVisible();
    await expect(page.getByText("Margen por debajo del mínimo — Aprobada")).toBeVisible();
  });

  test("a rejected exception sends the quotation back to Borrador for the vendor to resubmit", async ({
    page,
  }) => {
    const quotationUrl = await createFlaggedQuotationPendingApproval(page);

    await login(page, "direccion.general.demo@globalsuppliermty.com");
    await page.goto("/approvals");

    await page.fill('input[name="decisionNote"]', "Ajusta el precio y vuelve a enviar.");
    await page.click('button:has-text("Rechazar")');
    await expect(page.getByText("No hay autorizaciones pendientes para ti.")).toBeVisible();

    await page.goto(quotationUrl);
    await expect(page.getByText("· Borrador")).toBeVisible();
    await expect(page.getByText("Margen por debajo del mínimo — Rechazada")).toBeVisible();
    await expect(page.getByText("Ajusta el precio y vuelve a enviar.", { exact: false })).toBeVisible();

    // El vendedor puede volver a enviarla: sigue marcada como pendiente de aprobar.
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto(quotationUrl);
    await expect(page.getByText("Requiere autorización", { exact: true })).toBeVisible();
  });

  test("Gerente de Ventas has no authority over MARGIN_BELOW_MIN and sees an empty inbox", async ({
    page,
  }) => {
    await createFlaggedQuotationPendingApproval(page);

    await login(page, "carlos.medina@globalsuppliermty.com");
    await page.goto("/approvals");

    await expect(page.getByText("No hay autorizaciones pendientes para ti.")).toBeVisible();
  });

  test("Administración has the general permission but no rule authority, so its inbox is empty", async ({
    page,
  }) => {
    await createFlaggedQuotationPendingApproval(page);

    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto("/approvals");

    await expect(page.getByText("No hay autorizaciones pendientes para ti.")).toBeVisible();
  });

  test("Marketing has no APPROVE_EXCEPTION permission and is redirected away from /approvals", async ({
    page,
  }) => {
    await login(page, "sofia.hernandez@globalsuppliermty.com");
    await page.goto("/approvals");
    await expect(page).toHaveURL(/\/dashboard\?error=forbidden/);
  });
});
