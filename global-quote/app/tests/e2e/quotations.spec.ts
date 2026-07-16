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
    await pool.query("delete from quotation_status_history where quotation_id = $1", [row.id]);
    await pool.query("delete from quotation_items where quotation_id = $1", [row.id]);
    await pool.query("delete from quotations where id = $1", [row.id]);
  }
  await pool.end();
}

test.describe("quotations core flow (Módulo 6)", () => {
  test.beforeAll(deleteE2eTestQuotations);
  test.afterAll(deleteE2eTestQuotations);

  test("Marketing has no access to quotations", async ({ page }) => {
    await login(page, "sofia.hernandez@globalsuppliermty.com");
    await page.goto("/quotations");
    await expect(page.getByText("Tu rol no tiene acceso a cotizaciones.")).toBeVisible();

    await page.goto("/quotations/new");
    await expect(page).toHaveURL(/\/dashboard\?error=forbidden/);
  });

  test("a Vendedor creates a quotation, adds a healthy-margin product, and sends it", async ({
    page,
  }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/quotations/new");

    await page.selectOption('select[name="customerId"]', {
      label: "Distribuidora Higiene del Norte S.A. de C.V. (Higiene del Norte)",
    });
    await page.click('button:has-text("Crear cotización")');
    await page.waitForURL(/\/quotations\/[0-9a-f-]+$/);

    await expect(page.getByText("Borrador")).toBeVisible();

    await page.selectOption('select[name="productId"]', {
      label: "GFB-ENJ-001 — Enjuague Bucal Menta Intensa 500ml",
    });
    await page.fill('input[name="qty"]', "2");
    await page.click('button:has-text("+ Agregar producto")');

    await expect(page.getByRole("cell", { name: "$92.30" })).toBeVisible();
    await expect(page.getByText("Requiere autorización", { exact: true })).not.toBeVisible();

    await page.click('button:has-text("Enviar cotización")');
    // El estatus va embebido en un parrafo ("... · Enviada"), no es un nodo
    // propio, asi que no se puede usar exact:true aqui.
    await expect(page.getByText("· Enviada")).toBeVisible();
  });

  test("adding the stale-margin product flags the quotation and routes it to approval on send", async ({
    page,
  }) => {
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

    await expect(page.getByText("Requiere autorización", { exact: true })).toBeVisible();
    await expect(page.getByText("Margen por debajo del mínimo")).toBeVisible();

    await page.click('button:has-text("Enviar a autorización")');
    await expect(page.getByText("· Pendiente de autorización")).toBeVisible();
  });

  test("Administración sees the Vendedor's quotations too", async ({ page }) => {
    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto("/quotations");

    await expect(page.getByText("Diego Ramírez").first()).toBeVisible();
  });
});
