"use client";

import { cn } from "@/lib/utils";

export function SignatureDisplay({ text, imageUrl, className }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt="Signature"
        className={cn("h-12 max-w-[200px] object-contain object-left", className)}
      />
    );
  }
  if (text) {
    return (
      <p className={cn("min-h-[2rem] font-serif text-sm italic text-gray-800", className)}>
        {text}
      </p>
    );
  }
  return <div className={cn("h-8 w-full border-b border-gray-400", className)} aria-hidden />;
}

function SignoffColumn({
  title,
  name,
  idLabel,
  idValue,
  signatureText,
  signatureImageUrl,
  date,
}) {
  return (
    <div className="rounded border border-gray-300 bg-white p-3">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <div className="space-y-3 text-xs">
        <div>
          <p className="font-semibold text-gray-600">Full name</p>
          <p className="mt-0.5 text-gray-900">{name || "—"}</p>
        </div>
        {idLabel && (
          <div>
            <p className="font-semibold text-gray-600">{idLabel}</p>
            <p className="mt-0.5 text-gray-900">{idValue || "—"}</p>
          </div>
        )}
        <div>
          <p className="mb-1 font-semibold text-gray-600">Signature</p>
          <SignatureDisplay text={signatureText} imageUrl={signatureImageUrl} />
        </div>
        <div>
          <p className="font-semibold text-gray-600">Date (dd/mm/yyyy)</p>
          <p className="mt-0.5 text-gray-900">{date || "—"}</p>
        </div>
      </div>
    </div>
  );
}

export function FumigationResultBadge({ result, className }) {
  const label = result ? String(result).toUpperCase() : "—";
  return (
    <p className={cn("text-xs font-semibold text-gray-600", className)}>
      Fumigation result:{" "}
      <span
        className={cn(
          "font-bold",
          result === "pass" ? "text-green-700" : result === "fail" ? "text-red-700" : "text-gray-500",
        )}
      >
        {label}
      </span>
    </p>
  );
}

/** Side-by-side fumigator + authorised officer signoff blocks for certificates. */
export function CertificateSignoffGrid({ model }) {
  return (
    <div className="mt-4 space-y-4">
      <FumigationResultBadge result={model.fumigationResult} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SignoffColumn
          title="Fumigator in charge"
          name={model.fumigatorName}
          idLabel="Fumigator licence number"
          idValue={model.fumigatorLicenceNumber ?? model.fumigatorAccreditationNumber}
          signatureText={model.fumigatorSignature}
          signatureImageUrl={model.fumigatorSignatureImage}
          date={model.issuedDate}
        />
        <SignoffColumn
          title="Authorised officer"
          name={model.governmentOfficerName}
          idLabel="AO licence number"
          idValue={model.governmentOfficerLicenseNumber ?? model.governmentOfficerNumber}
          signatureText={model.governmentOfficerSignature}
          signatureImageUrl={model.governmentOfficerSignatureImage}
          date={model.issuedDate}
        />
      </div>
    </div>
  );
}
