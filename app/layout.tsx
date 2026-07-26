import type { Metadata } from "next";
import { Geist_Mono, Sora } from "next/font/google";
import SiteChrome from "../components/SiteChrome";
import { loadOptionalAccountNavContext } from "../lib/workspace/resolve";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" className={`${sora.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-surface text-primary">
        <SiteChrome accountNav={accountNav}>{children}</SiteChrome>
      </body>
    </html>
  );
}
