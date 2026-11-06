"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
    { href: "/", label: "Library", match: (pathname: string) => pathname === "/" || pathname.startsWith("/read") },
    { href: "/canvas", label: "Canvas", match: (pathname: string) => pathname.startsWith("/canvas") },
    { href: "/write", label: "Write", match: (pathname: string) => pathname.startsWith("/write") },
];

const base = "rounded-md px-3.5 py-2.5 font-medium";

export function NavLinks() {
    const pathname = usePathname();
    return (
        <nav aria-label="Main" className="flex flex-wrap gap-1">
            {LINKS.map((link) => {
                const active = link.match(pathname);
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className={`${base} ${active ? "bg-foreground text-white" : "text-foreground hover:bg-rule-soft"}`}
                    >
                        {link.label}
                    </Link>
                );
            })}
        </nav>
    );
}
