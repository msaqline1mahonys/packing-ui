"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadPemsSubmissionPdf, resolvePemsSubmissionHtml } from "@/lib/pems-staging-snapshot";

export default function PemsSubmissionPreviewModal({ submission, onClose }) {
  const iframeRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    if (!submission) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = resolvePemsSubmissionHtml(submission);
    setDownloadError("");
  }, [submission]);

  useEffect(() => {
    if (!submission) return;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submission, onClose]);

  async function handleDownload() {
    if (!submission || isDownloading) return;
    setIsDownloading(true);
    setDownloadError("");
    try {
      const ok = await downloadPemsSubmissionPdf(submission);
      if (!ok) setDownloadError("Could not generate PDF for this submission.");
    } catch (error) {
      setDownloadError(error?.message || "PDF download failed.");
    } finally {
      setIsDownloading(false);
    }
  }

  if (!submission) return null;

  const title = submission.recordType || "PEM submission";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`${title} preview`}>
      <div className="flex h-[min(92vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
            <p className="truncate text-xs text-slate-500">
              {submission.batchId}
              {submission.submittedAt ? ` · ${new Date(submission.submittedAt).toLocaleString()}` : ""}
            </p>
            {downloadError ? <p className="mt-1 text-xs text-rose-600">{downloadError}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={isDownloading} onClick={handleDownload}>
              {isDownloading ? "Downloading…" : "Download PDF"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <iframe ref={iframeRef} title={`${title} document`} className="min-h-0 flex-1 w-full border-0 bg-white" />
      </div>
    </div>
  );
}
