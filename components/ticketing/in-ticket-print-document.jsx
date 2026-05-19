"use client";

import Link from "next/link";
import Image from "next/image";
import { Printer, FileDown } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GREEN_BG = "bg-[#1a5632]";
const GREEN_TEXT = "text-[#1a5632]";

function toTestCode(name) {
  const raw = String(name || "").trim();
  if (!raw) return "----";
  return raw.replace(/\s+/g, "").slice(0, 4).toUpperCase().padEnd(4, "-");
}

function buildTestSlots(testRows) {
  const used = Array.isArray(testRows) ? testRows.slice(0, 10) : [];
  return used.map((row) => ({
    key: row.name,
    code: toTestCode(row.name),
    value: `${row.value}${row.unit}`,
  }));
}

function TicketCopy({ model }) {
  const addr = model.siteAddress;
  const firstGross = model.grossRows[0];
  const firstTare = model.tareRows[0];
  const testSlots = buildTestSlots(model.testRows);

  return (
    <div className="ticket-print-page break-inside-avoid border border-slate-300 bg-white text-[10px] leading-[1.25]">
      {/* ─── HEADER ─── */}
      <div className="flex items-start gap-2 border-b border-slate-300 px-2.5 py-2">
        <div className="shrink-0">
          <Image
            src="/mahonys-logo.png"
            alt="Mahonys Transport Services"
            width={180}
            height={48}
            className="h-auto w-[150px] object-contain print:w-[140px]"
            priority
          />
        </div>
        <div className="flex-1 text-right text-[9px] leading-tight text-slate-700">
          <p className="font-semibold text-slate-900">{addr.line1}</p>
          <p className="font-semibold text-slate-900">{addr.line2}</p>
          <p>Phone: {addr.phone}</p>
          <p>Email: {addr.email}</p>
          <p>Web: {addr.web}</p>
        </div>
      </div>

      {/* ─── RECEIVAL TICKET + DATE ─── */}
      <div className={cn("flex items-center justify-between px-2.5 py-1", GREEN_BG, "text-white")}>
        <span className="text-[10px] font-bold tracking-wide">Receival Ticket: {model.ticketRef}</span>
        <span className="text-[10px] font-semibold">Date: {model.ticketDate}</span>
      </div>

      {/* ─── MAIN BODY ─── */}
      <div className="flex">
        {/* LEFT: Key fields */}
        <div className="w-[52%] border-r border-slate-300">
          <table className="w-full border-collapse text-[9.5px]">
            <tbody>
              <FieldRow label="Client" value={`${model.customerName}${model.customerCode}`} />
              <FieldRow label="Product" value={model.productDisplay} />
              <FieldRow label="Silo/Bay" value={model.unloadedLocation} />
              <FieldRow label="CMO No" value={model.cmoNo} />
              <FieldRow label="Container No" value={model.containerNo} />
              <FieldRow label="Branch" value={model.branchCode} />
              <FieldRow label="Truck Rego" value={model.truckName} />
            </tbody>
          </table>
        </div>

        {/* RIGHT: Ticket Details + References */}
        <div className="flex-1">
          <div className={cn("px-2 py-1 text-[9px] font-bold uppercase tracking-wide", GREEN_BG, "text-white")}>
            Ticket Details
          </div>
          <table className="w-full border-collapse text-[9.5px]">
            <tbody>
              <FieldRow label={model.customerName} value="" noBorder />
              <FieldRow label="Shrink Account" value={model.shrinkAccount} />
              <FieldRow label="Price" value={model.price} />
              <FieldRow label="Split" value={model.splitAmount} />
            </tbody>
          </table>
          <div className="border-t border-slate-300">
            <table className="w-full border-collapse text-[9.5px]">
              <tbody>
                <FieldRow label="Booking Ref." value={model.bookingRef} />
                <FieldRow label="Ticket Ref." value={model.ticketReference} />
                <FieldRow label="Additional Ref." value={model.additionalReference} />
                <FieldRow label="CMO Ref." value={model.cmoRef} />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── WEIGHTS ─── */}
      <div className="border-t border-slate-300">
        <div className="grid grid-cols-3">
          <WeightBlock
            label="FIRST WEIGHT"
            weight={firstGross?.weightMT || "—"}
            date={firstGross?.date || "—"}
            time={firstGross?.time || ""}
          />
          <WeightBlock
            label="SECOND WEIGHT"
            weight={firstTare?.weightMT || "—"}
            date={firstTare?.date || "—"}
            time={firstTare?.time || ""}
            middle
          />
          <WeightBlock label="NETT WEIGHT" weight={model.netTotalMT} isNet />
        </div>
      </div>

      {/* ─── TEST RESULTS ─── */}
      <div className="border-t border-slate-300">
          <div className={cn("px-2 py-1 text-[9px] font-bold uppercase tracking-wide", GREEN_BG, "text-white")}>
            Test Results
          </div>
          {testSlots.length > 0 ? (
            <div className="grid grid-cols-5 border-t border-slate-300">
              {testSlots.map((slot, index) => (
              <div
                key={slot.key}
                className={cn(
                  "border-r border-slate-300 px-1 py-1 text-center",
                  index % 5 === 4 && "border-r-0",
                  index >= 5 && "border-t border-slate-300"
                )}
              >
                <div className="text-[8px] font-bold uppercase text-slate-600">{slot.code}</div>
                <div className="text-[9.5px] font-semibold text-slate-900">{slot.value}</div>
              </div>
              ))}
            </div>
          ) : (
            <div className="border-t border-slate-300 px-2 py-1 text-[9px] text-slate-500">No test results</div>
          )}
          <div className="flex items-center justify-end border-t border-slate-300 px-2 py-0.5">
            <span className="text-[9px] font-semibold text-slate-700">UM</span>
            <span className="ml-2 text-[10px] font-bold text-slate-900">{model.um}</span>
          </div>
        </div>

      {/* ─── SIGNATURES ─── */}
      <div className="border-t border-slate-300 px-2.5 py-1.5">
        <div className="flex gap-4">
          <div className="flex-1">
            <span className="text-[9px] font-semibold text-slate-700">WeighBridge Operator:</span>
            <div className="mt-2 border-b border-slate-400" />
            {model.signoff !== "—" ? (
              <p className="mt-0.5 text-[9px] italic text-slate-500">{model.signoff}</p>
            ) : null}
          </div>
          <div className="flex-1">
            <span className="text-[9px] font-semibold text-slate-700">Carrier/Grower Signature:</span>
            <div className="mt-2 border-b border-slate-400" />
          </div>
        </div>
      </div>

      {/* ─── DISCLAIMER ─── */}
      <div className="border-t border-slate-300 px-2.5 py-1">
        <p className="text-[7.5px] leading-snug text-slate-500">
          Disclaimer: By signing this weighbridge ticket the driver/carrier acknowledges their responsibility for
          complying with all Chain of Responsibility (CoR) provisions set by the NHVL. Compliance breaches are not
          tolerated and must be reported and rectified immediately.
        </p>
      </div>
    </div>
  );
}

