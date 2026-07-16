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
    await pool.query("delete from quotation_versions where quotation_id = $1", [row.id]);
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

test.describe("quotation versioning (Módulo 8)", () => {
  test.beforeAll(deleteE2eTestQuotations);
  test.afterAll(deleteE2eTestQuotations);

  test("Administración edits a sent quotation, which versions it and appends -V2 to the folio", async ({
    page,
  }) => {
    const quotationUrl = await createSentQuotation(page);

    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto(quotationUrl);

    await expect(
      page.getByText("Esta cotización ya fue enviada.", { exact: false }),
    ).toBeVisible();

    await page.selectOption('select[name="productId"]', {
      label: "GFB-ENJ-001 — Enjuague Bucal Menta Intensa 500ml",
    });
    await page.fill('input[name="qty"]', "1");
    await page.click('button:has-text("+ Agregar producto")');

    await expect(page.getByText("-V2")).toBeVisible();
    await expect(page.getByText("· Enviada")).toBeVisible();
    await expect(page.getByText("Historial de versiones")).toBeVisible();
    await expect(page.getByText("Versión 1 (congelada)", { exact: false })).toBeVisible();
    await expect(page.getByText("Versión actual (viva, editable): 2")).toBeVisible();
  });

  test("a Vendedor cannot edit a sent quotation (no controls shown)", async ({ page }) => {
    const quotationUrl = await createSentQuotation(page);
    await page.goto(quotationUrl);

    await expect(page.locator('select[name="productId"]')).not.toBeVisible();
    await expect(
      page.getByText("Esta cotización ya fue enviada.", { exact: false }),
    ).not.toBeVisible();
  });

  test("Gerente de Ventas (no EDIT_APPROVED_QUOTATION) cannot edit a sent quotation either", async ({
    page,
  }) => {
    const quotationUrl = await createSentQuotation(page);

    await login(page, "carlos.medina@globalsuppliermty.com");
    await page.goto(quotationUrl);

    await expect(page.locator('select[name="productId"]')).not.toBeVisible();
  });
});
