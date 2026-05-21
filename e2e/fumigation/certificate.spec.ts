import { test, expect } from "@playwright/test";
import { seedPackWithFumigation } from "../helpers/fumigation";

const PACK_ID = 99001;

test.describe("Fumigation Certificate — generate → edit → issue → print", () => {
  test.beforeEach(async ({ page }) => {
    await seedPackWithFumigation(page, PACK_ID);
  });

  test("certificate editor loads and shows pre-filled fumigator name", async ({ page }) => {
    await page.goto(`/fumigation/certificates/${PACK_ID}`);
    await expect(page).not.toHaveURL(/error/);
    // Editor toolbar should appear
    await expect(page.getByText(/Certificate editor/i)).toBeVisible({ timeout: 10_000 });
    // Fumigator name pre-filled from pack
    const fumigatorInput = page
      .getByLabel(/Fumigator name/i)
      .first();
    await expect(fumigatorInput).toHaveValue("Jane Fumigator");
  });

  test("Refresh from pack button resets editor state from pack data", async ({ page }) => {
    await page.goto(`/fumigation/certificates/${PACK_ID}`);
    await expect(page.getByText(/Certificate editor/i)).toBeVisible({ timeout: 10_000 });

    // Change the fumigator name
    const fumigatorInput = page.getByLabel(/Fumigator name/i).first();
    await fumigatorInput.fill("Wrong Name");
    await expect(fumigatorInput).toHaveValue("Wrong Name");

    // Click Refresh from pack
    await page.getByRole("button", { name: /Refresh from pack/i }).click();

    // Value should be reset
    await expect(fumigatorInput).toHaveValue("Jane Fumigator");
  });

  test("MBR-specific fields are visible for MBR fumigant", async ({ page }) => {
    await page.goto(`/fumigation/certificates/${PACK_ID}`);
    await expect(page.getByText(/Certificate editor/i)).toBeVisible({ timeout: 10_000 });
    // MBR fields
    await expect(page.getByLabel(/Chloropicrin used/i)).toBeVisible();
    await expect(page.getByLabel(/Heaters used/i)).toBeVisible();
    await expect(page.getByLabel(/Amount CH3Br applied/i)).toBeVisible();
  });

  test("Save & Print navigates to the print page", async ({ page }) => {
    await page.goto(`/fumigation/certificates/${PACK_ID}`);
    await expect(page.getByText(/Certificate editor/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Save & Print/i }).click();
    await expect(page).toHaveURL(new RegExp(`/fumigation/certificates/${PACK_ID}/print`));
  });

  test("print page renders the certificate document", async ({ page }) => {
    await page.goto(`/fumigation/certificates/${PACK_ID}/print`);
    // Title or section heading should be present
    await expect(page.getByText(/Treatment Certificate/i).first()).toBeVisible({ timeout: 12_000 });
    // Fumigator declaration block
    await expect(page.getByText(/Declaration/i).first()).toBeVisible();
  });

  test("print page renders container number from pack", async ({ page }) => {
    await page.goto(`/fumigation/certificates/${PACK_ID}/print`);
    await expect(page.getByText("MSCU1234567").first()).toBeVisible({ timeout: 12_000 });
  });

  test("print page includes prescribed vs applied schedule tables", async ({ page }) => {
    await page.goto(`/fumigation/certificates/${PACK_ID}/print`);
    await expect(page.getByText(/prescribed/i).first()).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText(/applied/i).first()).toBeVisible();
  });
});
