"use client";

import { cn } from "@/lib/utils";
import {
  buildTestLayout,
  isGroupInRange,
  isStandaloneInRange,
  sumGroupMembers,
  unitForThreshold,
} from "@/lib/test-thresholds";

const defaultInputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

function TestInputCard({
  label,
  unit,
  value,
  disabled,
  onChange,
  state,
  helperText,
  inputClass = defaultInputClass,
}) {
  const isOk = state === "ok";
  const isBad = state === "bad";
  return (
    <div
      className={cn(
        "rounded-md border p-2.5",
        isBad ? "border-red-200 bg-red-50" : isOk ? "border-emerald-200 bg-emerald-50/80" : "border-slate-200 bg-white"
      )}
    >
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-700">
        {label} {unit ? <span className="font-normal text-slate-400">({unit})</span> : null}
      </label>
      <input
        className={cn(inputClass, "text-sm", isBad && "border-red-300", isOk && "border-emerald-300")}
        type="number"
        step="0.01"
        disabled={disabled}
        placeholder="0.00"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {helperText ? <div className="mt-1.5 text-[10px] font-semibold">{helperText}</div> : null}
    </div>
  );
}

export default function TestResultsSection({
  commodityTypeId,
  commodities = [],
  allowedCommodityIds = null,
  testsCatalog = [],
  surface = "",
  testValues = {},
  onChange,
  disabled = false,
  inputClass = defaultInputClass,
  emptyMessage = "No tests are configured for this commodity type.",
  showValidationHints = true,
  validHintLabel = "Within range",
  invalidHintLabel = "Out of range",
}) {
  const { sameCommodities, testsByName, standaloneTests, groups } = buildTestLayout({
    commodities,
    commodityTypeId,
    allowedCommodityIds,
    testsCatalog,
    surface,
  });

  const unitFor = (t) => unitForThreshold(t, testsByName, testsCatalog);

  if (standaloneTests.length === 0 && groups.length === 0) {
    return <p className="text-sm text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {standaloneTests.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
          {standaloneTests.map((t) => {
            const raw = testValues[t.name];
            const num = Number(raw);
            const hasValue = raw !== "" && raw != null && !Number.isNaN(num);
            const ok = hasValue && isStandaloneInRange(t.name, num, sameCommodities);
            const bad = hasValue && !ok;
            return (
              <TestInputCard
                key={t.name}
                label={t.name}
                unit={unitFor(t)}
                value={raw}
                disabled={disabled}
                onChange={(v) => onChange(t.name, v)}
                inputClass={inputClass}
                state={ok ? "ok" : bad ? "bad" : "neutral"}
                helperText={
                  showValidationHints && hasValue ? (
                    ok ? (
                      <span className="text-emerald-700">{validHintLabel}</span>
                    ) : (
                      <span className="text-red-700">{invalidHintLabel}</span>
                    )
                  ) : null
                }
              />
            );
          })}
        </div>
      ) : null}

      {groups.map((g) => {
        const { total, hasValue } = sumGroupMembers(g.members, testValues);
        const ok = hasValue && isGroupInRange(g.groupId, total, sameCommodities);
        const bad = hasValue && !ok;
        return (
          <div key={g.groupId} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                {g.name || "Group"}{" "}
                <span className="font-normal normal-case text-slate-400">— sum of member tests</span>
              </div>
              <div
                className={cn(
                  "rounded-md border px-3 py-1 text-sm font-semibold",
                  bad
                    ? "border-red-300 bg-red-50 text-red-700"
                    : ok
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-white text-slate-700"
                )}
              >
                Total: {hasValue ? total : "—"}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
              {g.members.map((m) => (
                <TestInputCard
                  key={m.name}
                  label={m.name}
                  unit={unitFor(m)}
                  value={testValues[m.name]}
                  disabled={disabled}
                  onChange={(v) => onChange(m.name, v)}
                  inputClass={inputClass}
                  state="neutral"
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
