"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Grid } from "@/components/clutch-table";
import { updateContainer } from "@/lib/api/packing";
import { isUuid } from "@/lib/pack-schedule-api";
import {
  buildContainerGridColumns,
  decoratePackScopedContainerRow,
  displayContainerStage,
} from "@/lib/packing-containers-grid";
import { cn } from "@/lib/utils";

/**
 * Pack-scoped slice of the packing schedule containers grid (same Grid + columns as /packing-schedule/containers).
 * When `panelHeight` is set (xl layout), height matches the adjacent containers/releases panel.
 */
export default function PackCollectedContainersTable({
  containers = [],
  pack = {},
  packId = null,
  containerParkOptions = [],
  transporterOptions = [],
  onContainerUpdated,
  panelHeight = null,
  className,
}) {
  const router = useRouter();
  const resolvedPackId = packId ?? pack.id ?? null;
  const canOpenPackers = Boolean(resolvedPackId && isUuid(resolvedPackId));
  const [savingSiteStageId, setSavingSiteStageId] = useState(null);
  const [localPatches, setLocalPatches] = useState({});

  const rows = useMemo(() => {
    return containers
      .map((container) => {
        const decorated = decoratePackScopedContainerRow(container, {
          pack: { ...pack, id: resolvedPackId },
          containerParkOptions,
          transporterOptions,
        });
        const patch = localPatches[decorated.id];
        return patch ? { ...decorated, ...patch } : decorated;
      })
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }, [containers, pack, resolvedPackId, containerParkOptions, transporterOptions, localPatches]);

  const toggleSiteStage = useCallback(
    async (row) => {
      if (!row?.id || !resolvedPackId || savingSiteStageId) return;
      const stage = displayContainerStage(row);
      if (stage !== "Off Site" && stage !== "On Site") return;
      const next = stage === "Off Site";
      setSavingSiteStageId(row.id);
      setLocalPatches((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), onSite: next } }));
      try {
        await updateContainer(resolvedPackId, row.id, { onSite: next });
        onContainerUpdated?.(row.id, { onSite: next });
      } catch (err) {
        setLocalPatches((prev) => {
          const current = prev[row.id];
          if (!current) return prev;
          const nextPatches = { ...prev, [row.id]: { ...current, onSite: !next } };
          if (nextPatches[row.id].onSite === row.onSite) {
            const { [row.id]: _, ...rest } = nextPatches;
            return rest;
          }
          return nextPatches;
        });
        window.alert(err?.message || "Failed to update container stage.");
      } finally {
        setSavingSiteStageId(null);
      }
    },
    [resolvedPackId, savingSiteStageId, onContainerUpdated],
  );

  const gridColumns = useMemo(
    () =>
      buildContainerGridColumns({
        onToggleSiteStage: resolvedPackId && isUuid(resolvedPackId) ? toggleSiteStage : null,
        savingSiteStageId,
      }),
    [toggleSiteStage, savingSiteStageId, resolvedPackId],
  );

  const openPackers = useCallback(
    (row) => {
      if (!canOpenPackers || !row?.id || !isUuid(row.id)) return;
      router.push(`/packers-schedule/${resolvedPackId}?container=${encodeURIComponent(row.id)}`);
    },
    [canOpenPackers, resolvedPackId, router],
  );

  const panelStyle = panelHeight ? { height: panelHeight } : undefined;
  const fillScrollArea = Boolean(panelHeight);
  const panelClassName = cn(
    "flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm",
    fillScrollArea && "h-full",
  );

  if (!rows.length) {
    return (
      <section className={cn("min-w-0", className)} aria-label="Collected containers">
        <div className={cn(panelClassName, "items-center justify-center")} style={panelStyle}>
          <p className="px-3 py-8 text-center text-xs text-slate-400">No containers on this pack yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("min-w-0", className)} aria-label="Collected containers">
      <div className={panelClassName} style={panelStyle}>
        <Grid
          className="flex min-h-0 flex-1 flex-col"
          fillScrollArea={fillScrollArea}
          columns={gridColumns}
          rows={rows}
          getRowId={(row) => row.id}
          theme="light"
          density="standard"
          fileName="Packing Schedule Containers"
          visibleRows={10}
          enablePagination={false}
          persistKey={resolvedPackId ? `pack-form-containers-${resolvedPackId}` : false}
          onRowClick={canOpenPackers ? openPackers : undefined}
          getRowClassName={({ row }) => {
            const rowClasses = [];
            if (row.importExport === "Import") rowClasses.push("clutch-row-import");
            if (canOpenPackers) rowClasses.push("cursor-pointer");
            return rowClasses.join(" ") || undefined;
          }}
          getRowStyle={({ row }) => {
            if (row.importExport === "Import") return { backgroundColor: "#eff6ff" };
            return undefined;
          }}
          toolbarActions={
            <span className="ms-auto text-[11px] text-slate-500">
              {rows.length} container{rows.length === 1 ? "" : "s"}
              {canOpenPackers ? " · click row to open Packers Schedule" : ""}
            </span>
          }
        />
      </div>
    </section>
  );
}
