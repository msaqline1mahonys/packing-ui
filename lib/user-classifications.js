export const USER_CLASSIFICATIONS = {
  AUTHORISED_OFFICER: "AUTHORISED_OFFICER",
  FUMIGATOR: "FUMIGATOR",
  PACKER: "PACKER",
  WEIGHBRIDGE: "WEIGHBRIDGE",
  SITE_ADMIN: "SITE_ADMIN",
  ORG_ADMIN: "ORG_ADMIN",
};

export const CLASSIFICATION_LABELS = {
  [USER_CLASSIFICATIONS.AUTHORISED_OFFICER]: "Authorised Officer",
  [USER_CLASSIFICATIONS.FUMIGATOR]: "Fumigator",
  [USER_CLASSIFICATIONS.PACKER]: "Packer",
  [USER_CLASSIFICATIONS.WEIGHBRIDGE]: "Weighbridge",
  [USER_CLASSIFICATIONS.SITE_ADMIN]: "Site Admin",
  [USER_CLASSIFICATIONS.ORG_ADMIN]: "Org Admin",
};

export const ALL_CLASSIFICATIONS = Object.values(USER_CLASSIFICATIONS);

export function normalizeClassifications(value) {
  if (!Array.isArray(value)) return [];
  const set = new Set();
  for (const item of value) {
    const key = String(item ?? "").trim().toUpperCase();
    if (ALL_CLASSIFICATIONS.includes(key)) set.add(key);
  }
  return ALL_CLASSIFICATIONS.filter((c) => set.has(c));
}

export function classificationsFromLegacyUser(user) {
  const list = normalizeClassifications(user?.userClassifications);
  if (list.length) return list;
  const derived = [];
  if (user?.aoActive) derived.push(USER_CLASSIFICATIONS.AUTHORISED_OFFICER);
  if (user?.isFumigator) derived.push(USER_CLASSIFICATIONS.FUMIGATOR);
  if (user?.packersAccountAccess) derived.push(USER_CLASSIFICATIONS.PACKER);
  if (user?.weighbridgeAccess) derived.push(USER_CLASSIFICATIONS.WEIGHBRIDGE);
  return derived;
}

export function legacyFlagsFromClassifications(classifications) {
  const set = new Set(normalizeClassifications(classifications));
  return {
    aoActive: set.has(USER_CLASSIFICATIONS.AUTHORISED_OFFICER),
    isFumigator: set.has(USER_CLASSIFICATIONS.FUMIGATOR),
    packersAccountAccess: set.has(USER_CLASSIFICATIONS.PACKER),
    weighbridgeAccess: set.has(USER_CLASSIFICATIONS.WEIGHBRIDGE),
  };
}

export function hasClassification(user, classification) {
  return classificationsFromLegacyUser(user).includes(classification);
}

export function isAuthorisedOfficer(user) {
  return hasClassification(user, USER_CLASSIFICATIONS.AUTHORISED_OFFICER);
}

export function normalizeUserWithClassifications(user) {
  if (!user || typeof user !== "object") return user;
  const userClassifications = classificationsFromLegacyUser(user);
  const legacy = legacyFlagsFromClassifications(userClassifications);
  return {
    ...user,
    userClassifications,
    aoActive: legacy.aoActive,
    isFumigator: legacy.isFumigator,
    packersAccountAccess: legacy.packersAccountAccess,
    weighbridgeAccess: legacy.weighbridgeAccess,
  };
}

export function filterAuthorisedOfficers(users) {
  return (users || []).filter((u) => u && u.active !== false && isAuthorisedOfficer(u));
}
