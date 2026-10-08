import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AccessDenied({
  title = "You don’t have access to this page",
  description = "Ask an agency owner or manager if you need this workspace.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card className="mx-auto max-w-lg space-y-4 p-8">
      <p className="text-xs uppercase tracking-[0.16em] text-amber-300">Access denied</p>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-white/55">{description}</p>
      <Button asChild variant="secondary">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </Card>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-canopy-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-white/50">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-white/45">{body}</p>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <>
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-white/40">{hint}</div> : null}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        className="block rounded-xl border border-white/[0.06] bg-ink-800/80 p-4 transition hover:border-canopy-500/30 hover:bg-ink-800"
      >
        {inner}
      </a>
    );
  }
  return <div className="rounded-xl border border-white/[0.06] bg-ink-800/80 p-4">{inner}</div>;
}
