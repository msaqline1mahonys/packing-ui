import { getContainerInspectionRemark } from "@/lib/pems-container-fields";
import { loadPemsSubmissionSnapshot, savePemsSubmissionSnapshot } from "@/lib/pems-submission-store";

export const ECR_RECORD_TYPE = "Empty Container Inspection Record";
export const GPPIR_RECORD_TYPE = "Grain and Plant Product Inspection Record";
const GPPIR_WEIGHT_UNIT = "M/TONS";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeValue(value) {
  if (value == null || String(value).trim() === "") return "—";
  return String(value);
}

function formatDateTimeValue(value) {
  if (value == null || String(value).trim() === "") return "—";
  const str = String(value).trim();
  if (!str.includes("T")) return str;
  const [datePart, timePart] = str.split("T");
  const hhmm = (timePart || "").slice(0, 5);
  return hhmm ? `${datePart} ${hhmm}` : datePart;
}

function formatDateDisplay(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

function addDaysToDate(value, days) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString();
}

function toRoundedNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 10000) / 10000;
}

function containerNo(row) {
  return row?.containerNo || row?.containerNumber || "";
}

function sealNo(row) {
  return row?.sealNo || row?.sealNumber || "";
}

function fieldBox(label, value) {
  return `<div class="field"><div class="field-label">${escapeHtml(label)}</div><div class="field-value">${escapeHtml(safeValue(value))}</div></div>`;
}

function buildGppirTableRows(submission) {
  const rows = Array.isArray(submission?.containers) ? submission.containers : [];
  return rows
    .map(
      (row) => {
        const containerWeight = toRoundedNumber(row?.nettWeight);
        return `<tr>
        <td class="col-compact">1</td>
        <td>${escapeHtml(containerNo(row))}</td>
        <td>${escapeHtml(row?.grainLocation || row?.stockBayId || "")}</td>
        <td>${escapeHtml(submission?.commodity || "")}</td>
        <td class="col-compact">1</td>
        <td>CONTAINER</td>
        <td>${escapeHtml(containerWeight.toFixed(2))}</td>
        <td>${escapeHtml(GPPIR_WEIGHT_UNIT)}</td>
        <td>${escapeHtml(containerWeight.toFixed(4))}</td>
        <td>${escapeHtml(GPPIR_WEIGHT_UNIT)}</td>
        <td>N/A</td>
        <td>${escapeHtml(row?.grainInspection === "Passed" ? "Passed" : row?.grainInspection === "Failed" ? "Failed" : "Pending")}</td>
        <td>${escapeHtml(submission?.aoSignoff || "")}</td>
        <td>${escapeHtml(getContainerInspectionRemark(row) || "N/A")}</td>
      </tr>`;
      }
    )
    .join("");
}

