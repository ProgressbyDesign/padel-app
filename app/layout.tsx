import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";
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
        <AppHeader />
        <main className="flex-1">{children}</main>
        <AppFooter />
      </body>
    </html>
  );
}
