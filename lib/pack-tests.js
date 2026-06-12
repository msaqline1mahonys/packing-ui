"use client";

/**
 * Shared helpers for pack/container quality tests derived from commodity thresholds.
 */

export function normalizeTestThresholds(commodity) {
  const raw = commodity?.test_thresholds ?? commodity?.testThresholds ?? [];
  return Array.isArray(raw) ? raw : [];
}

export function getApplicablePackTests(commodity, testsCatalog = []) {
  const thresholds = normalizeTestThresholds(commodity);
  if (!thresholds.length || !Array.isArray(testsCatalog)) return [];

  const byName = new Map(
    testsCatalog.map((t) => [String(t.test_name ?? t.testName ?? "").trim(), t])
  );

  return thresholds
    .map((threshold) => {
      const testName = String(threshold.test ?? threshold.testName ?? "").trim();
      if (!testName) return null;
      const def = byName.get(testName);
      if (!def) return null;
      const status = String(def.status ?? "Active");
      if (status.toLowerCase() !== "active") return null;
      const appliesTo = def.applies_to ?? def.appliesTo ?? [];
      if (!appliesTo.includes("Outgoing Containers")) return null;
      return {
        testId: def.id ?? null,
        testName,
        testType: def.type ?? "Percentage",
        unit: def.unit ?? "",
        thresholdMin: threshold.min ?? threshold.thresholdMin ?? null,
        thresholdMax: threshold.max ?? threshold.thresholdMax ?? null,
        members: def.members ?? [],
      };
    })
    .filter(Boolean);
}

export function getGroupMemberTests(groupDef, testsCatalog = []) {
  const ids = groupDef?.members ?? [];
  return ids
    .map((id) => testsCatalog.find((t) => String(t.id) === String(id)))
    .filter(Boolean);
}

export function evaluateIndividualTest(rawValue, min, max) {
  if (rawValue === "" || rawValue == null) return "pending";
  const value = Number(rawValue);
  if (Number.isNaN(value)) return "pending";
  const minN = min !== "" && min != null ? Number(min) : null;
  const maxN = max !== "" && max != null ? Number(max) : null;
  if (minN != null && !Number.isNaN(minN) && value < minN) return "fail";
  if (maxN != null && !Number.isNaN(maxN) && value > maxN) return "fail";
  return "pass";
}

export function sumFindings(findings) {
  return (findings ?? []).reduce((sum, row) => sum + (Number(row?.count) || 0), 0);
}

export function evaluateGroupTest(findings, max) {
  if (!Array.isArray(findings) || findings.length === 0) return "pending";
  const total = sumFindings(findings);
  const maxN = max !== "" && max != null ? Number(max) : null;
  if (maxN != null && !Number.isNaN(maxN) && total > maxN) return "fail";
  return "pass";
}

export function deriveTestStatus(entry) {
  if (entry?.testType === "Group" || entry?.test_type === "Group") {
    return evaluateGroupTest(entry.findings, entry.thresholdMax ?? entry.threshold_max);
  }
  return evaluateIndividualTest(
    entry?.value,
    entry?.thresholdMin ?? entry.threshold_min,
    entry?.thresholdMax ?? entry.threshold_max
  );
}

export function normalizePackTestRow(raw) {
  if (!raw) return null;
  return {
    id: raw.id ?? null,
    packId: raw.pack_id ?? raw.packId ?? null,
    testId: raw.test_id ?? raw.testId ?? null,
    testName: raw.test_name ?? raw.testName ?? "",
    testType: raw.test_type ?? raw.testType ?? "Percentage",
    unit: raw.unit ?? "",
    thresholdMin: raw.threshold_min ?? raw.thresholdMin ?? null,
    thresholdMax: raw.threshold_max ?? raw.thresholdMax ?? null,
    value: raw.value ?? "",
    findings: Array.isArray(raw.findings) ? raw.findings : [],
    status: raw.status ?? "pending",
    notes: raw.notes ?? "",
    pack: raw.pack
      ? {
          id: raw.pack.id,
          jobReference: raw.pack.job_reference ?? raw.pack.jobReference ?? "",
          status: raw.pack.status ?? "",
          customer: raw.pack.customer?.name ?? "",
          commodity: raw.pack.commodity?.description ?? "",
        }
      : null,
  };
}

export function packTestToPayload(entry) {
  return {
    test_id: entry.testId ?? null,
    test_name: entry.testName,
    test_type: entry.testType ?? "Percentage",
    unit: entry.unit ?? "",
    threshold_min: entry.thresholdMin ?? null,
    threshold_max: entry.thresholdMax ?? null,
    value: entry.value ?? "",
    findings: entry.findings ?? null,
    status: entry.status ?? deriveTestStatus(entry),
    notes: entry.notes ?? "",
  };
}

export function buildDefaultPackTests(applicableTests) {
  return applicableTests.map((row) => {
    if (row.testType === "Group") {
      return {
        testId: row.testId,
        testName: row.testName,
        testType: row.testType,
        unit: row.unit,
        thresholdMin: row.thresholdMin,
        thresholdMax: row.thresholdMax,
        value: "",
        findings: [],
        status: "pending",
        notes: "",
      };
    }
    return {
      testId: row.testId,
      testName: row.testName,
      testType: row.testType,
      unit: row.unit,
      thresholdMin: row.thresholdMin,
      thresholdMax: row.thresholdMax,
      value: "",
      findings: null,
      status: "pending",
      notes: "",
    };
  });
}

export function mergePackTests(existingRows, applicableTests) {
  const existing = Array.isArray(existingRows) ? existingRows : [];
  if (!applicableTests.length) return existing;
  const byName = new Map(existing.map((row) => [row.testName, row]));
  return applicableTests.map((def) => {
    const prev = byName.get(def.testName);
    if (prev) {
      return {
        ...prev,
        testId: prev.testId ?? def.testId,
        testType: prev.testType ?? def.testType,
        unit: prev.unit ?? def.unit,
        thresholdMin: prev.thresholdMin ?? def.thresholdMin,
        thresholdMax: prev.thresholdMax ?? def.thresholdMax,
      };
    }
    return buildDefaultPackTests([def])[0];
  });
}
