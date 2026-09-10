"use client";

import { useMemo, useState } from "react";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  type: string;
  isDemo: boolean;
  seatLimit: number;
  memberCount: number;
  generationCount: number;
  lastActivity: string | null;
};

export function AdminOrgTable({ orgs }: { orgs: OrgRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [open, setOpen] = useState<OrgRow | null>(null);
  const filtered = useMemo(
    () =>
      orgs.filter((o) => {
        const hit = `${o.name} ${o.slug}`.toLowerCase().includes(q.toLowerCase());
        return hit && (status === "ALL" || o.status === status);
      }),
    [orgs, q, status],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organizations" className="max-w-xs" />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-[10px] border border-white/10 bg-ink-900 px-2 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="DELETED">DELETED</option>
        </select>
      </div>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-white/40">
            <tr>
              <th className="px-4 py-3">Organization</th>
              <th>Status</th>
              <th>Plan / seats</th>
              <th>Usage</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr
                key={o.id}
                className="cursor-pointer border-t border-white/[0.06] hover:bg-white/[0.03]"
                onClick={() => setOpen(o)}
              >
                <td className="px-4 py-3">
                  {o.name} {o.isDemo ? <Badge tone="warn">DEMO</Badge> : null}
                  <div className="text-[11px] text-white/35">{o.slug}</div>
                </td>
                <td>{o.status}</td>
                <td>
                  {o.type} · {o.seatLimit} seats
                </td>
                <td>
                  {o.memberCount} members · {o.generationCount} gens
                </td>
                <td className="text-white/50">{o.lastActivity ? new Date(o.lastActivity).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {open ? (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{open.name}</div>
            <button className="text-xs text-white/40" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>Slug: {open.slug}</div>
            <div>Status: {open.status}</div>
            <div>Type: {open.type}</div>
            <div>Seats: {open.seatLimit}</div>
            <div>Members: {open.memberCount}</div>
            <div>Generations: {open.generationCount}</div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
