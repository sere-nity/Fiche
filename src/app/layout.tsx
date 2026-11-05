import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Fiche",
  description: "Link ideas from the great books to an unseen question.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-rule">
          <nav className="mx-auto flex max-w-5xl items-baseline gap-6 px-4 py-4 sm:px-6">
            <Link href="/" className="font-serif text-2xl italic tracking-tight">
              Fiche
            </Link>
            <Link href="/" className="text-sm text-muted hover:text-foreground">
              Library
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
