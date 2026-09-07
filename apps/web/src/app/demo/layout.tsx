import type { ReactNode } from "react";
import { DemoTheme } from "@/demo/theme";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="demo-root min-h-screen bg-[#f3f5f7] text-slate-800">
      <DemoTheme />
      {children}
    </div>
  );
}
