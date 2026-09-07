"use client";

import { useState } from "react";
import type { AutonomyMode } from "@canopy/shared";

export function EmergencyStopButton({ accountId }: { accountId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/platform/accounts/${accountId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ emergencyStop: true }),
        });
        window.location.reload();
      }}
    >
      Emergency stop
    </button>
  );
}

export function AutonomySelect({ accountId, value }: { accountId: string; value: AutonomyMode }) {
  return (
    <select
      className="rounded-md border border-white/10 bg-ink-900 px-2 py-1 text-sm"
      defaultValue={value}
      onChange={async (event) => {
        await fetch(`/api/platform/accounts/${accountId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ autonomyMode: event.target.value }),
        });
        window.location.reload();
      }}
    >
      <option value="COPILOT">COPILOT — drafts only</option>
      <option value="HYBRID">HYBRID — send when rules pass</option>
      <option value="AUTOPILOT">AUTOPILOT — send eligible text</option>
      <option value="PAUSED">PAUSED</option>
    </select>
  );
}

export function PolicyForm({
  accountId,
  policy,
}: {
  accountId: string;
  policy: {
    minimumConfidence: number;
    maximumPpvPriceCents: number;
    minimumReplyDelaySeconds: number;
    maximumReplyDelaySeconds: number;
    maximumMessagesPerHourPerFan: number;
    welcomeEnabled: boolean;
    followUpsEnabled: boolean;
    ppvEnabled: boolean;
    humanTakeoverMinutes: number;
  };
}) {
  return (
    <form
      className="grid gap-3 text-sm md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        await fetch(`/api/platform/accounts/${accountId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            policy: {
              minimumConfidence: Number(data.get("minimumConfidence")),
              maximumPpvPriceCents: Number(data.get("maximumPpvPriceCents")),
              minimumReplyDelaySeconds: Number(data.get("minimumReplyDelaySeconds")),
              maximumReplyDelaySeconds: Number(data.get("maximumReplyDelaySeconds")),
              maximumMessagesPerHourPerFan: Number(data.get("maximumMessagesPerHourPerFan")),
              welcomeEnabled: data.get("welcomeEnabled") === "on",
              followUpsEnabled: data.get("followUpsEnabled") === "on",
              ppvEnabled: data.get("ppvEnabled") === "on",
              humanTakeoverMinutes: Number(data.get("humanTakeoverMinutes")),
            },
          }),
        });
        window.location.reload();
      }}
    >
      <label>Minimum confidence <input name="minimumConfidence" type="number" step="0.01" defaultValue={policy.minimumConfidence} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1" /></label>
      <label>Max PPV price (cents) <input name="maximumPpvPriceCents" type="number" defaultValue={policy.maximumPpvPriceCents} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1" /></label>
      <label>Min reply delay (s) <input name="minimumReplyDelaySeconds" type="number" defaultValue={policy.minimumReplyDelaySeconds} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1" /></label>
      <label>Max reply delay (s) <input name="maximumReplyDelaySeconds" type="number" defaultValue={policy.maximumReplyDelaySeconds} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1" /></label>
      <label>Per-fan hourly cap <input name="maximumMessagesPerHourPerFan" type="number" defaultValue={policy.maximumMessagesPerHourPerFan} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1" /></label>
      <label>Human takeover (min) <input name="humanTakeoverMinutes" type="number" defaultValue={policy.humanTakeoverMinutes} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1" /></label>
      <label className="flex items-center gap-2"><input type="checkbox" name="ppvEnabled" defaultChecked={policy.ppvEnabled} /> PPV enabled (still requires ONLYFANS_AUTONOMOUS_PPV)</label>
      <label className="flex items-center gap-2"><input type="checkbox" name="welcomeEnabled" defaultChecked={policy.welcomeEnabled} /> Welcome enabled</label>
      <label className="flex items-center gap-2"><input type="checkbox" name="followUpsEnabled" defaultChecked={policy.followUpsEnabled} /> Follow-ups enabled</label>
      <button type="submit" className="rounded-md bg-white/10 px-3 py-2">Save policy</button>
    </form>
  );
}

export function ReviewControls({ actionId }: { actionId: string }) {
  const [text, setText] = useState("");
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Optional edit before approve"
        className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm"
      />
      <button
        type="button"
        className="rounded bg-canopy-500/20 px-3 py-1 text-sm"
        onClick={async () => {
          await fetch(`/api/platform/actions/${actionId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ editedText: text || undefined }),
          });
          window.location.reload();
        }}
      >
        Approve / edit and queue
      </button>
      <button
        type="button"
        className="rounded bg-white/10 px-3 py-1 text-sm"
        onClick={async () => {
          await fetch(`/api/platform/actions/${actionId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ reject: true }),
          });
          window.location.reload();
        }}
      >
        Reject
      </button>
      <button
        type="button"
        className="rounded bg-white/10 px-3 py-1 text-sm"
        onClick={async () => {
          await fetch(`/api/platform/actions/${actionId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ reject: true, returnToAutonomy: true }),
          });
          window.location.reload();
        }}
      >
        Return to autonomy
      </button>
    </div>
  );
}
