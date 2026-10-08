import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-ink-950/80 p-5 shadow-panel",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
}) {
  const tones = {
    neutral: "bg-white/8 text-white/80",
    good: "bg-leaf/15 text-leaf",
    warn: "bg-brass/15 text-brass",
    bad: "bg-clay/15 text-clay",
    accent: "bg-brass/20 text-brass",
  };
  return (
    <span
      className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone])}
    >
      {children}
    </span>
  );
}
