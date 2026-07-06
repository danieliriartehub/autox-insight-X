import { test, expect } from "@playwright/test";

test.describe("Login Page — /", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders branding and form", async ({ page }) => {
    await expect(page.locator("text=bpA Motors")).toBeVisible();
    await expect(page.locator("text=SCM INTELLIGENCE")).toBeVisible();
    await expect(page.locator("h2").first()).toContainText("Iniciar sesión");

    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.locator("#login-submit-btn")).toBeVisible();
  });

  test("submit button is disabled when form is empty", async ({ page }) => {
    const submitBtn = page.locator("#login-submit-btn");
    await expect(submitBtn).toBeDisabled();
  });

  test("shows validation error for invalid email", async ({ page }) => {
    await page.locator("#login-email").fill("not-an-email");
    await page.locator("#login-password").fill("123456");
    await expect(page.locator("text=Introduce un correo electrónico válido.")).toBeVisible();
  });

  test("toggle password visibility", async ({ page }) => {
    const passwordInput = page.locator("#login-password");
    const toggleBtn = page.locator("#toggle-password-visibility");

    await expect(passwordInput).toHaveAttribute("type", "password");
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("forgot password link is present", async ({ page }) => {
    const forgotLink = page.locator("#forgot-password-link");
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveText("¿Olvidaste tu contraseña?");
  });
});
