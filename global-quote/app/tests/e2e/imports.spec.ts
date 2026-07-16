import "dotenv/config";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = "GlobalQuote2026!";
const E2E_SKU_PREFIX = "GFB-E2EIMP-";
const E2E_CUSTOMER_PREFIX = "Cliente E2E Import ";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}

async function cleanupE2eImports() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query("select id from products where internal_sku ilike $1", [
    `${E2E_SKU_PREFIX}%`,
  ]);
  for (const row of rows) {
    await pool.query("delete from price_list_items where product_id = $1", [row.id]);
    await pool.query("delete from product_costs where product_id = $1", [row.id]);
    await pool.query("delete from products where id = $1", [row.id]);
  }
  await pool.query("delete from customers where legal_name ilike $1", [`${E2E_CUSTOMER_PREFIX}%`]);
  await pool.query("delete from import_logs where file_name ilike 'e2e-%'");
  await pool.end();
}

function csvFile(name: string, content: string) {
  return { name, mimeType: "text/csv", buffer: Buffer.from(content, "utf-8") };
}

test.describe("bulk imports (Módulo 14)", () => {
  test.beforeAll(cleanupE2eImports);
  test.afterAll(cleanupE2eImports);

  test("a Vendedor without IMPORT_DATA is redirected away from /admin/imports", async ({ page }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/admin/imports");
    await expect(page).toHaveURL(/\/dashboard\?error=forbidden/);
  });

  test("Super Admin previews and confirms a valid product CSV, and the product shows up in /products", async ({
    page,
  }) => {
    const sku = `${E2E_SKU_PREFIX}${Date.now()}`;
    const csv = [
      "businessUnitCode,sku,name,uom,categoryName,purchaseCost,logisticsCost,importExpenses,targetMarginPct,minMarginPct,priceListCode,listPrice",
      `GFB,${sku},Producto E2E Importado,PZA,Enjuagues bucales,10,1,0.5,30,20,GFB-LISTA-GENERAL,20`,
    ].join("\n");

    await login(page, "ana.torres@globalsuppliermty.com");
    await page.goto("/admin/imports");
    await page.selectOption('select[name="entityType"]', "PRODUCT");
    await page.selectOption('select[name="businessUnitId"]', { label: "GFB — Got Fresh Breath México" });
    await page.setInputFiles('input[name="file"]', csvFile("e2e-products-valid.csv", csv));
    await page.click('button:has-text("Vista previa")');

    await expect(page.getByText("1 se crearán")).toBeVisible();
    await expect(page.getByRole("cell", { name: sku })).toBeVisible();

    await page.click('button:has-text("Confirmar importación")');
    await expect(page.getByText("Importación completada.")).toBeVisible();
    await expect(page.getByText("1 de 1 fila(s) creadas.")).toBeVisible();

    await page.goto("/products");
    await expect(page.getByText(sku)).toBeVisible();
  });

  test("re-uploading the same SKU alongside a new one skips the duplicate but creates the new row", async ({
    page,
  }) => {
    const sku = `${E2E_SKU_PREFIX}${Date.now()}`;
    const firstCsv = [
      "businessUnitCode,sku,name,uom,categoryName,purchaseCost,logisticsCost,importExpenses,targetMarginPct,minMarginPct,priceListCode,listPrice",
      `GFB,${sku},Producto E2E Duplicado,PZA,Enjuagues bucales,10,1,0.5,30,20,GFB-LISTA-GENERAL,20`,
    ].join("\n");

    await login(page, "ana.torres@globalsuppliermty.com");
    await page.goto("/admin/imports");
    await page.selectOption('select[name="entityType"]', "PRODUCT");
    await page.selectOption('select[name="businessUnitId"]', { label: "GFB — Got Fresh Breath México" });
    await page.setInputFiles('input[name="file"]', csvFile("e2e-products-first.csv", firstCsv));
    await page.click('button:has-text("Vista previa")');
    await page.click('button:has-text("Confirmar importación")');
    await expect(page.getByText("Importación completada.")).toBeVisible();

    // Segunda vez: el mismo SKU otra vez (duplicado, se omite) junto con uno nuevo.
    const newSku = `${sku}-NEW`;
    const secondCsv = [
      "businessUnitCode,sku,name,uom,categoryName,purchaseCost,logisticsCost,importExpenses,targetMarginPct,minMarginPct,priceListCode,listPrice",
      `GFB,${sku},Producto E2E Duplicado,PZA,Enjuagues bucales,10,1,0.5,30,20,GFB-LISTA-GENERAL,20`,
      `GFB,${newSku},Producto E2E Nuevo,PZA,Enjuagues bucales,10,1,0.5,30,20,GFB-LISTA-GENERAL,20`,
    ].join("\n");

    await page.click('button:has-text("Nueva importación")');
    await page.selectOption('select[name="entityType"]', "PRODUCT");
    await page.selectOption('select[name="businessUnitId"]', { label: "GFB — Got Fresh Breath México" });
    await page.setInputFiles('input[name="file"]', csvFile("e2e-products-second.csv", secondCsv));
    await page.click('button:has-text("Vista previa")');
    await expect(page.getByText("Duplicado — se omite")).toBeVisible();

    await page.click('button:has-text("Confirmar importación")');
    await expect(page.getByText("1 de 2 fila(s) creadas · 1 duplicada(s) omitida(s).")).toBeVisible();
  });

  test("a batch with an unresolvable row shows the error and blocks confirmation entirely", async ({
    page,
  }) => {
    const goodSku = `${E2E_SKU_PREFIX}${Date.now()}-GOOD`;
    const csv = [
      "businessUnitCode,sku,name,uom,categoryName,purchaseCost,logisticsCost,importExpenses,targetMarginPct,minMarginPct,priceListCode,listPrice",
      `GFB,${goodSku},Producto Bueno,PZA,Enjuagues bucales,10,1,0.5,30,20,GFB-LISTA-GENERAL,20`,
      `GFB,${goodSku}-BAD,Producto Malo,PZA,Enjuagues bucales,10,1,0.5,30,20,LISTA-QUE-NO-EXISTE,20`,
    ].join("\n");

    await login(page, "ana.torres@globalsuppliermty.com");
    await page.goto("/admin/imports");
    await page.selectOption('select[name="entityType"]', "PRODUCT");
    await page.selectOption('select[name="businessUnitId"]', { label: "GFB — Got Fresh Breath México" });
    await page.setInputFiles('input[name="file"]', csvFile("e2e-products-error.csv", csv));
    await page.click('button:has-text("Vista previa")');

    await expect(page.getByText(/Hay filas con error/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar importación" })).toBeDisabled();

    await page.goto("/products");
    await expect(page.getByText(goodSku)).not.toBeVisible();
  });

  test("Administración imports a customer CSV and the prospect appears in /customers", async ({ page }) => {
    const legalName = `${E2E_CUSTOMER_PREFIX}${Date.now()}`;
    const csv = [
      "businessUnitCode,legalName,tradeName,taxId,industry,segment,notes",
      `GFB,${legalName},,,,,`,
    ].join("\n");

    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto("/admin/imports");
    await page.selectOption('select[name="entityType"]', "CUSTOMER");
    await page.selectOption('select[name="businessUnitId"]', { label: "GFB — Got Fresh Breath México" });
    await page.setInputFiles('input[name="file"]', csvFile("e2e-customers.csv", csv));
    await page.click('button:has-text("Vista previa")');
    await expect(page.getByRole("cell", { name: legalName })).toBeVisible();

    await page.click('button:has-text("Confirmar importación")');
    await expect(page.getByText("Importación completada.")).toBeVisible();

    await page.goto("/customers");
    await expect(page.getByText(legalName)).toBeVisible();
  });
});