function FieldRow({ label, value, noBorder }) {
  return (
    <tr className={noBorder ? "" : "border-b border-slate-200"}>
      <td className="w-[38%] px-2 py-[2px] text-[9px] font-semibold text-slate-600">{label}</td>
      <td className="px-2 py-[2px] text-[9px] font-medium text-slate-900">{value}</td>
    </tr>
  );
}

function WeightBlock({ label, weight, date, time, isNet, middle }) {
  return (
    <div
      className={cn(
        "px-2 py-2 text-center",
        middle && "border-x border-slate-300",
        isNet && cn(GREEN_BG, "text-white")
      )}
    >
      <div className={cn("text-[9px] font-bold uppercase tracking-wide", isNet ? "text-white/80" : "text-slate-600")}>
        {label}
      </div>
      <div className={cn("mt-0.5 text-[12px] font-extrabold leading-tight", isNet ? "text-white" : GREEN_TEXT)}>
        {weight}
      </div>
      {date && !isNet ? (
        <div className="mt-0.5 text-[8px] text-slate-500">
          Date: {date}{time ? ` Time: ${time}` : ""}
        </div>
      ) : null}
    </div>
  );
}

export default function InTicketPrintDocument({ model, backHref }) {
  if (!model) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-slate-600">Ticket not found.</p>
        <Link href="/ticketing" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex")}>
          Back to ticketing
        </Link>
      </div>
    );
  }

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <>
      {/* ─── TOOLBAR (hidden when printing) ─── */}
      <div className="ticket-print-toolbar sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 px-4 py-3 backdrop-blur-sm print:hidden">
        <div className="mx-auto flex max-w-[48rem] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#0f1e3d]">Print preview — Receival Ticket {model.ticketRef}</p>
            <p className="text-xs text-slate-500">Use Print for paper, or Save as PDF in the print dialog.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handlePrint}>
              <Printer className="size-3.5" aria-hidden />
              Print
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={handlePrint} title="Opens print dialog — choose Save as PDF">
              <FileDown className="size-3.5" aria-hidden />
              Save as PDF
            </Button>
            <Link href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Back to ticket
            </Link>
          </div>
        </div>
      </div>

      <div className="ticket-print-document ticket-print-document-two-copies mx-auto max-w-[48rem] bg-white px-6 py-6 print:max-w-none print:px-0 print:py-0">
        <TicketCopy model={model} />
        <TicketCopy model={model} />
      </div>
    </>
  );
}
