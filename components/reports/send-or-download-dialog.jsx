"use client";

import { useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { RecipientPicker } from "@/components/reports/recipient-picker";
import { appendHistory, getCurrentUserEmail } from "@/lib/reports-store";
import { buildCustomerBundle, buildMultiBundle, downloadBlob } from "@/lib/reports-csv";
import { collectReports, fetchCustomerDirectory, REPORT_LAYOUT_COMBINED, sameId } from "@/lib/reports-data";

function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("authToken");
}

/**
 * Final-step dialog that runs `collectReportData` per customer and then either
 * triggers a download, or POSTs to the (not-yet-built) backend send endpoint.
 * When the backend is absent the email path is recorded as `simulated` in history.
 */
export function SendOrDownloadDialog({ open, request, onClose, onComplete }) {
  const [recipientsByCustomer, setRecipientsByCustomer] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const replyTo = useMemo(() => getCurrentUserEmail(), []);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    fetchCustomerDirectory().then(setCustomers);
  }, []);

  useEffect(() => {
    if (!open) {
      setRecipientsByCustomer({});
      setError("");
      setBusy(false);
    }
  }, [open]);

  if (!open || !request) return null;

  const selectedCustomerIds = request.customerIds || [];
  const isCombined = request.reportLayout === REPORT_LAYOUT_COMBINED;

  async function buildReportsForAll() {
    return collectReports({
      dateRange: request.dateRange,
      customerIds: selectedCustomerIds,
      commodityIds: request.commodityIds,
      sections: request.sections,
      layout: request.reportLayout,
    });
  }

  async function handleDownload() {
    setBusy(true);
    setError("");
    try {
      const reports = await buildReportsForAll();
      const ranBy = replyTo || "";
      const opts = { source: request.source || "ad-hoc", cadenceLabel: request.cadenceLabel || "", ranBy, sections: request.sections };
      if (reports.length === 1) {
        const { blob, fileName } = await buildCustomerBundle(reports[0], opts);
        downloadBlob(blob, fileName);
      } else {
        const { blob, fileName } = await buildMultiBundle(reports, opts);
        downloadBlob(blob, fileName);
      }
      appendHistory({
        source: request.source || "ad-hoc",
        dateRange: request.dateRange,
        recipients: reports.map((r) => ({
          customerId: r.customer?.id ?? null,
          emails: [],
          deliveredAs: "download",
        })),
        artifacts: reports.map((r) => ({
          customerId: r.customer?.id ?? null,
          fileName: `${r.customer?.code || r.customer?.name || "all"}.zip`,
          blobUrl: null,
        })),
        status: "ok",
        notes: "Downloaded locally.",
      });
      onComplete?.();
      onClose();
    } catch (e) {
      setError(e?.message || "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    setBusy(true);
    setError("");
    try {
      const reports = await buildReportsForAll();
      const payload = {
        source: request.source || "ad-hoc",
        dateRange: request.dateRange,
        commodityIds: request.commodityIds,
        sections: request.sections,
        reportLayout: request.reportLayout,
        replyTo,
        recipients: isCombined
          ? [{ customerId: null, customerIds: selectedCustomerIds, emails: recipientsByCustomer.combined || [] }]
          : selectedCustomerIds.map((cid) => ({
              customerId: cid,
              emails: recipientsByCustomer[cid] || [],
            })),
      };
      let delivered = "email";
      let status = "ok";
      let notes = "";
      try {
        const token = getAuthToken();
        const response = await fetch(`${API_BASE_URL}/reports/send`, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          delivered = "simulated";
          status = "partial";
          notes = "Backend reports module not deployed; queued in History as simulated.";
        }
      } catch (e) {
        delivered = "simulated";
        status = "partial";
        notes = `Backend send failed (${e?.message || "network"}); queued in History as simulated.`;
      }
      appendHistory({
        source: request.source || "ad-hoc",
        dateRange: request.dateRange,
        recipients: isCombined
          ? [{ customerId: null, emails: recipientsByCustomer.combined || [], deliveredAs: delivered }]
          : reports.map((r) => ({
              customerId: r.customer?.id ?? null,
              emails: recipientsByCustomer[r.customer?.id] || [],
              deliveredAs: delivered,
            })),
        artifacts: reports.map((r) => ({
          customerId: r.customer?.id ?? null,
          fileName: `${r.customer?.code || r.customer?.name || "all"}.zip`,
          blobUrl: null,
        })),
        status,
        notes,
      });
      onComplete?.();
      onClose();
    } catch (e) {
      setError(e?.message || "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  const canSend = isCombined
    ? (recipientsByCustomer.combined || []).length > 0
    : selectedCustomerIds.length > 0 && selectedCustomerIds.every((cid) => (recipientsByCustomer[cid] || []).length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Send or download</p>
            <h2 className="text-sm font-semibold text-slate-900">
              {isCombined
                ? `Combined report · ${selectedCustomerIds.length} customer${selectedCustomerIds.length === 1 ? "" : "s"}`
                : `${selectedCustomerIds.length} customer${selectedCustomerIds.length === 1 ? "" : "s"}`}{" "}
              · {request.dateRange?.from || "?"} → {request.dateRange?.to || "?"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50" disabled={busy}>
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-[11px] text-slate-500">
            {isCombined
              ? "One combined bundle covering all selected customers. Reply-to on outbound mail:"
              : "Each customer\u2019s bundle is filtered to their own data. Reply-to on outbound mail:"}{" "}
            <span className="font-mono">{replyTo || "(not logged in)"}</span>.
          </p>
          <div className="space-y-4">
            {isCombined ? (
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2">
                  <p className="text-[12px] font-semibold text-slate-800">Combined report recipients</p>
                  <p className="text-[10px] text-slate-500">Addresses from all selected customers are listed below.</p>
                </div>
                <RecipientPicker
                  customerIds={selectedCustomerIds}
                  value={recipientsByCustomer.combined || []}
                  onChange={(emails) => setRecipientsByCustomer((prev) => ({ ...prev, combined: emails }))}
                />
              </div>
            ) : (
              selectedCustomerIds.map((cid) => {
                const customer = customers.find((c) => sameId(c.id, cid));
                return (
                  <div key={cid} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-slate-800">{customer?.name || "Unknown"}</p>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">{customer?.code || ""}</span>
                    </div>
                    <RecipientPicker
                      customerId={cid}
                      value={recipientsByCustomer[cid] || []}
                      onChange={(emails) => setRecipientsByCustomer((prev) => ({ ...prev, [cid]: emails }))}
                    />
                  </div>
                );
              })
            )}
          </div>
          {error ? <p className="mt-3 text-[11px] text-destructive">{error}</p> : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy} className="h-7 px-2.5 text-[11px]">
            Cancel
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={busy} className="h-7 px-2.5 text-[11px]">
            {busy ? "Working…" : "Download bundle"}
          </Button>
          <Button type="button" size="sm" onClick={handleSend} disabled={busy || !canSend} className="h-7 px-2.5 text-[11px]">
            {busy ? "Sending…" : "Send email"}
          </Button>
        </div>
      </div>
    </div>
  );
}
