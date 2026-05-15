"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";

import { MYT } from "@/components/ui/myt";
import { ContactUs } from "@/components/ui/ContactUs";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/football", label: "כדורגל" },
  { href: "/artists", label: "אומנים" },
  { href: "/faq", label: "שאלות נפוצות" },
  { href: "/about", label: "אודותינו" },
];

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-main text-main-foreground">
      <div className="container mx-auto flex items-center gap-3 px-4 py-3 lg:gap-6 lg:py-4">
        <Link href="/" aria-label="MegaEvents — דף הבית" className="shrink-0">
          <MYT className="h-8 w-auto md:h-10" />
        </Link>

        <nav
          aria-label="ניווט ראשי"
          className="hidden lg:flex items-center gap-1"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-main-foreground/10"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/"
          aria-label="חיפוש אירוע"
          className="ms-auto hidden h-10 max-w-xs flex-1 items-center gap-2 rounded-full bg-card px-4 text-sm text-muted-foreground transition-shadow hover:shadow-card md:flex"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span>חיפוש אירוע</span>
        </Link>

        <div className="ms-auto flex items-center gap-1 md:ms-0">
          <div className="hidden sm:block">
            <ContactUs inHeader />
          </div>
          <ThemeToggle />
          <button
            type="button"
            aria-label={menuOpen ? "סגירת תפריט" : "פתיחת תפריט"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-main-foreground/10 lg:hidden"
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "lg:hidden overflow-hidden border-t border-main-foreground/10 transition-[max-height]",
          menuOpen ? "max-h-96" : "max-h-0 border-t-0"
        )}
      >
        <nav
          aria-label="ניווט נייד"
          className="container mx-auto flex flex-col gap-1 px-4 py-3"
        >
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold hover:bg-main-foreground/10"
          >
            <Search className="size-4" aria-hidden />
            חיפוש אירוע
          </Link>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-main-foreground/10"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-1 px-3 sm:hidden">
            <ContactUs inHeader />
          </div>
        </nav>
      </div>
    </header>
  );
};
