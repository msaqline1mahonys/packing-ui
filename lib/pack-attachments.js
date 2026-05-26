export function normalizePackAttachmentFiles(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    if (typeof item === "string") {
      const isPath = item.startsWith("/");
      return {
        id: `legacy-${index}-${item}`,
        name: item.includes("/") ? item.split("/").pop() || item : item,
        size: null,
        type: isPath && item.toLowerCase().endsWith(".pdf") ? "application/pdf" : "",
        file: null,
        url: isPath ? item : null,
      };
    }
    return {
      id: item?.id ?? `file-${index}-${item?.name ?? "unknown"}`,
      name: item?.name ?? "file",
      size: Number.isFinite(item?.size) ? item.size : null,
      type: item?.type ?? "",
      file: item?.file instanceof File ? item.file : null,
      url: typeof item?.url === "string" ? item.url : null,
    };
  });
}

export function collectPackAttachments(packRow) {
  if (!packRow) return [];
  const rows = [];
  const add = (files, group) => {
    normalizePackAttachmentFiles(files).forEach((item) => {
      rows.push({ ...item, group, listKey: `${group}-${item.id}` });
    });
  };
  add(packRow.importPermitFiles, "Permit");
  add(packRow.rfpFiles, "RFP");
  add(packRow.packingInstructionFiles, "Instruction");
  add(packRow.additionalDeclarationFiles, "Declaration");
  return rows;
}

export function attachmentCanQuickLook(item) {
  if (item?.file instanceof File) return true;
  const u = typeof item?.url === "string" ? item.url.trim() : "";
  if (!u) return false;
  if (/^https?:\/\//i.test(u)) return true;
  if (u.startsWith("/")) return true;
  return false;
}

/** Absolute URL for iframe / new tab (client). */
export function resolvePackAttachmentViewUrl(item) {
  const u = typeof item?.url === "string" ? item.url.trim() : "";
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (typeof window !== "undefined" && u.startsWith("/")) {
    try {
      return new URL(u, window.location.origin).href;
    } catch {
      return u;
    }
  }
  return null;
}

export function previewKindForFileItem(item) {
  const name = String(item?.name || "").toLowerCase();
  const url = String(item?.url || "").toLowerCase();
  const mime = String(item?.type || (item?.file instanceof File ? item.file.type : "") || "");
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name) || /\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(url))
    return "image";
  if (mime === "application/pdf" || name.endsWith(".pdf") || url.includes(".pdf")) return "pdf";
  return "generic";
}

export const ATTACHMENT_GROUP_STYLES = {
  Permit: { pill: "bg-emerald-500/10 text-emerald-800 ring-emerald-500/20" },
  RFP: { pill: "bg-sky-500/10 text-sky-900 ring-sky-500/20" },
  Instruction: { pill: "bg-amber-500/10 text-amber-900 ring-amber-500/25" },
  Declaration: { pill: "bg-violet-500/10 text-violet-900 ring-violet-500/20" },
};

export function attachmentGroupStyles(group) {
  return ATTACHMENT_GROUP_STYLES[group] || ATTACHMENT_GROUP_STYLES.Instruction;
}

export function formatAttachmentBytes(size) {
  if (!Number.isFinite(size)) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
