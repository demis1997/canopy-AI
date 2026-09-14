import Link from "next/link";
import { CanopyMark } from "@/components/brand/canopy-mark";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-charcoal text-bone">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <CanopyMark size={28} />
          <span className="text-[13px] font-medium tracking-[0.22em]">CANOPY</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-mist md:flex">
          <span>Product</span>
          <span>Security</span>
          <span>Pricing</span>
        </nav>
        <Button asChild>
          <Link href="/login">Request access</Link>
        </Button>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12 lg:pt-16">
        <div>
          <h1 className="text-5xl font-normal tracking-tight text-bone sm:text-6xl">Cover the inbox.</h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-mist">
            One model. One isolated session. A human still on send. Trained on real agency chats — then
            reviewed before it goes out.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/login">Request access</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/login">See the desk</Link>
            </Button>
          </div>
        </div>

        <DeskPreview />
      </main>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3">
        <Feature
          title="Isolated session"
          body="One model, one voice, one IP. Nothing bleeds across accounts."
        />
        <Feature
          title="Review on send"
          body="Approval stays on until the logs are clean. Pause any live account from the desk."
        />
        <Feature
          title="Desk when you want it"
          body="Chat layer first. Agency login later. Same roof when you leave the other CRM."
        />
      </section>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-950/40 p-5">
      <div className="mb-3 h-px w-8 bg-brass" />
      <h2 className="text-sm font-medium text-bone">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-mist">{body}</p>
    </div>
  );
}

function DeskPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-ink-950 shadow-panel">
      <div className="grid min-h-[380px] grid-cols-[148px_minmax(0,1fr)]">
        <aside className="border-r border-white/[0.06] p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-mist">Models</div>
          <ul className="mt-3 space-y-1 text-sm">
            <li className="flex items-center gap-2 rounded-md bg-pine px-2 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sunfleck" />
              <span>
                Lena Vex
                <span className="block text-[10px] text-mist">Live · OF</span>
              </span>
            </li>
            <li className="flex items-center gap-2 px-2 py-2 text-mist">
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              Model 02
            </li>
            <li className="flex items-center gap-2 px-2 py-2 text-mist">
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              Model 07
            </li>
          </ul>
        </aside>
        <div className="flex flex-col">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <div className="text-sm">
              M. Rodriguez
              <span className="ml-2 text-[11px] text-mist">fan · 14m value</span>
            </div>
            <span className="rounded-sm bg-brass/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brass">
              Approval on
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2 px-4 py-4 text-sm">
            <div className="self-end max-w-[80%] rounded-lg bg-bark px-3 py-2 text-bone/90">
              Can’t stop thinking about last night.
            </div>
            <div className="self-start max-w-[80%] rounded-lg bg-pine px-3 py-2">
              good. stay there — i saved something for you.
            </div>
            <div className="self-start max-w-[70%] rounded-lg border border-brass/40 bg-ink-950 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-brass">PPV · pending review</div>
              <div className="mt-1">Midnight set</div>
              <div className="text-brass">$45</div>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-white/[0.06] p-3">
            <div className="flex-1 rounded-md border border-white/[0.06] px-3 py-2 text-sm text-mist">
              Draft queued for Adi…
            </div>
            <button type="button" className="h-9 rounded-md bg-leaf px-3 text-sm text-bone">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
