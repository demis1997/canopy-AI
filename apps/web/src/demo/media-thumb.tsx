export function MediaThumb({
  kind,
  compact,
}: {
  kind: "PHOTO_SET" | "SHORT_VIDEO" | "VOICE_NOTE" | "FREE_PREVIEW" | "PREMIUM_BUNDLE";
  compact?: boolean;
}) {
  const grads: Record<string, string> = {
    PHOTO_SET: "from-teal-200 via-stone-200 to-cyan-100",
    SHORT_VIDEO: "from-slate-300 via-teal-100 to-stone-200",
    VOICE_NOTE: "from-cyan-100 via-teal-200 to-slate-200",
    FREE_PREVIEW: "from-stone-100 via-teal-50 to-stone-200",
    PREMIUM_BUNDLE: "from-teal-300 via-slate-200 to-cyan-200",
  };
  const labels: Record<string, string> = {
    PHOTO_SET: "Photo set",
    SHORT_VIDEO: "Short video",
    VOICE_NOTE: "Voice note",
    FREE_PREVIEW: "Free preview",
    PREMIUM_BUNDLE: "Premium bundle",
  };
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${grads[kind]} ${
        compact ? "h-16 w-16" : "h-28 w-40"
      }`}
    >
      <div className="absolute inset-0 backdrop-blur-[6px]" />
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 30% 20%, white, transparent 50%)" }} />
      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {labels[kind]}
      </span>
    </div>
  );
}

export function Avatar({
  initials,
  hue,
  online,
  size = 36,
}: {
  initials: string;
  hue: number;
  online?: boolean;
  size?: number;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ background: `hsl(${hue} 42% 42%)` }}
      >
        {initials}
      </div>
      {online != null ? (
        <span
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
            online ? "bg-emerald-500" : "bg-stone-300"
          }`}
        />
      ) : null}
    </div>
  );
}
