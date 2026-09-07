import Link from "next/link";

export function DemoChrome({ active }: { active: "conversations" | "products" | "welcome" }) {
  const item = (href: string, id: typeof active, label: string) => (
    <Link
      href={href}
      className={`rounded-md px-2 py-1 ${active === id ? "bg-teal-50 text-teal-800" : "text-slate-500 hover:bg-slate-100"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-500 text-xs font-bold text-white">C</div>
        <span className="text-sm font-semibold tracking-tight">Canopy</span>
        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-teal-200">
          Demo environment
        </span>
      </div>
      <nav className="flex items-center gap-1 text-xs">
        {item("/demo/conversations", "conversations", "Inbox")}
        {item("/demo/products", "products", "Products")}
        {item("/demo/automations/welcome-message", "welcome", "Welcome")}
        <Link className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" href="/demo">
          Extension adapter
        </Link>
        <Link className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" href="/login">
          Sign in
        </Link>
      </nav>
    </header>
  );
}