function buildEcrTableRows(submission, expiryDate) {
  const rows = Array.isArray(submission?.containers) ? submission.containers : [];
  const packRfp = String(submission?.rfp || "").trim();
  return rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(containerNo(row))}</td>
        <td>Consumable</td>
        <td>${escapeHtml(packRfp || row?.releaseNumber || "")}</td>
        <td>${escapeHtml(row?.emptyInspection === "Passed" ? "Pass" : row?.emptyInspection === "Failed" ? "Fail" : "Pending")}</td>
        <td>${escapeHtml(sealNo(row))}</td>
        <td>${escapeHtml(expiryDate)}</td>
        <td>${escapeHtml(submission?.aoSignoff || "")}</td>
        <td>${escapeHtml(getContainerInspectionRemark(row) || "N/A")}</td>
      </tr>`
    )
    .join("");
}

/**
 * Printable HTML document mirroring the full PEMs staging outcome section.
 */
export function buildPemsStagingSnapshotHtml(submission) {
  const rows = Array.isArray(submission?.containers) ? submission.containers : [];
  const isGppir = submission?.recordType === GPPIR_RECORD_TYPE;
  const inspectionStart = formatDateTimeValue(submission?.inspectionStart);
  const inspectionEnd = formatDateTimeValue(submission?.inspectionEnd);
  const submittedAt = formatDateTimeValue(submission?.submittedAt);
  const expiryDate = formatDateDisplay(
    submission?.expiryDate ||
      addDaysToDate(submission?.inspectionEnd || submission?.inspectionStart, isGppir ? 28 : 90)
  );
  const totalWeight = toRoundedNumber(rows.reduce((sum, row) => sum + (Number(row?.nettWeight) || 0), 0));
  const passedWeight = toRoundedNumber(
    rows.reduce((sum, row) => {
      const isPassed = isGppir ? row?.grainInspection === "Passed" : row?.emptyInspection === "Passed";
      return isPassed ? sum + (Number(row?.nettWeight) || 0) : sum;
    }, 0)
  );
  const failedWeight = toRoundedNumber(
    rows.reduce((sum, row) => {
      const isFailed = isGppir ? row?.grainInspection === "Failed" : row?.emptyInspection === "Failed";
      return isFailed ? sum + (Number(row?.nettWeight) || 0) : sum;
    }, 0)
  );
  const flowResult =
    rows.length && rows.every((row) => row?.grainInspection === "Passed") ? "Passed" : "Pending";
  const additionalDeclaration = submission?.rfpAdditionalDeclarationRequired ? "Yes" : "N/A";
  const importPermitNumber = submission?.importPermitRequired
    ? safeValue(submission?.importPermitNumber)
    : "N/A";
  const gppirComments = safeValue(submission?.ecrComments || submission?.gppirComments || "N/A");
  const recordTitle = isGppir ? GPPIR_RECORD_TYPE : ECR_RECORD_TYPE;

  const headerFields = isGppir
    ? [
        fieldBox("RFP Number", submission?.rfp),
        fieldBox("Establishment Name", submission?.establishmentName || submission?.placeOfInspection),
        fieldBox("Establishment Number", submission?.establishmentNumber || submission?.yardId),
        fieldBox("Exporter Name", submission?.exporter),
        fieldBox("Original RFP No.", submission?.originalRfpNumber || "N/A"),
        fieldBox("Total Quantity", totalWeight.toFixed(4)),
        fieldBox("Unit", GPPIR_WEIGHT_UNIT),
        fieldBox("Est. Net Metric Weight", `${totalWeight.toFixed(2)} TONS`),
        fieldBox("Inspection Start Date and Time", inspectionStart),
        fieldBox("Inspection End Date and Time", inspectionEnd),
        fieldBox("Destination Country", submission?.destinationCountry),
        fieldBox("Import Permit No.", importPermitNumber),
        fieldBox("Flow Path Result", flowResult),
        fieldBox("Flow Path Date and Time", inspectionStart),
        fieldBox("Outcome type", submission?.outcomeType || "Packaged"),
        fieldBox("Expiry Date", expiryDate),
      ].join("")
    : [
        fieldBox("Container Yard Id", submission?.yardId),
        fieldBox("Place of Inspection", submission?.placeOfInspection),
        fieldBox("Inspection Start Date and Time", inspectionStart),
        fieldBox("Inspection End Date and Time", inspectionEnd),
      ].join("");

  const footerFields = isGppir
    ? [
        fieldBox("Submitted AO Name", submission?.aoSignoff),
        fieldBox("Submitted AO Number", submission?.aoNumber),
        fieldBox("Additional Declaration", additionalDeclaration),
        fieldBox("Total Passed", passedWeight.toFixed(4)),
        fieldBox("Unit", GPPIR_WEIGHT_UNIT),
        fieldBox("Comments", gppirComments),
        fieldBox("Total Failed", failedWeight.toFixed(4)),
        fieldBox("Unit", GPPIR_WEIGHT_UNIT),
      ].join("")
    : [
        fieldBox("Submitted AO Name", submission?.aoSignoff),
        fieldBox("Submitted AO Number", submission?.aoNumber),
        fieldBox("Comments", submission?.ecrComments || "N/A"),
      ].join("");

  const tableHead = isGppir
    ? "<th class=\"col-compact\">RFP Line No</th><th>Container Number</th><th>Source</th><th>Commodity</th><th class=\"col-compact\">Package Number</th><th>Type</th><th>Weight</th><th>Unit</th><th>Line Weight</th><th>Unit</th><th>Sampled</th><th>Result</th><th>Inspection AO Name</th><th>Remarks</th>"
    : "<th>Container Number</th><th>Inspection Level</th><th>RFP Number</th><th>Result</th><th>Seal Number</th><th>Expiry Date</th><th>Inspection AO Name</th><th>Remarks</th>";

  const tableBody = isGppir ? buildGppirTableRows(submission) : buildEcrTableRows(submission, expiryDate);
  const colSpan = isGppir ? 14 : 8;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(recordTitle)} - ${escapeHtml(submission?.batchId || "")}</title>
  <style>
    @page { margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px; color: #0f172a; background: #fff; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .subtitle { font-size: 12px; color: #475569; margin-bottom: 16px; }
    .section { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 14px; background: #f8fafc; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #334155; margin-bottom: 10px; }
    .fields { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
    .field { border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; padding: 8px; min-width: 0; }
    .field-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 4px; }
    .field-value { font-size: 12px; color: #0f172a; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; background: #fff; }
    th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; vertical-align: top; word-break: break-word; }
    th.col-compact, td.col-compact { width: 4rem; padding-left: 6px; padding-right: 6px; text-align: center; white-space: nowrap; }
    thead { background: #f1f5f9; }
    .footer-fields { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
    .meta { font-size: 11px; color: #475569; margin-bottom: 12px; }
    @media print {
      body { padding: 0; }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(recordTitle)} (staging)</h1>
  <div class="subtitle">Pack #${escapeHtml(submission?.packId || "")}${submission?.jobReference ? ` · ${escapeHtml(submission.jobReference)}` : ""}</div>
  <div class="meta">
    Batch ${escapeHtml(submission?.batchId || "")} · Submitted ${escapeHtml(submittedAt)} · Status ${escapeHtml(submission?.status || "")}
  </div>
  <div class="section">
    <div class="section-title">Record details</div>
    <div class="fields">${headerFields}</div>
    <table style="margin-top:12px">
      <thead><tr>${tableHead}</tr></thead>
      <tbody>${tableBody || `<tr><td colspan="${colSpan}">No container rows</td></tr>`}</tbody>
    </table>
    <div class="footer-fields">${footerFields}</div>
  </div>
</body>
</html>`;
}

