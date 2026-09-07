import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6">
      <div className="mb-3 text-xs uppercase tracking-[0.2em] text-canopy-400">Canopy</div>
      <h1 className="text-4xl font-semibold tracking-tight">Chat with four demo models.</h1>
      <p className="mt-4 max-w-xl text-white/60">
        You play the fan. Each model replies in her own voice and sells her catalog at list price
        first. Run this from the repo root, then sign in.
      </p>
      <pre className="mt-6 overflow-x-auto rounded-xl border border-white/10 bg-ink-900 p-4 text-sm text-canopy-100">
        {`docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev`}
      </pre>
      <p className="mt-3 text-sm text-white/45">
        Then open{" "}
        <a className="text-canopy-300" href="http://localhost:3000">
          http://localhost:3000
        </a>
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/login">Sign in to dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/demo/conversations">Demo inbox</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/demo">Extension adapter</Link>
        </Button>
      </div>
      <p className="mt-8 text-xs text-white/40">
        Demo login: chatter1@demo.canopy / CanopyDemo!2026
      </p>
    </div>
  );
}
