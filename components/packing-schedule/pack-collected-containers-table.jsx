"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { isUuid } from "@/lib/pack-schedule-api";
import { containerStage } from "@/lib/packers-work-store";
import { stageBadgeClass } from "@/lib/packing-container-ui";
import { cn } from "@/lib/utils";

function formatWeight(value) {
  if (value == null || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : String(value);
}

function displayStage(container, isImport) {
  const stage = containerStage(container, isImport);
  if (stage === "Packing" && String(container.status || "").toLowerCase() === "draft") return "Draft";
  return stage;
}

function hasCollectionRow(container) {
  const number = String(container.containerNumber ?? container.containerNo ?? "").trim();
  if (number) return true;
  const release = String(container.releaseNumber ?? "").trim();
  const parkId = container.emptyContainerParkId ?? container.empty_container_park_id;
  const transporterId = container.transporterId ?? container.transporter_id;
  return Boolean(release && parkId && transporterId);
}

function resolveParkName(container, containerParkOptions) {
  const fromField = String(container.releasePark ?? container.emptyContainerParkName ?? "").trim();
  if (fromField) return fromField;
  const parkId = container.emptyContainerParkId ?? container.empty_container_park_id;
  if (!parkId) return "";
  return containerParkOptions.find((p) => String(p.id) === String(parkId))?.name ?? "";
}

function resolveTransporterName(container, transporterOptions) {
  const fromField = String(container.transporter ?? container.transporterName ?? "").trim();
  if (fromField) return fromField;
  const transporterId = container.transporterId ?? container.transporter_id;
  if (!transporterId) return "";
  return transporterOptions.find((t) => String(t.id) === String(transporterId))?.name ?? "";
}

/**
 * Pack-scoped container breakdown (release / park / transporter) with navigation to packers schedule.
 */
export default function PackCollectedContainersTable({
  containers = [],
  packId = null,
  isImport = false,
  containerParkOptions = [],
  transporterOptions = [],
  className,
}) {
  const router = useRouter();
  const canOpenPackers = Boolean(packId && isUuid(packId));

  const rows = useMemo(() => {
    return containers
      .filter(hasCollectionRow)
      .map((container) => {
        const containerNumber = String(container.containerNumber ?? container.containerNo ?? "").trim();
        return {
          id: container.id,
          order: container.order,
          containerNumber: containerNumber || `Slot ${container.order ?? "—"}`,
          releaseNumber: container.releaseNumber ?? "",
          emptyPark: resolveParkName(container, containerParkOptions),
          transporter: resolveTransporterName(container, transporterOptions),
          isoCode: container.containerIsoCode ?? container.isoCode ?? "",
          stage: displayStage(container, isImport),
          emptyInspection: container.emptyInspection ?? "",
          nettWeight: formatWeight(container.nettWeight),
          hasNumber: Boolean(containerNumber),
        };
      })
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }, [containers, containerParkOptions, transporterOptions, isImport]);

  if (!rows.length) return null;

  function openPackers(containerId) {
    if (!canOpenPackers || !containerId || !isUuid(containerId)) return;
    router.push(`/packers-schedule/${packId}?container=${encodeURIComponent(containerId)}`);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Collected containers ({rows.length})
        </p>
        {canOpenPackers ? (
          <p className="text-[10px] text-slate-500">Select a row to open in Packers Schedule</p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-[11px]">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Container</th>
              <th className="px-2 py-1.5">Release</th>
              <th className="px-2 py-1.5">Empty park</th>
              <th className="px-2 py-1.5">Transporter</th>
              <th className="px-2 py-1.5">ISO</th>
              <th className="px-2 py-1.5">Stage</th>
              <th className="px-2 py-1.5">Empty insp.</th>
              <th className="px-2 py-1.5 text-right">Nett MT</th>
              {canOpenPackers ? <th className="px-2 py-1.5 w-8" aria-label="Open" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const clickable = canOpenPackers && isUuid(row.id);
              return (
                <tr
                  key={row.id || `slot-${row.order}`}
                  className={cn(
                    "border-t border-slate-100",
                    clickable && "cursor-pointer hover:bg-brand/5",
                    !row.hasNumber && "text-slate-600"
                  )}
                  onClick={() => clickable && openPackers(row.id)}
                  onKeyDown={(event) => {
                    if (!clickable) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openPackers(row.id);
                    }
                  }}
                  tabIndex={clickable ? 0 : undefined}
                  role={clickable ? "button" : undefined}
                >
                  <td className="px-2 py-1.5 tabular-nums text-slate-500">{row.order ?? "—"}</td>
                  <td className="px-2 py-1.5 font-mono font-medium text-slate-900">{row.containerNumber}</td>
                  <td className="px-2 py-1.5">{row.releaseNumber || "—"}</td>
                  <td className="px-2 py-1.5">{row.emptyPark || "—"}</td>
                  <td className="px-2 py-1.5">{row.transporter || "—"}</td>
                  <td className="px-2 py-1.5">{row.isoCode || "—"}</td>
                  <td className="px-2 py-1.5">
                    {row.stage ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          stageBadgeClass(row.stage)
                        )}
                      >
                        {row.stage}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-1.5">{row.emptyInspection || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{row.nettWeight || "—"}</td>
                  {canOpenPackers ? (
                    <td className="px-2 py-1.5 text-slate-400">
                      {clickable ? <ExternalLink className="h-3.5 w-3.5" aria-hidden /> : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
