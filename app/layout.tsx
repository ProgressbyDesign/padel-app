import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import SiteChrome from "../components/SiteChrome";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Padel — Find venues abroad",
    template: "%s | Padel",
  },
  description: "Discover curated padel venues, coaching, and high-quality courts worldwide.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-surface text-primary">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
