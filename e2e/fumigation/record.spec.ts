import { test, expect } from "@playwright/test";
import { seedPackWithFumigation } from "../helpers/fumigation";

const PACK_ID = 99002;

test.describe("Fumigation Record — generate → edit → issue → print", () => {
  test.beforeEach(async ({ page }) => {
    await seedPackWithFumigation(page, PACK_ID);
  });

  test("record editor loads with correct section headings", async ({ page }) => {
    await page.goto(`/fumigation/records/${PACK_ID}`);
    await expect(page.getByText(/Record editor/i)).toBeVisible({ timeout: 10_000 });
    // Gov template sections A–E
    await expect(page.getByText(/Section A/i).first()).toBeVisible();
    await expect(page.getByText(/Section B/i).first()).toBeVisible();
    await expect(page.getByText(/Section C/i).first()).toBeVisible();
    await expect(page.getByText(/Section D/i).first()).toBeVisible();
    await expect(page.getByText(/Section E/i).first()).toBeVisible();
  });

  test("fumigator name pre-filled from pack", async ({ page }) => {
    await page.goto(`/fumigation/records/${PACK_ID}`);
    await expect(page.getByText(/Record editor/i)).toBeVisible({ timeout: 10_000 });
    const fullNameInput = page.getByLabel(/Full name/i).first();
    await expect(fullNameInput).toHaveValue("Jane Fumigator");
  });

  test("concentration readings grid has one row per pack container", async ({ page }) => {
    await page.goto(`/fumigation/records/${PACK_ID}`);
    await expect(page.getByText(/Section D/i).first()).toBeVisible({ timeout: 10_000 });
    const rows = page.locator("table").filter({ hasText: /Container/ }).locator("tbody tr");
    await expect(rows).toHaveCount(1);
  });

  test("can add a concentration reading row", async ({ page }) => {
    await page.goto(`/fumigation/records/${PACK_ID}`);
    await expect(page.getByText(/Section D/i).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Add container row/i }).click();
    const rows = page.locator("table").filter({ hasText: /Container/ }).locator("tbody tr");
    await expect(rows).toHaveCount(2);
  });

  test("can add a top-up row", async ({ page }) => {
    await page.goto(`/fumigation/records/${PACK_ID}`);
    await expect(page.getByText(/Section D/i).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Add top-up row/i }).click();
    // Top-up row inputs should appear
    await expect(page.getByPlaceholder(/Amount \(g\/m3\)/i)).toBeVisible();
  });

  test("Save & Print navigates to record print page", async ({ page }) => {
    await page.goto(`/fumigation/records/${PACK_ID}`);
    await expect(page.getByText(/Record editor/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Save & Print/i }).click();
    await expect(page).toHaveURL(new RegExp(`/fumigation/records/${PACK_ID}/print`));
  });

  test("record print page renders all gov-template sections", async ({ page }) => {
    await page.goto(`/fumigation/records/${PACK_ID}/print`);
    await expect(page.getByText(/Record of Fumigation/i).first()).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText(/Section A/i).first()).toBeVisible();
    await expect(page.getByText(/Section B/i).first()).toBeVisible();
    await expect(page.getByText(/Section C/i).first()).toBeVisible();
    await expect(page.getByText(/Section D/i).first()).toBeVisible();
    await expect(page.getByText(/Section E/i).first()).toBeVisible();
  });

  test("record print page includes concentration readings table", async ({ page }) => {
    await page.goto(`/fumigation/records/${PACK_ID}/print`);
    await expect(page.getByText(/Section D/i).first()).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText(/Container number/i).first()).toBeVisible();
    await expect(page.getByText(/TVL reading/i).first()).toBeVisible();
  });

  test("Refresh from pack button resets Section A fumigator name", async ({ page }) => {
    await page.goto(`/fumigation/records/${PACK_ID}`);
    await expect(page.getByText(/Record editor/i)).toBeVisible({ timeout: 10_000 });
    const fullNameInput = page.getByLabel(/Full name/i).first();
    await fullNameInput.fill("Incorrect Name");
    await page.getByRole("button", { name: /Refresh from pack/i }).click();
    await expect(fullNameInput).toHaveValue("Jane Fumigator");
  });
});
