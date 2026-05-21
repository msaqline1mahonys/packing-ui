import { Suspense } from "react";
import { notFound } from "next/navigation";
import FumigationCertificateEditorClient from "./fumigation-certificate-editor-client";

export const metadata = { title: "Certificate of Fumigation | Packing ERP" };

export default async function Page({ params }) {
  const { packId } = await params;
  const id = Number(packId);
  if (!Number.isFinite(id) || id <= 0) notFound();
  return (
    <Suspense
      fallback={
        <div className="px-6 py-12 text-center text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <FumigationCertificateEditorClient packId={id} />
    </Suspense>
  );
}
