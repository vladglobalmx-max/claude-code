import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = "GlobalQuote2026!";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}

test.describe("products catalog RBAC (Módulo 3)", () => {
  test("a Vendedor sees GFB products with prices but no cost/margin columns", async ({ page }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/products");

    await expect(page.getByText("GFB-ENJ-001")).toBeVisible();
    await expect(page.getByText("Costo aterrizado")).not.toBeVisible();
    await expect(page.getByText("Margen", { exact: true })).not.toBeVisible();
  });

  test("a Super Admin sees cost and margin columns, including the below-minimum warning", async ({
    page,
  }) => {
    await login(page, "ana.torres@globalsuppliermty.com");
    await page.goto("/products");

    await expect(page.getByText("Costo aterrizado")).toBeVisible();
    const staleRow = page.locator("tr", { hasText: "GFB-ENJ-004" });
    await expect(staleRow.getByText("⚠", { exact: false })).toBeVisible();
  });

  test("product detail page hides the cost section from a Vendedor", async ({ page }) => {
    await login(page, "diego.ramirez@globalsuppliermty.com");
    await page.goto("/products");
    await page.getByRole("link", { name: "Enjuague Bucal Menta Intensa 500ml" }).click();
    await expect(page).toHaveURL(/\/products\//);
    await expect(page.getByText("Costos y márgenes")).not.toBeVisible();
    await expect(page.getByText("Precio de lista vigente")).toBeVisible();
  });

  test("product detail page shows the cost breakdown to Administración", async ({ page }) => {
    await login(page, "laura.gonzalez@globalsuppliermty.com");
    await page.goto("/products");
    await page.getByRole("link", { name: "Enjuague Bucal Profesional 1L" }).click();
    await expect(page.getByText("Costos y márgenes")).toBeVisible();
    await expect(page.getByText("Costo aterrizado")).toBeVisible();
  });
});
