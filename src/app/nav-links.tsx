"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Write joins this list in milestone 3.
const LINKS = [
  { href: "/", label: "Library", match: (p: string) => p === "/" || p.startsWith("/read") },
  { href: "/canvas", label: "Canvas", match: (p: string) => p.startsWith("/canvas") },
];

const base = "rounded-md px-3.5 py-2.5 font-medium";

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-1">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`${base} ${active ? "bg-foreground text-white" : "text-foreground hover:bg-rule-soft"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Same links, none marked active: shown while the pathname isn't known yet. */
export function NavLinksFallback() {
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-1">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={`${base} text-foreground`}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
