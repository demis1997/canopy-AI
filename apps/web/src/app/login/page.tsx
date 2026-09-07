"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Suspense } from "react";

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
    <Card className="w-full max-w-md">
      <div className="text-xs uppercase tracking-[0.2em] text-canopy-400">Canopy</div>
      <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-white/50">Agency operators and assigned chatters only.</p>
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
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Signing in…" : "Continue"}
        </Button>
      </form>
      <p className="mt-4 text-xs text-white/40">
        Demo: chatter1@demo.canopy / CanopyDemo!2026 — all seed users share this password.
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
