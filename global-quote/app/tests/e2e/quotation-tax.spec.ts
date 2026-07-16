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

async function cleanupE2eQuotations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(`
    select q.id from quotations q
    join customers c on c.id = q.customer_id
    where c.legal_name ilike '%Higiene del Norte%'
  `);
  for (const row of rows) {
    await pool.query("delete from quotation_status_history where quotation_id = $1", [row.id]);
    await pool.query("delete from quotation_items where quotation_id = $1", [row.id]);
    await pool.query("delete from quotations where id = $1", [row.id]);
  }
  await pool.end();
}

test.describe("IVA por cotización (tasa única elegida al crear)", () => {
  test.beforeAll(cleanupE2eQuotations);
  test.afterAll(cleanupE2eQuotations);

  test("a Vendedor picks IVA when creating a quotation and sees it broken out in the totals", async ({
    page,
  }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/quotations/new");

    await page.selectOption('select[name="customerId"]', {
      label: "Distribuidora Higiene del Norte S.A. de C.V. (Higiene del Norte)",
    });
    await page.selectOption('select[name="taxId"]', { label: "IVA (16%)" });
    await page.click('button:has-text("Crear cotización")');
    await page.waitForURL(/\/quotations\/[0-9a-f-]+$/);

    await page.selectOption('select[name="productId"]', {
      label: "GFB-ENJ-001 — Enjuague Bucal Menta Intensa 500ml",
    });
    await page.click('button:has-text("+ Agregar producto")');
    await expect(page.locator("p.font-medium", { hasText: "Enjuague Bucal Menta Intensa" })).toBeVisible();

    await expect(page.getByText("IVA (16%)")).toBeVisible();
    await expect(page.getByText("Total con IVA")).toBeVisible();

    // El total con IVA debe ser mayor al total sin impuesto.
    const total = await page.locator("dd.font-semibold").first().textContent();
    const totalConIva = await page.locator("dd.font-semibold").last().textContent();
    expect(total).not.toBe(totalConIva);
  });

  test("a quotation created without choosing a tax shows no IVA line", async ({ page }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/quotations/new");

    await page.selectOption('select[name="customerId"]', {
      label: "Distribuidora Higiene del Norte S.A. de C.V. (Higiene del Norte)",
    });
    // "taxId" se deja en "Sin impuesto" (valor por default).
    await page.click('button:has-text("Crear cotización")');
    await page.waitForURL(/\/quotations\/[0-9a-f-]+$/);

    await expect(page.getByText("IVA (16%)")).not.toBeVisible();
    await expect(page.getByText("Total con IVA")).toBeVisible();
  });

  test("the PDF of a quotation with IVA downloads successfully", async ({ page }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/quotations/new");

    await page.selectOption('select[name="customerId"]', {
      label: "Distribuidora Higiene del Norte S.A. de C.V. (Higiene del Norte)",
    });
    await page.selectOption('select[name="taxId"]', { label: "IVA (16%)" });
    await page.click('button:has-text("Crear cotización")');
    await page.waitForURL(/\/quotations\/[0-9a-f-]+$/);

    await page.selectOption('select[name="productId"]', {
      label: "GFB-ENJ-001 — Enjuague Bucal Menta Intensa 500ml",
    });
    await page.click('button:has-text("+ Agregar producto")');
    await page.click('button:has-text("Enviar cotización")');
    await expect(page.getByText("· Enviada")).toBeVisible();

    const pdfUrl = await page.locator('a:has-text("Descargar PDF")').getAttribute("href");
    const response = await page.request.get(new URL(pdfUrl!, page.url()).toString());
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
  });
});
