import "dotenv/config";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = "GlobalQuote2026!";
const E2E_SKU = "GFB-E2E-001";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}

// Playwright's TS runner doesn't resolve "server-only", so this talks to
// Postgres directly (pg) instead of importing the app's Prisma client —
// only to make the "create a product" test idempotent across reruns.
async function deleteE2eTestProduct() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query("select id from products where internal_sku = $1", [E2E_SKU]);
  for (const row of rows) {
    await pool.query("delete from price_list_items where product_id = $1", [row.id]);
    await pool.query("delete from product_costs where product_id = $1", [row.id]);
    await pool.query("delete from products where id = $1", [row.id]);
  }
  await pool.end();
}

test.describe("product CRUD (Módulo 3 extendido)", () => {
  test.beforeAll(deleteE2eTestProduct);
  test.afterAll(deleteE2eTestProduct);

  test("a Vendedor is redirected away from /products/new", async ({ page }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/products/new");
    await expect(page).toHaveURL(/\/dashboard\?error=forbidden/);
  });

  test("Administración creates a product and sees the computed price/margin", async ({ page }) => {
    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto("/products/new");

    await page.fill('input[name="internalSku"]', "GFB-E2E-001");
    await page.fill('input[name="name"]', "Producto de prueba e2e");
    await page.fill('input[name="purchaseCost"]', "20");
    await page.fill('input[name="logisticsCost"]', "1");
    await page.fill('input[name="targetMarginPct"]', "30");
    await page.fill('input[name="minMarginPct"]', "20");
    await page.fill('input[name="listPrice"]', "30");

    await expect(page.getByText("Costo aterrizado:")).toContainText("21");

    await page.click('button[type="submit"]:has-text("Crear producto")');
    await page.waitForURL(/\/products\/[0-9a-f-]+$/);

    await expect(page.getByRole("heading", { name: "Producto de prueba e2e" })).toBeVisible();
    await expect(page.getByText("Costos y márgenes")).toBeVisible();
  });

  test("Administración edits the product's cost and the price list reflects the change", async ({
    page,
  }) => {
    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto("/products");
    await page.getByRole("link", { name: "Producto de prueba e2e" }).click();
    await page.getByRole("link", { name: "Editar" }).click();

    await page.fill('input[name="purchaseCost"]', "25");
    await page.fill('input[name="listPrice"]', "40");
    await page.click('button[type="submit"]:has-text("Guardar cambios")');

    await page.waitForURL(/\/products\/[0-9a-f-]+$/);
    await expect(page.getByText("$40.00")).toBeVisible();
  });
});
