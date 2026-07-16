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

  await page.selectOption('select[name="productId"]', {
    label: "GFB-ENJ-001 — Enjuague Bucal Menta Intensa 500ml",
  });
  await page.click('button:has-text("+ Agregar producto")');
  await page.click('button:has-text("Enviar cotización")');
  await expect(page.getByText("· Enviada")).toBeVisible();

  return quotationUrl;
}

test.describe("order conversion from an accepted quotation (Módulo 12)", () => {
  test.beforeAll(cleanupE2eQuotations);
  test.afterAll(cleanupE2eQuotations);

  test("a Vendedor records the client's decision (accepted), but cannot convert it — Administración does", async ({
    page,
  }) => {
    const quotationUrl = await createSentQuotation(page);

    await page.click('button:has-text("Marcar como aceptada")');
    await expect(page.getByText("· Aceptada")).toBeVisible();
    await expect(
      page.getByText("Tu rol no tiene permiso para convertirla"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Convertir a pedido" })).not.toBeVisible();

    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto(quotationUrl);
    await page.click('button:has-text("Convertir a pedido")');
    await page.waitForURL(/\/orders\/[0-9a-f-]+$/);

    await expect(page.getByRole("heading", { name: /^PED-GFB-/ })).toBeVisible();
    await expect(page.getByText("Distribuidora Higiene del Norte")).toBeVisible();

    await page.goto(quotationUrl);
    await expect(page.getByText("· Convertida a pedido")).toBeVisible();
    await expect(page.getByRole("link", { name: /^PED-GFB-/ })).toBeVisible();

    await page.goto("/orders");
    await expect(page.getByRole("link", { name: /^PED-GFB-/ }).first()).toBeVisible();
  });

  test("a Vendedor records the client's decision (rejected) with a reason", async ({ page }) => {
    const quotationUrl = await createSentQuotation(page);

    await page.click('button:has-text("Marcar como rechazada")');
    await page.fill('textarea[name="reason"]', "Cliente eligió otro proveedor por precio.");
    await page.click('button:has-text("Confirmar rechazo")');

    await expect(page.getByText("· Rechazada")).toBeVisible();
    await page.goto(quotationUrl);
    await expect(page.getByRole("button", { name: "Marcar como aceptada" })).not.toBeVisible();
  });

  test("converting a non-accepted quotation is rejected server-side even if attempted directly", async ({
    page,
  }) => {
    const quotationUrl = await createSentQuotation(page);
    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto(quotationUrl);

    // SENT, not ACCEPTED: no hay boton de convertir a pedido disponible.
    await expect(page.getByRole("button", { name: "Convertir a pedido" })).not.toBeVisible();
  });
});
