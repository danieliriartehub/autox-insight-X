import { test, expect } from "@playwright/test";

test.describe("Prediccion Page — /prediccion", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/prediccion");
  });

  test("renders command center header", async ({ page }) => {
    await expect(page.locator("text=Centro de Comando SCM Predictivo")).toBeVisible();
  });

  test("ML model status section is present", async ({ page }) => {
    await expect(page.locator("text=XGBoost Regressor")).toBeVisible();
    await expect(page.locator("text=demand-forecast")).toBeVisible();
    await expect(page.locator("text=Precisión global")).toBeVisible();
    await expect(page.locator("text=Precisión en repuestos clave")).toBeVisible();
    await expect(page.locator("text=Margen de error típico")).toBeVisible();
    await expect(page.locator("text=Confianza promedio")).toBeVisible();
  });

  test("retrain button is present", async ({ page }) => {
    const retrainBtn = page.locator("button:has-text('Reentrenar IA')");
    await expect(retrainBtn).toBeVisible();
    await expect(retrainBtn).toBeEnabled();
  });

  test("SCM KPI cards are rendered", async ({ page }) => {
    await expect(page.locator("text=Salud Logística")).toBeVisible();
    await expect(page.locator("text=Quiebres Inminentes")).toBeVisible();
    await expect(page.locator("text=Volumen a Abastecer")).toBeVisible();
    await expect(page.locator("text=Días de Cobertura Promedio")).toBeVisible();
  });

  test("scenario selector switches between modes", async ({ page }) => {
    const scenarioTrigger = page.locator("button:has(span:has-text('Operación Regular'))");
    await expect(scenarioTrigger).toBeVisible();

    await scenarioTrigger.click();
    await expect(page.locator("text=Campaña (+50% Demanda)")).toBeVisible();
    await expect(page.locator("text=Crisis (-50% Stock)")).toBeVisible();

    await page.locator("text=Campaña (+50% Demanda)").click();
    await expect(scenarioTrigger).toContainText("Campaña");
  });

  test("predictive query form is present", async ({ page }) => {
    await expect(page.locator("text=Consulta Predictiva Puntual")).toBeVisible();
    await expect(page.locator("text=Selecciona un Repuesto (SKU)")).toBeVisible();
    await expect(page.locator("text=Mes Objetivo")).toBeVisible();
    await expect(page.locator("text=Km vehículo")).toBeVisible();
    await expect(page.locator("button:has-text('Proyectar Demanda')")).toBeVisible();
  });

  test("purchase order generator section is present", async ({ page }) => {
    await expect(page.locator("text=Generador de Órdenes de Compra Inteligentes")).toBeVisible();

    const generateBtn = page.locator("button:has-text('Generar OC Automática')");
    await expect(generateBtn).toBeVisible();
  });
});
