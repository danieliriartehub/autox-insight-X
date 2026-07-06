import { test, expect } from "@playwright/test";

test.describe("Almacen Page — /almacen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/almacen");
  });

  test("renders page title and KPI cards", async ({ page }) => {
    await expect(page.locator("text=Almacén").first()).toBeVisible();
    await expect(page.locator("text=Inventario, movimientos y alertas de stock")).toBeVisible();

    await expect(page.locator("text=SKUs activos")).toBeVisible();
    await expect(page.locator("text=Stock total")).toBeVisible();
    await expect(page.locator("text=Alertas críticas")).toBeVisible();
    await expect(page.locator("text=Stock en exceso")).toBeVisible();
  });

  test("tabs switch between Inventario and Alertas", async ({ page }) => {
    const invTab = page.locator("button:has-text('Inventario')");
    const altTab = page.locator("button:has-text('Alertas')");

    await expect(invTab).toBeVisible();
    await expect(altTab).toBeVisible();

    await expect(invTab).toHaveAttribute("data-state", "active");
    await expect(altTab).toHaveAttribute("data-state", "inactive");

    await altTab.click();
    await expect(invTab).toHaveAttribute("data-state", "inactive");
    await expect(altTab).toHaveAttribute("data-state", "active");
  });

  test("inventory table headers are present", async ({ page }) => {
    await expect(page.locator("text=Catálogo de inventario")).toBeVisible();
    await expect(page.locator("text=Código")).toBeVisible();
    await expect(page.locator("text=Repuesto")).toBeVisible();
    await expect(page.locator("text=Categoría").first()).toBeVisible();
    await expect(page.locator("text=Stock")).toBeVisible();
    await expect(page.locator("text=Mín")).toBeVisible();
    await expect(page.locator("text=Máx")).toBeVisible();
    await expect(page.locator("text=Estado")).toBeVisible();
  });

  test("search input filters by text", async ({ page }) => {
    const searchInput = page.locator("input[placeholder='Código o repuesto…']");
    await searchInput.fill("filtro");
    await expect(searchInput).toHaveValue("filtro");
  });

  test("category filter dropdown is present", async ({ page }) => {
    const catTrigger = page.locator("button:has(span:has-text('Todas las categorías'))");
    await expect(catTrigger).toBeVisible();
    await catTrigger.click();
    await expect(page.locator("text=Todas las categorías").first()).toBeVisible();
  });

  test("new purchase order button is present", async ({ page }) => {
    const newPoBtn = page.locator("button:has-text('Nueva orden de compra')");
    await expect(newPoBtn).toBeVisible();
  });
});
