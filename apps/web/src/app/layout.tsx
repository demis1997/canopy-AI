import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Canopy",
  description: "Cover the inbox. One model. One isolated session. A human still on send.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="canopy-grid font-sans antialiased text-bone">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
