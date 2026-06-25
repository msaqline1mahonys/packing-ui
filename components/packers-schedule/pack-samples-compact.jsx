"use client";

import { FileText } from "lucide-react";

import {
  formatPackSampleSummary,
  formatPackSampleTooltip,
  getPackSamples,
  sampleStatusBadgeClass,
} from "@/lib/pack-samples-api";
import { cn } from "@/lib/utils";

function SampleChip({ sample, className }) {
  const summary = formatPackSampleSummary(sample);
  if (!summary) return null;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 py-1 text-xs font-medium leading-snug",
        sampleStatusBadgeClass(sample.status),
        className
      )}
      title={formatPackSampleTooltip(sample)}
    >
      <span className="truncate">{summary}</span>
      {sample.resultFileUrl ? (
        <a
          href={sample.resultFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-current/80 hover:text-current"
          aria-label="View sample result"
          title="View sample result"
          onClick={(event) => event.stopPropagation()}
        >
          <FileText className="size-3.5" />
        </a>
      ) : null}
    </span>
  );
}

export function PackSamplesFormStrip({ row }) {
  const samples = getPackSamples(row);
  if (!samples.length) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pack samples</span>
      {samples.map((sample, index) => (
        <SampleChip key={sample.id ?? `sample-${index}`} sample={sample} />
      ))}
    </div>
  );
}
