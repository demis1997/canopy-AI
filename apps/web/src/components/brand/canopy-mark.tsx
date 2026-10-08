export function CanopyMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M48.5 15.2a24 24 0 1 0 0 33.6"
        stroke="#2F3D34"
        strokeWidth="7.2"
        strokeLinecap="round"
      />
      <path
        d="M45.2 19.4a17.6 17.6 0 1 0 0 25.2"
        stroke="#4E5F50"
        strokeWidth="7.2"
        strokeLinecap="round"
      />
      <path
        d="M41.8 23.6a11.2 11.2 0 1 0 0 16.8"
        stroke="#C4A056"
        strokeWidth="7.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CanopyWordmark({ className }: { className?: string }) {
  return <span className={className ?? "font-medium tracking-[0.18em] text-bone"}>CANOPY</span>;
}
