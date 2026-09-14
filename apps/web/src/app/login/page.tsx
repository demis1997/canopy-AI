"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Suspense } from "react";
import { CanopyMark } from "@/components/brand/canopy-mark";
import Link from "next/link";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("chatter1@demo.canopy");
  const [password, setPassword] = useState("CanopyDemo!2026");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: params.get("next") || "/dashboard",
    });
    if (res?.error) {
      setError("Invalid email or password.");
      setPending(false);
      return;
    }
    window.location.href = params.get("next") || "/dashboard";
  }

  return (
    <Card className="w-full max-w-md bg-ink-950">
      <Link href="/" className="flex items-center gap-2">
        <CanopyMark size={28} />
        <span className="text-[12px] font-medium tracking-[0.22em] text-bone">CANOPY</span>
      </Link>
      <h1 className="mt-4 text-2xl font-normal tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-mist">Agency operators and assigned chatters only.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>
        {error ? <p className="text-sm text-clay">{error}</p> : null}
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Signing in…" : "Continue"}
        </Button>
      </form>
      <p className="mt-4 text-xs text-mist">
        Demo: chatter1@demo.canopy / CanopyDemo!2026 — all seed users share this password.
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
