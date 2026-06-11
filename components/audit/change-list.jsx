import { formatAuditValue, humanizeField } from "@/lib/audit-format";

/**
 * Renders a list of field changes as "Field: old → new".
 * @param {{ changes: {key:string, old:unknown, new:unknown}[], max?: number }} props
 */
export function ChangeList({ changes, max }) {
  if (!changes?.length) return null;
  const shown = typeof max === "number" ? changes.slice(0, max) : changes;
  const extra = typeof max === "number" ? changes.length - shown.length : 0;

  return (
    <ul className="mt-1 space-y-1">
      {shown.map((c) => (
        <li key={c.key} className="text-xs leading-snug">
          <span className="font-medium text-slate-600">{humanizeField(c.key)}: </span>
          <span className="text-slate-400 line-through">{formatAuditValue(c.old)}</span>
          <span className="mx-1 text-slate-400">→</span>
          <span className="font-medium text-slate-800">{formatAuditValue(c.new)}</span>
        </li>
      ))}
      {extra > 0 ? <li className="text-[11px] text-slate-400">+{extra} more change{extra > 1 ? "s" : ""}</li> : null}
    </ul>
  );
}
