"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

const inputClass =
  "rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

const USERS = [
  { id: 1, name: "Alec Stead", email: "ops@packing.local", role: "Administrator", active: true },
  { id: 2, name: "Jordan Miles", email: "warehouse@packing.local", role: "Warehouse", active: true },
  { id: 3, name: "Sam Rivera", email: "finance@packing.local", role: "Read only", active: false },
];

export default function ContactClient() {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState(true);

  const filtered = useMemo(() => {
    if (!search.trim()) return USERS;
    const q = search.toLowerCase();
    return USERS.filter((u) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-slate-600">
        User grid and editor patterned after Mahonys <span className="font-mono text-xs text-slate-500">users.js</span>-name, email, role, and
        active flag; extend with permission matrices when authentication is connected.
      </p>

      <section className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Add or edit user</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase text-slate-500">Name</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase text-slate-500">Email</label>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase text-slate-500">Role</label>
            <input className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Administrator, Warehouse..." />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pt-6 text-sm text-slate-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-slate-300" />
            Active
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="button">Save user</Button>
          <Button type="button" variant="outline">
            Reset
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <input className={`${inputClass} max-w-md`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." />
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                {["Name", "Email", "Role", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-semibold text-slate-900">{u.name}</td>
                  <td className="px-3 py-2 text-slate-600">{u.email}</td>
                  <td className="px-3 py-2 text-slate-700">{u.role}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                        u.active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-red-50 text-red-800 ring-red-200"
                      }`}
                    >
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
