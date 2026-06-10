import { Suspense } from "react";
import { notFound } from "next/navigation";
import FumigationRecordPrintClient from "./fumigation-record-print-client";

export const metadata = { title: "Print Record of Fumigation | Packing ERP" };

export default async function Page({ params }) {
  const { packId } = await params;
  const id = String(packId ?? "").trim();
  if (!id) notFound();
  return (
    <Suspense fallback={<div className="px-6 py-12 text-center text-sm text-slate-500">Loading print preview…</div>}>
      <FumigationRecordPrintClient packId={id} />
    </Suspense>
  );
}
