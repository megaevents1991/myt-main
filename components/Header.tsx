"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  // Open the search modal directly. On the homepage the open-search event is
  // handled in place; elsewhere we route home and request it via the URL.
  const openSearch = () => {
    setMenuOpen(false);
    if (typeof document !== "undefined" && document.getElementById("search")) {
      window.dispatchEvent(new CustomEvent("myt:open-search"));
    } else {
      router.push("/?search=open");
    }
  };
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
      <div className="container mx-auto flex items-center gap-2 px-3 py-2.5 md:gap-4 md:px-4 md:py-3">
        <Link href="/" aria-label="MegaEvents — דף הבית" className="shrink-0">
          <MYT className="h-5 w-auto sm:h-6 md:h-8" />
        </Link>

        {/* Search — opens the search modal directly */}
        <button
          type="button"
          onClick={openSearch}
          aria-label="חיפוש אירוע"
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-card px-3 text-sm text-muted-foreground transition-shadow hover:shadow-card md:h-10 md:max-w-md md:px-4"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="truncate">חיפוש אירוע</span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 md:gap-1">
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
