import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import SiteChrome from "../components/SiteChrome";
import { loadOptionalAccountNavContext } from "../lib/workspace/resolve";
import "./globals.css";

const authein = localFont({
  src: "../public/fonts/Authein-Adjusted-50pct.woff2",
  variable: "--font-authein",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Padel Pathways — Find venues abroad",
    template: "%s | Padel Pathways",
  },
  description: "Discover curated padel venues, coaching, and high-quality courts worldwide.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const accountNav = await loadOptionalAccountNavContext();

  return (
    <html lang="en" className={`${authein.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-surface text-primary">
        <SiteChrome accountNav={accountNav}>{children}</SiteChrome>
      </body>
    </html>
  );
}
