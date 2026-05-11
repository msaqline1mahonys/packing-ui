import Link from "next/link";

const cards = [
  { title: "Packing schedule", href: "/packing-schedule", detail: "Run waves, cut-offs, carriers" },
  { title: "Packers schedule", href: "/packers-schedule", detail: "Shifts & station coverage" },
  { title: "Ticketing", href: "/ticketing", detail: "Incidents & resolution trail" },
  { title: "Packing", href: "/packing", detail: "Packing details" },
  { title: "Transactions", href: "/transactions", detail: "Legs, status, reconciliation" },
  { title: "Fumigation", href: "/fumigation", detail: "Lots, compliance, completions" },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-brand">Clutch.</p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Operational overview
        </h1>
        <p className="max-w-2xl text-pretty text-slate-600">
          Light operations shell using Clutch electric blue—rail stays calm, then expands on hover or keyboard
          focus inside the sidebar.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group cursor-pointer rounded-2xl border border-slate-200/95 bg-white/90 p-5 shadow-[0_24px_50px_-32px_rgba(0,112,255,0.22)] backdrop-blur-sm transition-colors hover:border-brand/40 hover:bg-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-slate-900">{card.title}</h2>
                <p className="mt-2 text-sm text-slate-500 transition-colors group-hover:text-slate-700">
                  {card.detail}
                </p>
              </div>
              <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-brand-ink">
                open
              </span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
