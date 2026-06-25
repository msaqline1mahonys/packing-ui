"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const INGEST_ENDPOINT = `${API_BASE_URL}/reference-data/vessels/ingest`;
const RUNS_ENDPOINT = `${API_BASE_URL}/reference-data/vessels/ingest/runs`;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

async function readApiJson(res) {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Empty response from server.");
  }
  if (trimmed.startsWith("<")) {
    if (/unable to create a temporary file/i.test(trimmed)) {
      throw new Error(
        "The API server could not save the uploaded file. Restart it with `php scripts/serve.php` (or `composer dev`) so uploads use storage/app/upload-tmp."
      );
    }
    if (/exceeds the limit/i.test(trimmed)) {
      throw new Error("Upload is too large for the server PHP limits (max 20 MB per file).");
    }
    throw new Error("Server returned an HTML error instead of JSON. Check the API logs.");
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error("Invalid JSON response from server.");
  }
}

function getAuthToken() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("authToken");
  } catch {
    return null;
  }
}

export function VesselIngestDialog({ open, onClose, onIngestComplete }) {
  const [vsFile, setVsFile] = useState(null);
  const [vrFile, setVrFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [runs, setRuns] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${RUNS_ENDPOINT}?per_page=10`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await readApiJson(res);
      const data = json?.data?.data ?? json?.data ?? [];
      setRuns(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) {
      setVsFile(null);
      setVrFile(null);
      setResult(null);
      setError("");
      setShowHistory(false);
      loadHistory();
    }
  }, [open, loadHistory]);

  const submit = async () => {
    if (!vsFile && !vrFile) {
      setError("Choose at least one of the two CSV files.");
      return;
    }
    const tooLarge = [vsFile, vrFile].filter(Boolean).find((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooLarge) {
      setError(`"${tooLarge.name}" is too large. Each CSV must be 20 MB or less.`);
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setError("Not authenticated. Please log in again.");
      return;
    }
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      if (vsFile) fd.append("vs_file", vsFile);
      if (vrFile) fd.append("vr_file", vrFile);
      const res = await fetch(INGEST_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        body: fd,
      });
      const json = await readApiJson(res);
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Ingest failed.");
      }
      setResult(json?.data ?? null);
      onIngestComplete?.();
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingest failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={submitting ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Import Vessel Schedule</h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            disabled={submitting}
          >
            x
          </button>
        </div>

        <div className="space-y-5 p-4">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          {result ? (
            <div
              className={cn(
                "rounded-md border p-3 text-sm",
                result.status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : result.status === "partial"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-red-200 bg-red-50 text-red-700"
              )}
            >
              <p className="font-semibold capitalize">{result.status}</p>
              {result.report ? (
                <ul className="mt-2 space-y-0.5 text-xs">
                  <li>Vessels created: {result.report.vessels_created ?? 0}</li>
                  <li>Vessels updated: {result.report.vessels_updated ?? 0}</li>
                  <li>Voyages created: {result.report.voyages_created ?? 0}</li>
                  <li>Voyages updated: {result.report.voyages_updated ?? 0}</li>
                  <li>Skipped rows: {result.report.skipped_rows ?? 0}</li>
                  <li>
                    Stubs created: terminals {result.report.stubs_created?.terminals ?? 0},
                    ports {result.report.stubs_created?.ports ?? 0}, shipping lines{" "}
                    {result.report.stubs_created?.shipping_lines ?? 0}
                  </li>
                  {Array.isArray(result.report.errors) && result.report.errors.length > 0 ? (
                    <li className="pt-1 font-semibold">Errors:</li>
                  ) : null}
                  {Array.isArray(result.report.errors)
                    ? result.report.errors.slice(0, 5).map((e, idx) => (
                        <li key={idx} className="pl-3 text-xs">- {e}</li>
                      ))
                    : null}
                </ul>
              ) : null}
            </div>
          ) : null}

          <FilePicker
            label="Schedule CSV (vs*.csv)"
            file={vsFile}
            onChange={setVsFile}
            disabled={submitting}
          />
          <FilePicker
            label="Rotation CSV (vr*.csv) — optional"
            file={vrFile}
            onChange={setVrFile}
            disabled={submitting}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowHistory((prev) => !prev)}
            >
              {showHistory ? "Hide" : "View"} import history
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
                Close
              </Button>
              <Button type="button" size="sm" onClick={submit} disabled={submitting || (!vsFile && !vrFile)}>
                {submitting ? "Importing..." : "Run ingest"}
              </Button>
            </div>
          </div>

          {showHistory ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">Recent runs</p>
              {runs.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">No runs yet.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {runs.map((run) => (
                    <li
                      key={run.id}
                      className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                    >
                      <span className="font-mono text-slate-500">
                        {new Date(run.created_at).toLocaleString()}
                      </span>
                      <span className="capitalize text-slate-700">{run.source.replace("_", " ")}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                          run.status === "success"
                            ? "bg-emerald-100 text-emerald-700"
                            : run.status === "partial"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        )}
                      >
                        {run.status}
                      </span>
                      <span className="text-slate-500">
                        v:{run.report?.voyages_created ?? 0}+{run.report?.voyages_updated ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilePicker({ label, file, onChange, disabled }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={disabled}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
        />
        {file ? (
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-red-600"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
