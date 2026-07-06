import { test, expect } from "@playwright/test";

test.describe("Taller Page — /taller", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/taller");
  });

  test("renders page title and filters", async ({ page }) => {
    await expect(page.locator("text=Taller")).toBeVisible();
    await expect(page.locator("text=Órdenes de Trabajo")).toBeVisible();

    const searchInput = page.locator("input[placeholder='Buscar OT, cliente, vehículo…']");
    await expect(searchInput).toBeVisible();

    const statusSelect = page.locator("text=Todos los estados");
    await expect(statusSelect).toBeVisible();
  });

  test("search input accepts text", async ({ page }) => {
    const searchInput = page.locator("input[placeholder='Buscar OT, cliente, vehículo…']");
    await searchInput.fill("freno");
    await expect(searchInput).toHaveValue("freno");
  });

  test("pagination controls are rendered", async ({ page }) => {
    await expect(page.locator("text=Página 1 de 1").first()).toBeVisible();
    const prevBtn = page.locator("button:has(svg.lucide-chevron-left)");
    const nextBtn = page.locator("button:has(svg.lucide-chevron-right)");

    await expect(prevBtn).toBeDisabled();
    await expect(nextBtn).toBeDisabled();
  });

  test("status filter dropdown has all options", async ({ page }) => {
    const trigger = page.locator("button:has(span:has-text('Todos los estados'))");
    await trigger.click();

    await expect(page.locator("text=Abierta (Modo Regular)")).toBeVisible();
    await expect(page.locator("text=Reabierta (Reingreso)")).toBeVisible();
    await expect(page.locator("text=Ingreso x Traslado")).toBeVisible();
    await expect(page.locator("text=Reabierta Uso Total")).toBeVisible();
    await expect(page.locator("text=Pendiente de Atención")).toBeVisible();
    await expect(page.locator("text=Salida x Traslado")).toBeVisible();
    await expect(page.locator("text=Pendiente Atn. y Factura")).toBeVisible();
    await expect(page.locator("text=Pendiente de Factura")).toBeVisible();
    await expect(page.locator("text=Cerrada")).toBeVisible();
  });
});
