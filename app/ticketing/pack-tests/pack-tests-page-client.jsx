"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { deriveTestStatus } from "@/lib/pack-tests";
import { listPackTests, updatePackTest } from "@/lib/pack-tests-api";
import { cn } from "@/lib/utils";

const inputClass =
  "h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none ring-brand/15 focus:border-brand/40 focus:ring-2";

function statusBadgeClass(status) {
  const value = String(status || "pending").toLowerCase();
  if (value === "pass") return "bg-emerald-100 text-emerald-800";
  if (value === "fail") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-600";
}

export default function PackTestsPageClient() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const { rows: nextRows } = await listPackTests({ search: search.trim() || undefined, perPage: 100 });
      setRows(nextRows);
      const nextDrafts = {};
      nextRows.forEach((row) => {
        nextDrafts[row.id] = {
          value: row.value ?? "",
          notes: row.notes ?? "",
          status: row.status ?? "pending",
        };
      });
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err?.message || "Unable to load pack tests.");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = row.packId || row.pack?.id || "unknown";
      if (!map.has(key)) {
        map.set(key, { pack: row.pack, tests: [] });
      }
      map.get(key).tests.push(row);
    });
    return Array.from(map.values());
  }, [rows]);

  async function saveRow(row) {
    const draft = drafts[row.id];
    if (!draft) return;
    setSavingId(row.id);
    setError("");
    try {
      const status = deriveTestStatus({ ...row, ...draft });
      const updated = await updatePackTest(row.id, {
        value: draft.value,
        notes: draft.notes,
        status,
      });
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...updated } : item)));
      setDrafts((prev) => ({
        ...prev,
        [row.id]: {
          value: updated.value ?? "",
          notes: updated.notes ?? "",
          status: updated.status ?? status,
        },
      }));
    } catch (err) {
      setError(err?.message || "Unable to save pack test.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Pack tests</h1>
          <p className="text-sm text-slate-600">Update quality test results linked to packing schedule packs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={cn(inputClass, "w-56")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job ref or test"
          />
          <Button type="button" variant="outline" size="sm" onClick={loadRows} disabled={isLoading}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading pack tests…</p>
      ) : grouped.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">No pack tests found.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ pack, tests }) => (
            <section key={pack?.id || tests[0]?.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{pack?.jobReference || "Pack"}</p>
                  <p className="text-xs text-slate-500">
                    {[pack?.customer, pack?.commodity].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="ms-auto flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700">{pack?.status || "—"}</span>
                  {pack?.id ? (
                    <Link href={`/packers-schedule/${pack.id}`} className="font-medium text-brand hover:underline">
                      Open pack
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {tests.map((row) => {
                  const draft = drafts[row.id] || { value: "", notes: "", status: "pending" };
                  return (
                    <div key={row.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(160px,1fr)_120px_minmax(180px,1.2fr)_auto] md:items-end">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.testName}</p>
                        <p className="text-xs text-slate-500">
                          {row.testType}
                          {row.unit ? ` · ${row.unit}` : ""}
                          {(row.thresholdMin != null && row.thresholdMin !== "") || (row.thresholdMax != null && row.thresholdMax !== "")
                            ? ` · ${row.thresholdMin ?? "—"} – ${row.thresholdMax ?? "—"}`
                            : ""}
                        </p>
                      </div>
                      <label className="block text-xs font-medium text-slate-600">
                        Value
                        <input
                          className={cn(inputClass, "mt-1")}
                          value={draft.value}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [row.id]: { ...draft, value: e.target.value },
                            }))
                          }
                        />
                      </label>
                      <label className="block text-xs font-medium text-slate-600">
                        Notes
                        <input
                          className={cn(inputClass, "mt-1")}
                          value={draft.notes}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [row.id]: { ...draft, notes: e.target.value },
                            }))
                          }
                        />
                      </label>
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", statusBadgeClass(draft.status))}>
                          {deriveTestStatus({ ...row, ...draft })}
                        </span>
                        <Button type="button" size="sm" disabled={savingId === row.id} onClick={() => saveRow(row)}>
                          {savingId === row.id ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
