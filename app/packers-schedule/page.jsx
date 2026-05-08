import PackersScheduleClient from "./packers-schedule-client";

export default function PackersSchedulePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500">Operations / Packers Schedule</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Packers Schedule</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Execute in-progress packs from Packing Schedule, complete container-level checks, and submit PRA with clear signoff and inspection tracking.
        </p>
      </div>
      <PackersScheduleClient />
    </div>
  );
}
