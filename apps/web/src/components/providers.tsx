"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

const Provider = SessionProvider as unknown as (props: { children: ReactNode }) => ReactNode;

export function Providers({ children }: { children: ReactNode }) {
  return <Provider>{children}</Provider>;
}
