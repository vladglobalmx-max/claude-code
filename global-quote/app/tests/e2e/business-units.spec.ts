import "dotenv/config";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = "GlobalQuote2026!";
const E2E_CODE = "ZZE";
const E2E_TAX_CODE = "IVAE2E";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}

async function cleanupE2eFixtures() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query("select id from business_units where code = $1", [E2E_CODE]);
  for (const row of rows) {
    await pool.query("delete from terms_and_conditions where business_unit_id = $1", [row.id]);
    await pool.query("delete from bank_accounts where business_unit_id = $1", [row.id]);
    await pool.query("delete from business_units where id = $1", [row.id]);
  }
  await pool.query("delete from taxes where code = $1", [E2E_TAX_CODE]);
  await pool.end();
}

test.describe("business units and configuration (Módulo 2)", () => {
  test.beforeAll(cleanupE2eFixtures);
  test.afterAll(cleanupE2eFixtures);

  test("a Vendedor cannot reach /admin/business-units or /admin/taxes and doesn't see the nav link", async ({
    page,
  }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await expect(page.locator("nav").getByText("Líneas de negocio")).not.toBeVisible();

    await page.goto("/admin/business-units");
    await expect(page).toHaveURL(/\/dashboard\?error=forbidden/);

    await page.goto("/admin/taxes");
    await expect(page).toHaveURL(/\/dashboard\?error=forbidden/);
  });

  test("Super Admin creates a new business unit and configures it end to end", async ({ page }) => {
    await login(page, "ana.torres@globalsuppliermty.com");
    await page.goto("/admin/business-units");
    await expect(page.getByText("GFB", { exact: true })).toBeVisible();

    await page.click('a:has-text("+ Nueva línea")');
    await page.fill('input[name="code"]', E2E_CODE);
    await page.fill('input[name="name"]', "Línea E2E de prueba");
    await page.click('button:has-text("Crear línea")');
    await page.waitForURL(/\/admin\/business-units\/[0-9a-f-]+$/);

    await expect(page.getByRole("heading", { name: E2E_CODE })).toBeVisible();

    // Los tres Server Actions de esta página redirigen a la MISMA URL —
    // Playwright's waitForURL resuelve de inmediato si ya estás en esa URL,
    // así que no confirma el round-trip; se espera en cambio a que la red
    // quede inactiva (POST + la recarga de datos que sigue al redirect)
    // antes de continuar con el siguiente formulario.
    async function submitAndWaitForRoundTrip(action: () => Promise<void>) {
      await action();
      await page.waitForLoadState("networkidle");
    }

    // Datos generales y fiscales
    await page.fill('input[name="legalName"]', "Línea E2E S.A. de C.V.");
    await page.fill('input[name="taxId"]', "LEE010101AB1");
    await page.fill('input[name="minMarginDefault"]', "22");
    await page.selectOption('select[name="folioNumberingMode"]', "CONTINUOUS");
    await submitAndWaitForRoundTrip(() => page.click('button:has-text("Guardar cambios")'));
    await expect(page.locator('select[name="folioNumberingMode"]')).toHaveValue("CONTINUOUS");

    // Cuenta bancaria
    await page.fill('input[name="bankName"]', "BBVA");
    await page.fill('input[name="accountHolder"]', "Global Supplier MTY S.A. de C.V.");
    await page.fill('input[name="accountNumber"]', "1122334455");
    await submitAndWaitForRoundTrip(() => page.click('button:has-text("+ Agregar cuenta")'));
    await expect(page.getByText("BBVA · MXN")).toBeVisible();

    // Términos y condiciones (versión 1)
    await page.fill('textarea[name="content"]', "Términos y condiciones versión 1 para la línea E2E.");
    await submitAndWaitForRoundTrip(() => page.click('button:has-text("Guardar nueva versión")'));
    await expect(page.locator('textarea[name="content"]')).toHaveValue(
      "Términos y condiciones versión 1 para la línea E2E.",
    );
    // El formulario se remonta (key={currentTerms.id}) cuando el servidor
    // confirma la nueva versión, para no dejar un valor viejo en un campo
    // no controlado — dale un instante a ese remount antes de volver a
    // escribir, si no la segunda escritura puede perderse en la carrera.
    await page.waitForTimeout(300);

    // Reemplaza con la versión 2 y verifica que la 1 quede en el historial
    await page.fill('textarea[name="content"]', "Términos y condiciones versión 2 para la línea E2E.");
    await submitAndWaitForRoundTrip(() => page.click('button:has-text("Guardar nueva versión")'));
    await expect(page.locator('textarea[name="content"]')).toHaveValue(
      "Términos y condiciones versión 2 para la línea E2E.",
    );
    await expect(page.getByText("Versiones anteriores")).toBeVisible();

    // Desactivar la cuenta bancaria
    await submitAndWaitForRoundTrip(() => page.click('button:has-text("Desactivar")'));
    await expect(page.getByText("Activar", { exact: true })).toBeVisible();

    // La nueva línea aparece en el listado
    await page.goto("/admin/business-units");
    await expect(page.getByText(E2E_CODE, { exact: true })).toBeVisible();
  });

  test("Super Admin rejects creating a business unit with a duplicate code", async ({ page }) => {
    await login(page, "ana.torres@globalsuppliermty.com");
    await page.goto("/admin/business-units/new");
    await page.fill('input[name="code"]', "GFB");
    await page.fill('input[name="name"]', "Duplicado");
    await page.click('button:has-text("Crear línea")');
    await expect(page.getByText("Ya existe una línea de negocio con el código GFB.")).toBeVisible();
  });

  test("Super Admin creates a tax and can deactivate it", async ({ page }) => {
    await login(page, "ana.torres@globalsuppliermty.com");
    await page.goto("/admin/taxes");

    await page.fill('input[name="code"]', E2E_TAX_CODE);
    await page.fill('input[name="name"]', "IVA de prueba");
    await page.fill('input[name="ratePct"]', "16");
    await page.click('button:has-text("+ Agregar impuesto")');
    await page.waitForURL(/\/admin\/taxes/);

    await expect(page.getByText(E2E_TAX_CODE)).toBeVisible();
    // Escopado a la fila de este impuesto — /admin/taxes también lista los
    // impuestos ya sembrados (p. ej. IVA), y un click genérico a "Desactivar"
    // tomaría el primero de la tabla, no necesariamente el que creó esta prueba.
    const row = page.locator("tr", { hasText: E2E_TAX_CODE });
    await row.getByRole("button", { name: "Desactivar" }).click();
    await page.waitForURL(/\/admin\/taxes/);
    await expect(page.locator("tr", { hasText: E2E_TAX_CODE })).toContainText("Inactivo");
  });
});
