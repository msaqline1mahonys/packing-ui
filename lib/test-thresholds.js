/**
 * Shared helpers for commodity test thresholds (tickets, containers).
 * Flat test values: { [testName]: string|number }.
 */

export function normalizeTestThreshold(th) {
  return {
    name: th?.test ?? th?.testName ?? "",
    min: th?.min,
    max: th?.max,
    parentGroupId: th?.parentGroupId ?? th?.parent_group_id ?? null,
    isGroupRoot: Boolean(th?.isGroupRoot ?? th?.is_group_root ?? false),
    testId: th?.testId ?? th?.test_id ?? null,
  };
}

export function getCommodityThresholds(comm) {
  const raw = comm?.testThresholds ?? comm?.test_thresholds ?? [];
  return (Array.isArray(raw) ? raw : []).map(normalizeTestThreshold).filter((t) => t.name);
}

export function buildTestsByName(tests) {
  const map = new Map();
  (Array.isArray(tests) ? tests : []).forEach((t) => {
    const name = t?.name ?? t?.testName ?? t?.test_name;
    if (name) map.set(name, t);
  });
  return map;
}

export function testAppliesToSurface(name, testsByName, surface) {
  const meta = testsByName.get(name);
  if (!meta) return true;
  const appliesTo = Array.isArray(meta.appliesTo)
    ? meta.appliesTo
    : Array.isArray(meta.applies_to)
      ? meta.applies_to
      : [];
  return appliesTo.includes(surface);
}

export function sumGroupMembers(members, testValues) {
  let total = 0;
  let hasValue = false;
  for (const m of members) {
    const raw = testValues?.[m.name];
    if (raw === "" || raw == null) continue;
    const n = Number(raw);
    if (Number.isNaN(n)) continue;
    total += n;
    hasValue = true;
  }
  return { total, hasValue };
}

function commodityTypeIdOf(c) {
  return c?.commodityTypeId ?? c?.commodity_type_id ?? null;
}

function commodityStatusOf(c) {
  return String(c?.status ?? "active").toLowerCase();
}

function filterCommodities({ commodities, commodityTypeId, allowedCommodityIds }) {
  if (!commodityTypeId) return [];
  return (Array.isArray(commodities) ? commodities : []).filter((c) => {
    if (String(commodityTypeIdOf(c)) !== String(commodityTypeId)) return false;
    if (commodityStatusOf(c) === "inactive") return false;
    if (allowedCommodityIds && allowedCommodityIds.size > 0 && !allowedCommodityIds.has(c.id)) {
      return false;
    }
    return true;
  });
}

export function commodityTypeRequiresTestConfirmation({
  commodities = [],
  commodityTypeId,
  allowedCommodityIds = null,
  testsCatalog = [],
  surface = "",
}) {
  if (!commodityTypeId) return false;
  const { standaloneTests, groups } = buildTestLayout({
    commodities,
    commodityTypeId,
    allowedCommodityIds,
    testsCatalog,
    surface,
  });
  return standaloneTests.length > 0 || groups.length > 0;
}

export function buildTestLayout({
  commodities = [],
  commodityTypeId,
  allowedCommodityIds = null,
  testsCatalog = [],
  surface = "",
}) {
  const sameCommodities = filterCommodities({ commodities, commodityTypeId, allowedCommodityIds });
  const testsByName = buildTestsByName(testsCatalog);
  const applies = (name) => !surface || testAppliesToSurface(name, testsByName, surface);

  const allThresholds = [];
  sameCommodities.forEach((comm) => {
    getCommodityThresholds(comm).forEach((th) => allThresholds.push(th));
  });

  const groupedNames = new Set();
  allThresholds.filter((t) => t.parentGroupId).forEach((t) => groupedNames.add(t.name));

  const standaloneTests = [];
  const seenStandalone = new Set();
  allThresholds
    .filter((t) => !t.parentGroupId && !groupedNames.has(t.name) && applies(t.name))
    .forEach((t) => {
      if (seenStandalone.has(t.name)) return;
      seenStandalone.add(t.name);
      standaloneTests.push(t);
    });

  const groupsMap = new Map();
  allThresholds
    .filter((t) => t.parentGroupId)
    .forEach((t) => {
      if (!groupsMap.has(t.parentGroupId)) {
        groupsMap.set(t.parentGroupId, {
          groupId: t.parentGroupId,
          name: "",
          root: null,
          members: [],
          seen: new Set(),
        });
      }
      const g = groupsMap.get(t.parentGroupId);
      if (t.isGroupRoot) {
        g.root = t;
        g.name = t.name || g.name;
      } else if (!g.seen.has(t.name)) {
        g.seen.add(t.name);
        g.members.push(t);
      }
    });

  const groups = [];
  groupsMap.forEach((g) => {
    const groupName = g.name || g.root?.name || "";
    if (!applies(groupName)) return;
    if (g.members.length === 0 && g.root) {
      if (!seenStandalone.has(g.root.name)) {
        seenStandalone.add(g.root.name);
        standaloneTests.push(g.root);
      }
    } else {
      groups.push(g);
    }
  });

  return { sameCommodities, testsByName, standaloneTests, groups };
}

