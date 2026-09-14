import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Canopy",
  description: "Cover the inbox. One model. One isolated session. A human still on send.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="canopy-grid font-sans antialiased text-bone">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
