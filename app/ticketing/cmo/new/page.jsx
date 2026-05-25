import { Suspense } from "react";

import CmoForm from "./cmo-form";

export default function NewCmoPage() {
  return (
    <Suspense fallback={<div className="px-5 py-10 text-sm text-slate-500">Loading…</div>}>
      <CmoForm />
    </Suspense>
  );
}
