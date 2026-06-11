"use client";

import { useEffect, useState } from "react";
import Drawer from "@mui/material/Drawer";
import { X } from "lucide-react";

import { fetchAuditLogs } from "@/lib/audit-api";
import { changesFromAuditLog, relativeTime } from "@/lib/audit-format";
import { ChangeList } from "@/components/audit/change-list";

const EVENT_STYLES = {
  created: "bg-emerald-50 text-emerald-700 border-emerald-200",
  updated: "bg-blue-50 text-blue-700 border-blue-200",
  deleted: "bg-red-50 text-red-700 border-red-200",
};

function HistoryEntry({ log }) {
  const changes = changesFromAuditLog(log);
  const badge = EVENT_STYLES[log.event] || EVENT_STYLES.updated;

  return (
    <li className="relative border-l border-slate-200 pb-5 pl-4 last:pb-0">
      <span className="absolute -left-[5px] top-1 size-2.5 rounded-full border-2 border-white bg-brand" aria-hidden />
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge}`}>
          {log.event}
        </span>
        <span className="text-xs text-slate-500">
          {log.userName ? `${log.userName} • ` : ""}
          {relativeTime(log.createdAt)}
        </span>
      </div>
      {log.description ? (
        <p className="mt-1 text-[13px] font-medium text-slate-800">{log.description}</p>
      ) : null}
      {changes.length ? (
        <ChangeList changes={changes} />
      ) : (
        <p className="mt-1 text-xs text-slate-400">No field-level changes recorded.</p>
      )}
    </li>
  );
}

/**
 * Right-hand drawer showing the change history (audit log) for one record.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   subjectType: string,   // alias: pack | ticket | vessel-voyage | release
 *   subjectId: string,
 *   title?: string,
 * }} props
 */
export function HistoryDrawer({ open, onClose, subjectType, subjectId, title = "History" }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !subjectId) return undefined;

    let active = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetchAuditLogs({ subjectType, subjectId })
      .then((rows) => {
        if (active) setLogs(rows);
      })
      .catch((err) => {
        if (active) {
          setLogs([]);
          setError(err?.message || "Failed to load history.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, subjectType, subjectId]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 460 } } }}
    >
      <div className="flex h-full flex-col bg-white">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-400">Change history</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-400">Loading history…</p>
          ) : error ? (
            <p className="py-10 text-center text-sm text-red-500">{error}</p>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No history yet.</p>
          ) : (
            <ul className="ml-1">
              {logs.map((log) => (
                <HistoryEntry key={log.id} log={log} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}
