import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Inter, Newsreader } from "next/font/google";
import { getLearner } from "@/lib/session";
import { signOut } from "./sign-in/actions";
import { NavLinks, NavLinksFallback } from "./nav-links";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Fiche",
  description: "Link ideas from the great books to an unseen question.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans text-sm">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule px-4 py-3.5 sm:px-8">
          <Link href="/" className="font-serif text-2xl font-semibold">
            Fiche
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <Suspense fallback={<NavLinksFallback />}>
              <NavLinks />
            </Suspense>
            {/* Depends on the cookie, so it streams in; the rest of the header is static. */}
            <Suspense>
              <Account />
            </Suspense>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}

async function Account() {
  const learner = await getLearner();
  if (!learner) {
    return (
      <Link href="/sign-in" className="text-muted hover:text-foreground">
        Sign in
      </Link>
    );
  }
  return (
    <form action={signOut} className="flex items-baseline gap-3 text-[13px]">
      <span className="hidden text-muted md:inline">{learner.email}</span>
      <button className="text-muted underline hover:text-foreground">Sign out</button>
    </form>
  );
}
