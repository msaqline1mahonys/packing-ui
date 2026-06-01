"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  attachmentCanQuickLook,
  formatAttachmentBytes,
  previewKindForFileItem,
  resolvePackAttachmentViewUrl,
} from "@/lib/pack-attachments";

function PackAttachmentPreviewModal({ preview, onClose }) {
  if (!preview) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pack-file-preview-title"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[min(90vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <p id="pack-file-preview-title" className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
            {preview.title}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={preview.src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-brand-ink underline-offset-2 hover:underline"
            >
              Open in new tab
            </a>
            <Button type="button" variant="secondary" size="sm" className="h-8 shrink-0 px-2" onClick={onClose} aria-label="Close preview">
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50">
          {preview.kind === "image" ? (
            <img src={preview.src} alt="" className="mx-auto max-h-[80vh] max-w-full object-contain p-2" />
          ) : null}
          {preview.kind === "pdf" ? (
            <iframe title={preview.title} src={preview.src} className="min-h-[70vh] w-full bg-white" />
          ) : null}
          {preview.kind === "generic" ? (
            <div className="p-8 text-center text-sm text-slate-600">
              <p className="mb-3">Inline preview is not available for this file type.</p>
              <a
                href={preview.src}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-600 underline-offset-2 hover:underline"
              >
                Open in new tab
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PackFileList({ items, onRemove, className = "" }) {
  const [filePreview, setFilePreview] = useState(null);
  const previewRevokeRef = useRef(null);

  const closeFilePreview = useCallback(() => {
    if (previewRevokeRef.current) {
      previewRevokeRef.current();
      previewRevokeRef.current = null;
    }
    setFilePreview(null);
  }, []);

  const openQuickLook = useCallback(
    (item) => {
      const viewUrl = resolvePackAttachmentViewUrl(item);
      if (viewUrl) {
        closeFilePreview();
        previewRevokeRef.current = null;
        setFilePreview({ src: viewUrl, title: item.name || "Attachment", kind: previewKindForFileItem(item) });
        return;
      }
      if (!(item?.file instanceof File)) return;
      closeFilePreview();
      const src = URL.createObjectURL(item.file);
      previewRevokeRef.current = () => URL.revokeObjectURL(src);
      setFilePreview({ src, title: item.name || "Attachment", kind: previewKindForFileItem(item) });
    },
    [closeFilePreview]
  );

  useEffect(() => {
    if (!filePreview) return undefined;
    function onKey(event) {
      if (event.key === "Escape") closeFilePreview();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filePreview, closeFilePreview]);

  useEffect(
    () => () => {
      if (previewRevokeRef.current) previewRevokeRef.current();
    },
    []
  );

  if (!items.length) {
    return <p className={className || "mt-2 text-xs text-slate-400"}>No files added.</p>;
  }

  return (
    <>
      <div className={className || "mt-2 space-y-1.5"}>
        {items.map((item) => {
          const canLook = attachmentCanQuickLook(item);
          return (
            <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{item.name}</span>
              {formatAttachmentBytes(item.size) ? <span className="text-slate-500">{formatAttachmentBytes(item.size)}</span> : null}
              {canLook ? (
                <button
                  type="button"
                  title={`Quick look: ${item.name}`}
                  aria-label={`Quick look ${item.name}`}
                  onClick={() => openQuickLook(item)}
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded border border-slate-200/90 bg-white text-slate-600 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand-700"
                >
                  <Eye className="size-3" aria-hidden />
                </button>
              ) : (
                <span className="text-slate-400">Stored name only</span>
              )}
              <button type="button" className="text-rose-600 hover:text-rose-700" onClick={() => onRemove(item.id)}>
                Remove
              </button>
            </div>
          );
        })}
      </div>
      <PackAttachmentPreviewModal preview={filePreview} onClose={closeFilePreview} />
    </>
  );
}
