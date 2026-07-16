import "dotenv/config";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = "GlobalQuote2026!";
const E2E_CUSTOMER_NAME = "Cliente de prueba e2e";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}

async function deleteE2eTestCustomer() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query("select id from customers where legal_name = $1", [
    E2E_CUSTOMER_NAME,
  ]);
  for (const row of rows) {
    await pool.query("delete from contacts where customer_id = $1", [row.id]);
    await pool.query("delete from customers where id = $1", [row.id]);
  }
  await pool.end();
}

test.describe("customers RBAC and scope (Módulo 4)", () => {
  test.beforeAll(deleteE2eTestCustomer);
  test.afterAll(deleteE2eTestCustomer);

  test("a Vendedor only sees their own assigned customers, not the unassigned house account", async ({
    page,
  }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/customers");

    await expect(page.getByText("Distribuidora Higiene del Norte")).toBeVisible();
    await expect(page.getByText("Farmacias Salud Total México")).toBeVisible();
    await expect(page.getByText("Grupo Comercial Fresh Retail")).not.toBeVisible();
    // El vendedor no ve la columna de descuento autorizado (solo Administración/Super Admin).
    await expect(page.getByText("Descuento autorizado", { exact: true })).not.toBeVisible();
  });

  test("Administración sees every GFB customer including the unassigned house account", async ({
    page,
  }) => {
    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto("/customers");

    await expect(page.getByText("Grupo Comercial Fresh Retail")).toBeVisible();
    await expect(page.getByText("Descuento autorizado", { exact: true })).toBeVisible();
  });

  test("a Vendedor creates a prospect, which is auto-assigned to them", async ({ page }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/customers/new");

    // El campo de vendedor asignado/condiciones comerciales no debe existir para un Vendedor.
    await expect(page.getByText("Condiciones comerciales (solo Administración)")).not.toBeVisible();

    await page.fill('input[name="legalName"]', E2E_CUSTOMER_NAME);
    await page.click('button[type="submit"]:has-text("Crear cliente")');
    await page.waitForURL(/\/customers\/[0-9a-f-]+$/);

    await expect(page.getByRole("heading", { name: E2E_CUSTOMER_NAME })).toBeVisible();
    await expect(page.getByRole("main").getByText("Diego Ramírez")).toBeVisible();
    await expect(page.getByText("Prospecto")).toBeVisible();
  });

  test("Administración can edit the prospect and add a contact", async ({ page }) => {
    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto("/customers");
    await page.getByRole("link", { name: E2E_CUSTOMER_NAME }).click();

    await page.getByRole("link", { name: "Editar" }).click();
    await page.selectOption('select[name="status"]', "ACTIVE");
    await page.fill('input[name="authorizedDiscountPct"]', "12");
    await page.click('button[type="submit"]:has-text("Guardar cambios")');
    await page.waitForURL(/\/customers\/[0-9a-f-]+$/);

    await page.fill('input[name="name"]', "Contacto de prueba e2e");
    await page.click('button:has-text("+ Agregar contacto")');

    await expect(page.getByText("Contacto de prueba e2e")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("12%")).toBeVisible();
  });
});