export function unitForThreshold(threshold, testsByName, testsCatalog = []) {
  return (
    testsByName.get(threshold.name)?.unit ??
    (Array.isArray(testsCatalog) ? testsCatalog.find((m) => m.id === threshold.testId)?.unit : "") ??
    ""
  );
}

export function isStandaloneInRange(name, value, sameCommodities) {
  let inRange = false;
  sameCommodities.forEach((comm) => {
    getCommodityThresholds(comm)
      .filter((x) => x.name === name && !(x.parentGroupId && !x.isGroupRoot))
      .forEach((th) => {
        const min = Number(th.min);
        const max = Number(th.max);
        if (value >= min && value <= max) inRange = true;
      });
  });
  return inRange;
}

export function isGroupInRange(groupId, value, sameCommodities) {
  let inRange = false;
  sameCommodities.forEach((comm) => {
    const th = getCommodityThresholds(comm).find((x) => x.parentGroupId === groupId && x.isGroupRoot);
    if (th) {
      const min = Number(th.min);
      const max = Number(th.max);
      if (value >= min && value <= max) inRange = true;
    }
  });
  return inRange;
}

/**
 * Build print/display rows from flat test values and a single commodity's thresholds.
 */
export function buildTestPrintRows(testValues, commodity, testsCatalog = []) {
  const tests = testValues && typeof testValues === "object" ? testValues : {};
  const thresholds = getCommodityThresholds(commodity);
  const testsByName = buildTestsByName(testsCatalog);

  const hasValue = (name) => tests[name] !== "" && tests[name] != null;
  const unitFor = (t) => unitForThreshold(t, testsByName, testsCatalog);

  if (thresholds.length === 0) {
    return Object.entries(tests)
      .filter(([, val]) => val !== "" && val != null)
      .map(([name, val]) => {
        const meta = testsByName.get(name);
        return { name, value: val, unit: meta?.unit ?? "" };
      });
  }

  const rows = [];
  const groupedNames = new Set();
  thresholds.filter((t) => t.parentGroupId).forEach((t) => groupedNames.add(t.name));

  thresholds
    .filter((t) => !t.parentGroupId && !groupedNames.has(t.name))
    .forEach((t) => {
      if (!hasValue(t.name)) return;
      rows.push({ name: t.name, value: tests[t.name], unit: unitFor(t) });
    });

  const groups = new Map();
  thresholds
    .filter((t) => t.parentGroupId)
    .forEach((t) => {
      if (!groups.has(t.parentGroupId)) groups.set(t.parentGroupId, { root: null, members: [] });
      const g = groups.get(t.parentGroupId);
      if (t.isGroupRoot) g.root = t;
      else g.members.push(t);
    });

  groups.forEach(({ root, members }) => {
    if (members.length === 0) {
      if (root && hasValue(root.name)) rows.push({ name: root.name, value: tests[root.name], unit: unitFor(root) });
      return;
    }
    let total = 0;
    let anyEntered = false;
    members.forEach((m) => {
      if (!hasValue(m.name)) return;
      const n = Number(tests[m.name]);
      if (Number.isNaN(n)) return;
      total += n;
      anyEntered = true;
      rows.push({ name: m.name, value: tests[m.name], unit: unitFor(m), groupName: root?.name || "" });
    });
    if (root && anyEntered) {
      rows.push({ name: root.name, value: total, unit: unitFor(root), isGroupTotal: true });
    }
  });

  return rows;
}
