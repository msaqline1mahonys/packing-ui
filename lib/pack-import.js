/** True when the pack is an import job (packing schedule / packers schedule). */
export function isImportPack(pack) {
  return String(pack?.importExport ?? pack?.import_export ?? "").toLowerCase() === "import";
}

/** UI label for the container load confirmation field (out_loaded in API). */
export function containerLoadLabel(isImport) {
  return isImport ? "In-loaded" : "Out-loaded";
}
