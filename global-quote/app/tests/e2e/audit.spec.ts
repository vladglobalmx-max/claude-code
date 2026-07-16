import "dotenv/config";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = "GlobalQuote2026!";
const E2E_CUSTOMER_NAME = "Cliente de prueba auditoría";
const E2E_SKU = "GFB-AUDIT-001";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}

async function cleanupE2eFixtures() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows: customers } = await pool.query("select id from customers where legal_name = $1", [
    E2E_CUSTOMER_NAME,
  ]);
  for (const row of customers) {
    await pool.query("delete from contacts where customer_id = $1", [row.id]);
    await pool.query("delete from customers where id = $1", [row.id]);
  }

  const { rows: products } = await pool.query("select id from products where internal_sku = $1", [
    E2E_SKU,
  ]);
  for (const row of products) {
    await pool.query("delete from price_list_items where product_id = $1", [row.id]);
    await pool.query("delete from product_costs where product_id = $1", [row.id]);
    await pool.query("delete from products where id = $1", [row.id]);
  }
  // Los audit_logs que referencian estos ids quedan huérfanos a propósito
  // (entity_id es polimórfico, sin FK) — es el comportamiento correcto de
  // un historial de auditoría: sigue existiendo aunque la entidad se borre.
  await pool.end();
}

test.describe("audit log (Módulo 10)", () => {
  test.beforeAll(cleanupE2eFixtures);
  test.afterAll(cleanupE2eFixtures);

  test("editing a customer's authorized discount is logged, and appears in the audit view", async ({
    page,
  }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/customers/new");
    await page.fill('input[name="legalName"]', E2E_CUSTOMER_NAME);
    await page.click('button[type="submit"]:has-text("Crear cliente")');
    await page.waitForURL(/\/customers\/[0-9a-f-]+$/);

    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto("/customers");
    await page.getByRole("link", { name: E2E_CUSTOMER_NAME }).click();
    await page.getByRole("link", { name: "Editar" }).click();
    await page.fill('input[name="authorizedDiscountPct"]', "15");
    await page.click('button[type="submit"]:has-text("Guardar cambios")');
    await page.waitForURL(/\/customers\/[0-9a-f-]+$/);

    await page.goto("/admin/audit");
    await expect(page.getByText("authorizedDiscountPct").first()).toBeVisible();
    await expect(page.getByText("15", { exact: false }).first()).toBeVisible();
  });

  test("editing a product's cost is logged, and appears in the audit view filtered by entity", async ({
    page,
  }) => {
    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto("/products/new");
    await page.fill('input[name="internalSku"]', E2E_SKU);
    await page.fill('input[name="name"]', "Producto de prueba auditoría");
    await page.fill('input[name="purchaseCost"]', "20");
    await page.fill('input[name="logisticsCost"]', "1");
    await page.fill('input[name="targetMarginPct"]', "30");
    await page.fill('input[name="minMarginPct"]', "20");
    await page.fill('input[name="listPrice"]', "30");
    await page.click('button[type="submit"]:has-text("Crear producto")');
    await page.waitForURL(/\/products\/[0-9a-f-]+$/);

    await page.getByRole("link", { name: "Editar" }).click();
    await page.fill('input[name="purchaseCost"]', "28");
    await page.click('button[type="submit"]:has-text("Guardar cambios")');
    await page.waitForURL(/\/products\/[0-9a-f-]+$/);

    await page.goto("/admin/audit?entityType=Product");
    await expect(page.getByText("landedCost").first()).toBeVisible();
    await expect(page.getByText("authorizedDiscountPct")).toHaveCount(0);
  });

  test("Super Admin sees both Customer and Product entries with no restriction", async ({ page }) => {
    await login(page, "ana.torres@globalsuppliermty.com");
    await page.goto("/admin/audit");

    await expect(page.getByText("authorizedDiscountPct").first()).toBeVisible();
    await expect(page.getByText("landedCost").first()).toBeVisible();
  });

  test("Administración has partial access and still sees its own commercial domain", async ({
    page,
  }) => {
    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto("/admin/audit");

    await expect(page.getByText("authorizedDiscountPct").first()).toBeVisible();
    await expect(page.getByText("landedCost").first()).toBeVisible();
  });

  test("a Vendedor without VIEW_AUDIT is redirected away from /admin/audit", async ({ page }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/admin/audit");
    await expect(page).toHaveURL(/\/dashboard\?error=forbidden/);
    // El nav lateral no debe ofrecer el link — el h2 "Auditoría" de la
    // tarjeta de demo del dashboard (Módulo 1) es un elemento distinto.
    await expect(page.locator("nav").getByText("Auditoría")).not.toBeVisible();
    await expect(page.getByText("Tu rol no tiene acceso al registro de auditoría.")).toBeVisible();
  });
});
