"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";

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
  const pathname = usePathname();
  // Inside the order flow the Stepper is the only chrome — hide the global
  // header so users can't bounce back to the homepage mid-booking.
  const hidden = pathname?.startsWith("/order");

  // #25: artist/team pages push their name here so it sticks in the header once
  // the hero scrolls away. Detail pages mount <HeaderTitle name=…>.
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  useEffect(() => {
    const onTitle = (e: Event) =>
      setPageTitle((e as CustomEvent<string | null>).detail ?? null);
    window.addEventListener("myt:header-title", onTitle);
    return () => window.removeEventListener("myt:header-title", onTitle);
  }, []);

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
  // Header stays hidden over a page's own hero (homepage search / detail hero)
  // and slides in once the user scrolls past it, keeping the top clean. On
  // pages with no such hero it's visible from the top so nav is always there.
  const [shown, setShown] = useState(false);
  // Plain pages (catalog/text) have no overlay hero — reserve a spacer so the
  // fixed header never covers the page's first content.
  const [needsSpacer, setNeedsSpacer] = useState(false);

  useEffect(() => {
    setPageTitle(null); // reset on navigation; the new page re-sets it if any
    // Which pages carry their own top hero that the header should defer to:
    // the homepage (its search bar) and artist/football detail pages (their
    // DetailHero). Decided by route — not DOM presence — so a slow-loading
    // hero never makes us mistake the page for a plain one.
    const hasOwnHero =
      pathname === "/" || /^\/(artists|football)\/[^/]+$/.test(pathname ?? "");

    if (!hasOwnHero) {
      // Plain page (e.g. /football, /artists, /faq): keep nav available from
      // the top and push content down so the fixed bar never covers it.
      setShown(true);
      setNeedsSpacer(true);
      return;
    }

    // Hero page: reveal the header only once that hero scrolls away, so the
    // two never overlap. The sentinel may mount after this effect (loading
    // skeleton first), so wait for it via rAF before observing.
    setNeedsSpacer(false);
    let raf = 0;
    let io: IntersectionObserver | null = null;
    const attach = () => {
      const sentinel =
        document.getElementById("search") ||
        document.getElementById("detail-hero");
      if (!sentinel) {
        raf = requestAnimationFrame(attach);
        return;
      }
      io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting), {
        threshold: 0,
      });
      io.observe(sentinel);
    };
    attach();
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [pathname]);

  const visible = shown || menuOpen;

  if (hidden) return null;

  return (
    <>
    {needsSpacer && <div aria-hidden className="h-14 md:h-16" />}
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 bg-main text-main-foreground shadow-card transition-transform duration-300",
        visible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="container relative mx-auto flex items-center gap-2 px-3 py-2.5 md:gap-4 md:px-4 md:py-3">
        <Link href="/" aria-label="MegaEvents — דף הבית" className="shrink-0">
          <Image
            src="/brand/logo-mark-ME.svg"
            alt="MegaEvents"
            width={36}
            height={36}
            priority
            className="size-8 rounded-lg md:size-9"
          />
        </Link>

        {pageTitle ? (
          // On artist/team pages the artist name takes the bar once scrolled.
          <span className="min-w-0 flex-1 truncate text-center text-base font-bold md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
            {pageTitle}
          </span>
        ) : (
          /* Search — opens the search modal directly. Page-centered on desktop. */
          <button
            type="button"
            onClick={openSearch}
            aria-label="חיפוש אירוע"
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-card px-3 text-sm text-muted-foreground transition-shadow hover:shadow-card md:absolute md:left-1/2 md:top-1/2 md:h-10 md:w-full md:max-w-md md:flex-none md:-translate-x-1/2 md:-translate-y-1/2 md:px-4"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate">חיפוש אירוע</span>
          </button>
        )}

        <div className="ms-auto flex shrink-0 items-center gap-0.5 md:gap-1">
          {pageTitle && (
            <button
              type="button"
              onClick={openSearch}
              aria-label="חיפוש אירוע"
              className="inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-main-foreground/10"
            >
              <Search className="size-5" aria-hidden />
            </button>
          )}
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
          {/* Contact — plain inline links (ContactUs positions itself absolutely,
              which overlapped the header bar on mobile) */}
          <div className="mt-1 flex items-center gap-4 border-t border-main-foreground/10 px-3 pt-3 text-sm font-semibold">
            <a href="tel:+97237684800" className="hover:underline">
              03-768-4800 דברו איתנו
            </a>
            <a
              href="https://wa.me/972542002722"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              WhatsApp
            </a>
            <a href="mailto:reservations@mega-events.co.il" className="hover:underline">
              מייל
            </a>
          </div>
        </nav>
      </div>
    </header>
    </>
  );
};
