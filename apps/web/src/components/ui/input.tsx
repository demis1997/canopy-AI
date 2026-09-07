import { cn } from "@/lib/utils";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 w-full rounded-md border border-white/10 bg-ink-900 px-3 text-sm outline-none focus:border-canopy-500/60 focus:ring-2 focus:ring-canopy-500/20",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[88px] w-full rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-canopy-500/60 focus:ring-2 focus:ring-canopy-500/20",
        props.className,
      )}
    />
  );
}

export function Label(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={cn("text-xs font-medium text-white/70", props.className)} />;
}
