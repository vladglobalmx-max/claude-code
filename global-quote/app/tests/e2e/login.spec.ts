import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = "GlobalQuote2026!";

test.describe("login flow (Módulo 1)", () => {
  test("wrong password shows an error and does not redirect", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "diego.ramirez@globalsuppliermty.com");
    await page.fill('input[name="password"]', "wrong-password");
    await page.click('button[type="submit"]');

    await expect(page.getByRole("alert")).toHaveText("Correo o contraseña incorrectos.");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /dashboard redirects to /login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a Vendedor cannot see cost/margin data on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "diego.ramirez@globalsuppliermty.com");
    await page.fill('input[name="password"]', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await expect(page.locator("body")).not.toContainText("puede ver costos y márgenes");
    await expect(page.locator("body")).toContainText("no tiene permiso para ver costos");

    await page.click('button:has-text("Cerrar sesión")');
    await expect(page).toHaveURL(/\/login/);
  });

  test("a Super Admin can see cost/margin data on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "ana.torres@globalsuppliermty.com");
    await page.fill('input[name="password"]', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await expect(page.locator("body")).toContainText("puede ver costos y márgenes");

    await page.click('button:has-text("Cerrar sesión")');
    await expect(page).toHaveURL(/\/login/);
  });
});
