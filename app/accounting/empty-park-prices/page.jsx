"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getEmptyParkPrices, saveEmptyParkPrices } from "@/lib/api/accounting";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

function BtnPrimary({ className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export default function EmptyParkPricesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    getEmptyParkPrices()
      .then((data) => {
        setRows(Array.isArray(data?.rows) ? data.rows : []);
      })
      .catch((err) => {
        setRows([]);
        setErrorText(err?.message || "Failed to load empty park prices.");
      })
      .finally(() => setLoading(false));
  }, []);

  function handleChange(id, field, value) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
    setSavedIndicator(false);
    setErrorText("");
  }

  async function handleSave() {
    setSaving(true);
    setErrorText("");
    setSavedIndicator(false);
    try {
      const payload = {
        rows: rows.map((row) => ({
          ...row,
          revenuePrice: row.revenuePrice === "" || row.revenuePrice == null ? 0 : Number(row.revenuePrice),
          expensePrice: row.expensePrice === "" || row.expensePrice == null ? 0 : Number(row.expensePrice),
        })),
      };
      await saveEmptyParkPrices(payload);
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 2500);
    } catch (err) {
      setErrorText(err?.message || "Failed to save empty park prices. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="space-y-1">
        <p className="text-xs text-slate-500">Accounting / Empty Park Prices</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f1e3d] md:text-[1.65rem]">Empty Park Prices</h1>
        <p className="text-xs leading-relaxed text-slate-500">
          Set the revenue price (used for invoicing) and expense price for each container park. Park records are shared from{" "}
          <Link href="/reference-data/container-park" className="font-semibold text-brand hover:underline">
            Reference Data → Container Park
          </Link>
          .
        </p>
      </div>

      <div className="rounded-[10px] border border-slate-200 bg-white p-3 md:p-[18px]">
        {errorText ? (
          <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {errorText}
          </div>
        ) : null}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading container parks…</p>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            <p>No container parks found for this site.</p>
            <p className="mt-2">
              Add parks in{" "}
              <Link href="/reference-data/container-park" className="font-semibold text-brand hover:underline">
                Reference Data → Container Park
              </Link>
              , then return here to set prices.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Container Park
                    </th>
                    <th className="pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Revenue Price
                    </th>
                    <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Expense Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-slate-900">{row.name}</p>
                        {row.chainName ? (
                          <p className="text-[11px] text-slate-400">{row.chainName}</p>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-4">
                        <input
                          className={cn(inputClass, "max-w-[160px]")}
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.revenuePrice ?? ""}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => handleChange(row.id, "revenuePrice", e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-2.5">
                        <input
                          className={cn(inputClass, "max-w-[160px]")}
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.expensePrice ?? ""}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => handleChange(row.id, "expensePrice", e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
              <BtnPrimary onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </BtnPrimary>
              {savedIndicator ? (
                <span className="text-xs font-medium text-emerald-600">Saved successfully.</span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