export function resolvePemsSubmissionHtml(submission) {
  if (!submission) return "";
  if (submission.snapshotHtml) return submission.snapshotHtml;
  const batchId = submission.batchId || submission.submissionId;
  const stored = loadPemsSubmissionSnapshot(batchId);
  if (stored) return stored;
  return buildPemsStagingSnapshotHtml(submission);
}

export function openPemsSubmissionDocument(submission, { autoPrint = false } = {}) {
  if (typeof window === "undefined") return;
  const snapshotHtml = resolvePemsSubmissionHtml(submission);
  if (!snapshotHtml) return;
  const previewWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!previewWindow) return;
  previewWindow.document.open();
  previewWindow.document.write(snapshotHtml);
  previewWindow.document.close();
  if (autoPrint) {
    previewWindow.focus();
    window.setTimeout(() => previewWindow.print(), 350);
  }
}

export function printPemsSubmissionDocument(submission) {
  openPemsSubmissionDocument(submission, { autoPrint: true });
}

function buildPemsSubmissionFilename(submission) {
  const batchId = String(submission?.batchId || submission?.submissionId || "pems-submission").trim();
  const type = submission?.recordType === GPPIR_RECORD_TYPE ? "GPPIR" : "ECR";
  return `${batchId}-${type}.pdf`.replace(/[^\w.-]+/g, "_");
}

function resolveCssColor(value) {
  if (value == null || value === "" || value === "transparent") return value;
  const str = String(value);
  if (!/(lab|lch|oklab|oklch)\(/i.test(str)) return str;
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return str;
    ctx.fillStyle = "#ffffff";
    ctx.fillStyle = str;
    return ctx.fillStyle;
  } catch {
    return str;
  }
}

