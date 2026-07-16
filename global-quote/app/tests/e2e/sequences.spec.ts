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

// GTX y JUN se usan solo para el diagnostico de folios en este archivo — se
// limpian antes y despues para que la suite sea idempotente entre corridas
// (las demas specs usan GFB, así que no chocan entre sí).
async function resetTestSequences() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`
    delete from sequence_settings
    where business_unit_id in (select id from business_units where code in ('GTX', 'JUN'))
  `);
  await pool.end();
}

test.describe("folio sequence admin page (Módulo 5)", () => {
  test.beforeAll(resetTestSequences);
  test.afterAll(resetTestSequences);

  test("a Vendedor cannot reach /admin/sequences and doesn't see the nav link", async ({ page }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await expect(page.getByRole("link", { name: "Administración" })).not.toBeVisible();

    await page.goto("/admin/sequences");
    await expect(page).toHaveURL(/\/dashboard\?error=forbidden/);
  });

  test("Super Admin issues two quotation folios in a row and sees them increment", async ({
    page,
  }) => {
    await login(page, "ana.torres@globalsuppliermty.com");
    await page.getByRole("link", { name: "Administración" }).click();
    await page.getByRole("link", { name: "Folios y series" }).click();
    await expect(page).toHaveURL(/\/admin\/sequences/);

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");

    await page.selectOption('select[name="businessUnitId"]', { label: "GTX — GTX Systems" });
    await page.selectOption('select[name="documentType"]', "QUOTATION");
    await page.fill('input[name="sellerCode"]', "AT");
    await page.click('button:has-text("Emitir folio de prueba")');
    await expect(page.getByText(`GTX-${year}-${month}-0001-AT`)).toBeVisible();

    // La selección de línea/tipo debe sobrevivir al envío: la acción redirige
    // con la última selección codificada en la URL (searchParams), así que un
    // segundo clic sin volver a elegir nada sigue emitiendo para GTX.
    await page.click('button:has-text("Emitir folio de prueba")');
    await expect(page.getByText(`GTX-${year}-${month}-0002-AT`)).toBeVisible();

    // La sección de consecutivos por línea también refleja el número emitido.
    await expect(page.getByText("último consecutivo:").first()).toBeVisible();
  });

  test("order folios use the PED- prefix and an independent series from quotations", async ({
    page,
  }) => {
    await login(page, "ana.torres@globalsuppliermty.com");
    await page.goto("/admin/sequences");

    await page.selectOption('select[name="businessUnitId"]', { label: "JUN — Juno Promotional" });
    await page.selectOption('select[name="documentType"]', "ORDER");
    await page.fill('input[name="sellerCode"]', "AT");
    await page.click('button:has-text("Emitir folio de prueba")');

    const year = new Date().getFullYear();
    await expect(page.getByText(`PED-JUN-${year}-0001`)).toBeVisible();
  });
});
