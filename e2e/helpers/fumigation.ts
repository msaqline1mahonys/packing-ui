import { Page, expect } from "@playwright/test";

/** The demo pack ID seeded in demo-in-ticket-data.js */
export const DEMO_PACK_ID = 10421;

/**
 * Navigate to the pack form for a given packId and open the Fumigation tab.
 * Because the pack store is localStorage-based we seed via localStorage directly.
 */
export async function openFumigationTab(page: Page, packId: number): Promise<void> {
  await page.goto(`/packing-schedule/new-pack-form?edit=${packId}`);
  // Wait for the form to hydrate
  await page.waitForSelector("[data-testid='pack-form']", { timeout: 10_000 }).catch(() => null);
  // Click the fumigation tab (text-based; adjust if data-testid added later)
  const fumigationTab = page.getByRole("button", { name: /fumigation/i }).first();
  if (await fumigationTab.isVisible()) await fumigationTab.click();
}

/**
 * Seed a minimal pack with fumigation data into localStorage so resolvers can
 * pre-fill the editors in tests.
 */
export async function seedPackWithFumigation(page: Page, packId: number): Promise<void> {
  await page.goto("/");
  await page.evaluate((id) => {
    const KEY = "packing-ui-pack-schedule-rows";
    const existingRaw = localStorage.getItem(KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    // Remove any stale entry for this pack
    const filtered = existing.filter((r: { id: number }) => r.id !== id);
    filtered.push({
      id,
      jobReference: `TEST-${id}`,
      fumigationRequired: true,
      fumigantId: 2,   // MBR
      methodologyId: 1,
      certificateTemplateId: 1,
      recordTemplateId: 1,
      fumigatorAccreditationNumber: "ACC-9999",
      treatmentProviderId: "TP-001",
      portOfLoading: "Port of Melbourne",
      commodityCountryOfOrigin: "Australia",
      customer: "Demo Customer",
      commodity: "Wheat",
      importExport: "Export",
      fumigationDetail: {
        fumigatorName: "Jane Fumigator",
        fumigationType: "ambient",
        targetOfFumigation: ["commodity", "container"],
        enclosureType: "unsheeted-container",
        volumeM3: "67.3",
        actualTemperature: "22",
        prescribedDoseRate: "32",
        prescribedExposure: "24",
        dosageValue: "32",
        calculatedDosageValue: "2153",
        actualDosageAppliedValue: "2153",
        chloropicrinUsed: false,
        heatersUsed: false,
        exposureTimeValue: "24",
        exposureTimeUnit: "hours",
        fumigationStartAt: "2026-05-15T08:00",
        dosingFinishAt: "2026-05-15T08:30",
        fumigationEndAt: "2026-05-16T08:00",
        ventilationStartAt: "2026-05-16T09:00",
        finalTlvPpm1: "0.3",
        finalTlvPpm2: "0.3",
        finalTlvPpm3: "0.2",
        fumigationResult: "pass",
      },
      containers: [
        { id: "c1", order: 1, containerNumber: "MSCU1234567", sealNumber: "SL99001" },
      ],
    });
    localStorage.setItem(KEY, JSON.stringify(filtered));
  }, packId);
}
