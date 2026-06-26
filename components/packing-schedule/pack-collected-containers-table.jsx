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
import { canToggleOnSite } from "@/lib/packers-work-store";
import { cn } from "@/lib/utils";

/** Fixed viewport height for the pack-form collected containers grid. */
const PACK_FORM_CONTAINERS_PANEL_HEIGHT = "h-[420px]";

/**
 * Pack-scoped slice of the packing schedule containers grid (same Grid + columns as /packing-schedule/containers).
 */
export default function PackCollectedContainersTable({
  containers = [],
  pack = {},
  packId = null,
  containerParkOptions = [],
  transporterOptions = [],
  onContainerUpdated,
  className,
}) {
  const router = useRouter();
  const resolvedPackId = packId ?? pack.id ?? null;
  const canOpenPackers = Boolean(resolvedPackId && isUuid(resolvedPackId));
  const [savingOnSiteId, setSavingOnSiteId] = useState(null);
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

  const toggleOnSite = useCallback(
    async (row) => {
      if (!row?.id || !resolvedPackId || savingOnSiteId) return;
      const stage = displayContainerStage(row);
      if (!canToggleOnSite(stage)) return;
      const next = !Boolean(row.onSite ?? row.on_site);
      setSavingOnSiteId(row.id);
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
        window.alert(err?.message || "Failed to update on-site status.");
      } finally {
        setSavingOnSiteId(null);
      }
    },
    [resolvedPackId, savingOnSiteId, onContainerUpdated],
  );

  const gridColumns = useMemo(
    () =>
      buildContainerGridColumns({
        onToggleOnSite: resolvedPackId && isUuid(resolvedPackId) ? toggleOnSite : null,
        savingOnSiteId,
      }),
    [toggleOnSite, savingOnSiteId, resolvedPackId],
  );

  const openPackers = useCallback(
    (row) => {
      if (!canOpenPackers || !row?.id || !isUuid(row.id)) return;
      router.push(`/packers-schedule/${resolvedPackId}?container=${encodeURIComponent(row.id)}`);
    },
    [canOpenPackers, resolvedPackId, router],
  );

  const panelClassName = cn(
    "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm",
  );

  if (!rows.length) {
    return (
      <section
        className={cn("min-w-0", PACK_FORM_CONTAINERS_PANEL_HEIGHT, className)}
        aria-label="Collected containers"
      >
        <div className={cn(panelClassName, "items-center justify-center")}>
          <p className="px-3 py-8 text-center text-xs text-slate-400">No containers on this pack yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn("min-w-0", PACK_FORM_CONTAINERS_PANEL_HEIGHT, className)}
      aria-label="Collected containers"
    >
      <div className={panelClassName}>
        <Grid
          className="flex min-h-0 flex-1 flex-col"
          fillScrollArea
          columns={gridColumns}
          rows={rows}
          getRowId={(row) => row.id}
          theme="light"
          density="standard"
          fileName="Packing Schedule Containers"
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
