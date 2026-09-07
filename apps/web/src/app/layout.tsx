import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Canopy",
  description: "Human-in-the-loop sales copilot for adult-content chatters and agencies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="canopy-grid antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
