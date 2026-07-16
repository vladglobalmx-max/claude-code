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
    await pool.query("delete from quotation_followups where quotation_id = $1", [row.id]);
    await pool.query("delete from quotation_versions where quotation_id = $1", [row.id]);
    await pool.query("delete from quotation_approvals where quotation_id = $1", [row.id]);
    await pool.query("delete from quotation_status_history where quotation_id = $1", [row.id]);
    await pool.query("delete from quotation_items where quotation_id = $1", [row.id]);
    await pool.query("delete from quotations where id = $1", [row.id]);
  }
  await pool.end();
}

async function createSentQuotation(page: import("@playwright/test").Page, validUntil?: string) {
  await login(page, "diego.ramirez@globalsuppliermty.com");
  await page.goto("/quotations/new");

  await page.selectOption('select[name="customerId"]', {
    label: "Distribuidora Higiene del Norte S.A. de C.V. (Higiene del Norte)",
  });
  if (validUntil) {
    await page.fill('input[name="validUntil"]', validUntil);
  }
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

test.describe("quotation follow-ups and automatic expiration (Módulo 11)", () => {
  test.beforeAll(cleanupE2eQuotations);
  test.afterAll(cleanupE2eQuotations);

  test("a Vendedor logs a follow-up on their sent quotation and sees it bucketed on /followups", async ({
    page,
  }) => {
    const quotationUrl = await createSentQuotation(page);

    await page.selectOption('select[name="contactMethod"]', "PHONE");
    await page.fill('input[name="nextFollowupAt"]', "2026-07-16");
    await page.fill('input[name="closeProbabilityPct"]', "70");
    await page.fill('input[name="objection"]', "Precio alto frente a la competencia");
    await page.fill('textarea[name="comments"]', "Llamada de seguimiento, cliente interesado.");
    await page.click('button:has-text("+ Registrar seguimiento")');

    await expect(page.getByText("Teléfono — Diego Ramírez", { exact: false })).toBeVisible();
    await expect(page.getByText("Objeción: Precio alto frente a la competencia")).toBeVisible();

    await page.goto("/followups");
    await expect(page.getByRole("link", { name: /^GFB-/ }).first()).toBeVisible();
  });

  test("adding a follow-up to a draft quotation is not offered", async ({ page }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/quotations/new");
    await page.selectOption('select[name="customerId"]', {
      label: "Distribuidora Higiene del Norte S.A. de C.V. (Higiene del Norte)",
    });
    await page.click('button:has-text("Crear cotización")');
    await page.waitForURL(/\/quotations\/[0-9a-f-]+$/);

    await expect(page.locator('select[name="contactMethod"]')).not.toBeVisible();
  });

  test("Super Admin manually expires an overdue sent quotation from /admin/followups", async ({
    page,
  }) => {
    const quotationUrl = await createSentQuotation(page, "2020-01-01");

    await login(page, "ana.torres@globalsuppliermty.com");
    await page.goto("/admin/followups");
    await expect(page.getByText(/cotización\(es\) enviada\(s\) ya pasaron su vigencia/)).toBeVisible();

    await page.click('button:has-text("Ejecutar vencimiento ahora")');
    await page.waitForURL(/\/admin\/followups\?expired=/);
    await expect(page.getByText(/Se vencieron \d+ cotización/)).toBeVisible();

    await page.goto(quotationUrl);
    await expect(page.getByText("· Vencida")).toBeVisible();
  });

  test("a Gerente de Ventas without CONFIGURE_SEQUENCES cannot reach /admin/followups", async ({
    page,
  }) => {
    await login(page, "carlos.medina@globalsuppliermty.com");
    await page.goto("/admin/followups");
    await expect(page).toHaveURL(/\/dashboard\?error=forbidden/);
  });

  test("the cron endpoint requires the shared secret and works without a user session", async ({
    playwright,
  }) => {
    const request = await playwright.request.newContext();
    const noAuth = await request.get("/api/cron/expire-quotations", {
      baseURL: "http://localhost:3100",
    });
    expect(noAuth.status()).toBe(401);

    const wrongSecret = await request.get("/api/cron/expire-quotations", {
      baseURL: "http://localhost:3100",
      headers: { Authorization: "Bearer wrong-secret" },
    });
    expect(wrongSecret.status()).toBe(401);

    const correctSecret = await request.get("/api/cron/expire-quotations", {
      baseURL: "http://localhost:3100",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(correctSecret.status()).toBe(200);
    const body = await correctSecret.json();
    expect(body).toHaveProperty("expiredCount");
    await request.dispose();
  });
});
