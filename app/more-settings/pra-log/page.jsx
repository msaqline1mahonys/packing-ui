"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchPraSubmissionDetail, fetchPraSubmissionLog } from "@/lib/pra/api";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["", "Accepted", "Pending", "Rejected", "Error"];

const statusClass = {
  Accepted: "bg-emerald-100 text-emerald-800",
  Pending: "bg-amber-100 text-amber-800",
  Rejected: "bg-rose-100 text-rose-800",
  Error: "bg-rose-100 text-rose-800",
};

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function JsonBlock({ value }) {
  if (value == null) {
    return <p className="text-sm text-slate-500">No data recorded.</p>;
  }
  return (
    <pre className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function PraLogPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchPraSubmissionLog({ page, perPage: 25, search, status });
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setLastPage(data.lastPage || 1);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load PRA submission log.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  async function openDetail(id) {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await fetchPraSubmissionDetail(id);
      setDetail(data);
    } catch (err) {
      setDetail({ error: err instanceof Error ? err.message : "Unable to load submission detail." });
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
  }

  function applySearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">PRA submission log</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review PRA submit and cancel attempts for the current site, including middleware responses.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <form onSubmit={applySearch} className="flex min-w-[220px] flex-1 flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 space-y-1">
            <span className="text-xs font-medium text-slate-600">Search</span>
            <input
              className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand/35 focus:ring-2 focus:ring-brand/15"
              placeholder="Container, release, pack ref…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select
              className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand/35 focus:ring-2 focus:ring-brand/15"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All statuses"}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm">
            Search
          </Button>
        </form>
        <Button type="button" variant="outline" size="sm" onClick={loadRows} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Pack</th>
                <th className="px-4 py-3">Container</th>
                <th className="px-4 py-3">HTTP</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Loading submissions…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    No PRA submissions found for this site.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatWhen(row.submitted_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                          statusClass[row.status] || "bg-slate-100 text-slate-700"
                        )}
                      >
                        {row.status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.message_function || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.pack_reference || row.pack_number || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.container_number || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.http_status ?? "—"}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={row.fault_message || ""}>
                      {row.fault_message || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openDetail(row.id)}>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <span>
            {total.toLocaleString()} submission{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span>
              Page {page} of {lastPage}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= lastPage || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {selectedId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={closeDetail} />
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Submission detail</h2>
                {detail?.container_number ? (
                  <p className="text-xs text-slate-500">{detail.container_number}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100"
                onClick={closeDetail}
              >
                ×
              </button>
            </div>

            <div className="space-y-5 p-4">
              {detailLoading ? (
                <p className="text-sm text-slate-500">Loading detail…</p>
              ) : detail?.error ? (
                <p className="text-sm text-red-600">{detail.error}</p>
              ) : detail ? (
                <>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem label="Submitted" value={formatWhen(detail.submitted_at)} />
                    <DetailItem label="Status" value={detail.status} />
                    <DetailItem label="Message function" value={detail.message_function} />
                    <DetailItem label="Pack reference" value={detail.pack_reference || detail.pack_number} />
                    <DetailItem label="Container" value={detail.container_number} />
                    <DetailItem label="HTTP status" value={detail.http_status ?? detail.api_log?.http_status} />
                    <DetailItem label="Endpoint" value={detail.endpoint_url || detail.api_log?.endpoint_url} />
                    <DetailItem label="Duration (ms)" value={detail.duration_ms ?? detail.api_log?.duration_ms} />
                    <DetailItem label="External reference" value={detail.external_reference} />
                  </dl>

                  {detail.fault_message || detail.api_log?.fault_message ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {detail.fault_message || detail.api_log?.fault_message}
                    </div>
                  ) : null}

                  {detail.pack_id ? (
                    <Link
                      href={`/packers-schedule/${detail.pack_id}`}
                      className="inline-flex text-sm font-medium text-brand hover:underline"
                    >
                      Open pack in packers schedule →
                    </Link>
                  ) : null}

                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payload sent</h3>
                    <JsonBlock value={detail.payload} />
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Middleware response</h3>
                    <JsonBlock value={detail.response ?? detail.api_log?.response_payload} />
                  </section>

                  {detail.api_log?.request_payload ? (
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">HTTP request log</h3>
                      <JsonBlock value={detail.api_log.request_payload} />
                    </section>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}
