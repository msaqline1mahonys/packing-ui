const SNAPSHOT_KEY = "packing-ui-pems-snapshots-v1";

function readSnapshotMap() {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SNAPSHOT_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSnapshotMap(map) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(map));
}

/** Persist printable staging HTML for a submitted PEM batch. */
export function savePemsSubmissionSnapshot(batchId, snapshotHtml) {
  if (!batchId || !snapshotHtml) return;
  const map = readSnapshotMap();
  map[String(batchId)] = {
    batchId: String(batchId),
    snapshotHtml: String(snapshotHtml),
    savedAt: new Date().toISOString(),
  };
  writeSnapshotMap(map);
}

export function loadPemsSubmissionSnapshot(batchId) {
  if (!batchId) return "";
  return readSnapshotMap()[String(batchId)]?.snapshotHtml || "";
}

export function removePemsSubmissionSnapshot(batchId) {
  if (!batchId) return;
  const map = readSnapshotMap();
  delete map[String(batchId)];
  writeSnapshotMap(map);
}
