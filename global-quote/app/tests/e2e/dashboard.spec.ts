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
    await pool.query(
      "delete from order_items where order_id in (select id from orders where quotation_id = $1)",
      [row.id],
    );
    await pool.query("delete from orders where quotation_id = $1", [row.id]);
    await pool.query("delete from quotation_followups where quotation_id = $1", [row.id]);
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
  const quotationUrl = page.url();
  const folio = (await page.locator("h1").first().textContent())?.trim() ?? "";

  await page.selectOption('select[name="productId"]', {
    label: "GFB-ENJ-001 — Enjuague Bucal Menta Intensa 500ml",
  });
  await page.click('button:has-text("+ Agregar producto")');
  await page.click('button:has-text("Enviar cotización")');
  await expect(page.getByText("· Enviada")).toBeVisible();

  return { quotationUrl, folio };
}

test.describe("commercial dashboard (Módulo 13)", () => {
  test.beforeAll(cleanupE2eQuotations);
  test.afterAll(cleanupE2eQuotations);

  test("a Vendedor sees their own KPI cards but no margin card or breakdown tables", async ({ page }) => {
    await createSentQuotation(page);

    await page.goto("/dashboard");
    await expect(page.getByText("Indicadores comerciales")).toBeVisible();
    await expect(page.getByText("Cotizado", { exact: true })).toBeVisible();
    await expect(page.getByText("Margen promedio")).not.toBeVisible();
    await expect(page.getByText("Por línea de negocio")).not.toBeVisible();
    await expect(page.getByText("Por vendedor")).not.toBeVisible();
  });

  test("Administración sees the margin card and both breakdown tables", async ({ page }) => {
    await createSentQuotation(page);

    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto("/dashboard");
    await expect(page.getByText("Margen promedio", { exact: true })).toBeVisible();
    await expect(page.getByText("Por línea de negocio")).toBeVisible();
    await expect(page.getByText("Por vendedor")).toBeVisible();
    await expect(page.getByRole("cell", { name: "GFB" })).toBeVisible();
  });

  test("Marketing has no quotation visibility and sees no commercial KPI section", async ({ page }) => {
    await login(page, "sofia.hernandez@globalsuppliermty.com");
    await page.goto("/dashboard");
    await expect(page.getByText("Indicadores comerciales")).not.toBeVisible();
  });

  test("the CSV export downloads a real file scoped to the requesting user's visibility", async ({
    page,
  }) => {
    const { folio } = await createSentQuotation(page);

    const downloadPromise = page.waitForEvent("download");
    await page.goto("/dashboard");
    await page.click('a:has-text("Exportar CSV")');
    const download = await downloadPromise;
    const csvPath = await download.path();
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(csvPath!, "utf-8");

    expect(content).toContain("Folio,Línea,Vendedor,Estatus,Total,Margen %");
    expect(content).toContain(folio);
  });
});