function sanitizeClonedColors(root) {
  const colorProps = [
    "color",
    "background-color",
    "border-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "text-decoration-color",
    "fill",
    "stroke",
  ];
  root.querySelectorAll("*").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    colorProps.forEach((prop) => {
      const value = node.style.getPropertyValue(prop);
      if (!value) return;
      const resolved = resolveCssColor(value);
      if (resolved !== value) node.style.setProperty(prop, resolved);
    });
  });
}

function inlineComputedColors(root, view) {
  const colorProps = [
    "color",
    "background-color",
    "border-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "text-decoration-color",
  ];
  root.querySelectorAll("*").forEach((node) => {
    if (!(node instanceof view.HTMLElement)) return;
    const computed = view.getComputedStyle(node);
    colorProps.forEach((prop) => {
      const value = computed.getPropertyValue(prop);
      if (!value) return;
      node.style.setProperty(prop, resolveCssColor(value));
    });
  });
}

function addCanvasToPdf(pdf, canvas, marginMm = 8) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const innerWidth = pageWidth - marginMm * 2;
  const innerHeight = pageHeight - marginMm * 2;
  const imgWidth = innerWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", marginMm, marginMm, imgWidth, imgHeight);
  heightLeft -= innerHeight;

  while (heightLeft > 0) {
    position += innerHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", marginMm, marginMm - position, imgWidth, imgHeight);
    heightLeft -= innerHeight;
  }
}

async function loadPemsSnapshotFrame(html) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
  iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1200px;height:800px;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);

  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));

  try {
    await new Promise((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error("Failed to load PEM document."));
      iframe.src = blobUrl;
    });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return iframe;
  } catch (error) {
    iframe.remove();
    URL.revokeObjectURL(blobUrl);
    throw error;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function suspendMainDocumentStyles() {
  const disabled = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((node) => {
    if (!(node instanceof HTMLLinkElement)) return;
    disabled.push({ node, media: node.media });
    node.media = "not all";
  });
  document.querySelectorAll("style").forEach((node) => {
    if (!(node instanceof HTMLStyleElement)) return;
    if (!/(lab|lch|oklab|oklch)\(/i.test(node.textContent || "")) return;
    disabled.push({ node, disabled: node.disabled });
    node.disabled = true;
  });
  return () => {
    disabled.forEach((entry) => {
      if (entry.node instanceof HTMLLinkElement) entry.node.media = entry.media || "";
      else if (entry.node instanceof HTMLStyleElement) entry.node.disabled = entry.disabled;
    });
  };
}

/**
 * Generate and download a PDF from the saved staging snapshot HTML.
 */
export async function downloadPemsSubmissionPdf(submission) {
  if (typeof window === "undefined") return false;
  const html = resolvePemsSubmissionHtml(submission);
  if (!html) return false;

  const iframe = await loadPemsSnapshotFrame(html);
  const restoreStyles = suspendMainDocumentStyles();

  try {
    const doc = iframe.contentDocument;
    const body = doc?.body;
    const view = iframe.contentWindow;
    if (!doc || !body || !view) throw new Error("PEM document body missing.");

    inlineComputedColors(body, view);

    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const isGppir = submission?.recordType === GPPIR_RECORD_TYPE;

    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      windowWidth: doc.documentElement.scrollWidth,
      windowHeight: doc.documentElement.scrollHeight,
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((node) => node.remove());
        sanitizeClonedColors(clonedDoc.body || clonedDoc.documentElement);
      },
    });

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: isGppir ? "landscape" : "portrait",
    });
    addCanvasToPdf(pdf, canvas);
    pdf.save(buildPemsSubmissionFilename(submission));
    return true;
  } finally {
    restoreStyles();
    iframe.remove();
  }
}

export function attachPemsSubmissionSnapshot(submission) {
  const snapshotHtml = buildPemsStagingSnapshotHtml(submission);
  const batchId = submission?.batchId || submission?.submissionId;
  if (batchId) savePemsSubmissionSnapshot(batchId, snapshotHtml);
  return { ...submission, snapshotHtml, snapshotSaved: Boolean(batchId) };
}
