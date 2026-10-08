import { NextResponse } from "next/server";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";
import { loadOrgMetrics, parseWindow } from "@/lib/org-metrics";

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "analytics.view");
    const url = new URL(request.url);
    const metrics = await loadOrgMetrics(
      ctx.tenant.organizationId,
      parseWindow({
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
        creator: url.searchParams.get("creator") ?? undefined,
        chatter: url.searchParams.get("chatter") ?? undefined,
      }),
    );
    const rows = [
      ["metric", "value"],
      ["revenue_cents", String(metrics.revenueCents)],
      ["unlocks", String(metrics.unlocks)],
      ["offers", String(metrics.offers)],
      ["conversations", String(metrics.conversations)],
      ["conversion_pct", metrics.conversion.toFixed(2)],
      ["ai_acceptance_pct", metrics.acceptance.toFixed(2)],
      ["ai_edit_pct", metrics.editRate.toFixed(2)],
      ["avg_latency_ms", String(Math.round(metrics.avgLatencyMs))],
      ["escalation_rate_pct", metrics.escalationRate.toFixed(2)],
      ...metrics.series.flatMap((row) => [
        [`day_${row.day}_revenue`, String(row.revenue)],
        [`day_${row.day}_offers`, String(row.offers)],
        [`day_${row.day}_gens`, String(row.gens)],
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="canopy-analytics.csv"',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
