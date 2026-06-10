"use client";

import { useEffect, useState } from "react";
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
  // Header stays hidden over the hero (which has its own search) and slides in
  // once the user scrolls down, keeping the top of the page clean.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Show the header only once the hero's own search box has scrolled away,
    // so there's never two search bars on screen at once.
    const search = document.getElementById("search");
    if (search) {
      const io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting), {
        threshold: 0,
      });
      io.observe(search);
      return () => io.disconnect();
    }
    // Pages without an on-page search (non-home): reveal after a small scroll.
    const onScroll = () => setShown(window.scrollY > 200);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const visible = shown || menuOpen;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 bg-main text-main-foreground shadow-card transition-transform duration-300",
        visible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="container mx-auto flex items-center gap-3 px-4 py-3 lg:gap-6">
        <Link href="/" aria-label="MegaEvents — דף הבית" className="shrink-0">
          <MYT className="h-8 w-auto md:h-9" />
        </Link>

        {/* Single search entry — links to the on-page search box */}
        <Link
          href="/#search"
          aria-label="חיפוש אירוע"
          className="mx-auto flex h-10 w-full max-w-md items-center gap-2 rounded-full bg-card px-4 text-sm text-muted-foreground transition-shadow hover:shadow-card"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span>חיפוש אירוע</span>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            aria-label={menuOpen ? "סגירת תפריט" : "פתיחת תפריט"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-main-foreground/10"
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Slide-down menu holds navigation + contact for all screen sizes */}
      <div
        className={cn(
          "overflow-hidden border-t border-main-foreground/10 transition-[max-height]",
          menuOpen ? "max-h-96" : "max-h-0 border-t-0"
        )}
      >
        <nav
          aria-label="ניווט"
          className="container mx-auto flex flex-col gap-1 px-4 py-3"
        >
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
          <div className="mt-1 px-3">
            <ContactUs inHeader />
          </div>
        </nav>
      </div>
    </header>
  );
};
