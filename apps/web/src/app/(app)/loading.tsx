export default function AppLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-[10px] bg-white/[0.06]" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-xl bg-white/[0.04]" />
        <div className="h-24 rounded-xl bg-white/[0.04]" />
        <div className="h-24 rounded-xl bg-white/[0.04]" />
      </div>
      <div className="h-64 rounded-xl bg-white/[0.04]" />
    </div>
  );
}
