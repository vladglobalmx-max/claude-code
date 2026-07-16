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

async function createSentQuotation(page: import("@playwright/test").Page) {
  await login(page, "diego.ramirez@globalsuppliermty.com");
  await page.goto("/quotations/new");

  await page.selectOption('select[name="customerId"]', {
    label: "Distribuidora Higiene del Norte S.A. de C.V. (Higiene del Norte)",
  });
  await page.click('button:has-text("Crear cotización")');
  await page.waitForURL(/\/quotations\/[0-9a-f-]+$/);

  await page.selectOption('select[name="productId"]', {
    label: "GFB-ENJ-001 — Enjuague Bucal Menta Intensa 500ml",
  });
  await page.fill('input[name="qty"]', "2");
  await page.click('button:has-text("+ Agregar producto")');

  await page.click('button:has-text("Enviar cotización")');
  await expect(page.getByText("· Enviada")).toBeVisible();

  return page.url();
}

test.describe("quotation PDF (Módulo 9)", () => {
  test.beforeAll(deleteE2eTestQuotations);
  test.afterAll(deleteE2eTestQuotations);

  test("a sent quotation shows a working PDF download link", async ({ page }) => {
    const quotationUrl = await createSentQuotation(page);
    await page.goto(quotationUrl);

    const downloadLink = page.getByRole("link", { name: "Descargar PDF" });
    await expect(downloadLink).toBeVisible();

    const pdfUrl = await downloadLink.getAttribute("href");
    const response = await page.request.get(pdfUrl!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    const body = await response.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("a draft quotation has no PDF link and blocks direct access to the route", async ({
    page,
  }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/quotations/new");

    await page.selectOption('select[name="customerId"]', {
      label: "Distribuidora Higiene del Norte S.A. de C.V. (Higiene del Norte)",
    });
    await page.click('button:has-text("Crear cotización")');
    await page.waitForURL(/\/quotations\/[0-9a-f-]+$/);
    const quotationUrl = page.url();

    await expect(page.getByRole("link", { name: "Descargar PDF" })).not.toBeVisible();

    const response = await page.request.get(`${quotationUrl}/pdf`);
    expect(response.status()).toBe(403);
  });

  test("a quotation pending authorization has no PDF link and blocks direct access", async ({
    page,
  }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/quotations/new");

    await page.selectOption('select[name="customerId"]', {
      label: "Distribuidora Higiene del Norte S.A. de C.V. (Higiene del Norte)",
    });
    await page.click('button:has-text("Crear cotización")');
    await page.waitForURL(/\/quotations\/[0-9a-f-]+$/);
    const quotationUrl = page.url();

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

    await expect(page.getByRole("link", { name: "Descargar PDF" })).not.toBeVisible();

    const response = await page.request.get(`${quotationUrl}/pdf`);
    expect(response.status()).toBe(403);
  });

  test("Marketing lacks GENERATE_PDF and is redirected away from the PDF route", async ({
    page,
  }) => {
    const quotationUrl = await createSentQuotation(page);

    await login(page, "sofia.hernandez@globalsuppliermty.com");
    await page.goto(`${quotationUrl}/pdf`);
    await expect(page).toHaveURL(/\/dashboard\?error=forbidden/);
  });
});
