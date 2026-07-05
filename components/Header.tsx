"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";

import { MYT } from "@/components/ui/myt";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/football", label: "כדורגל" },
  { href: "/artists", label: "אומנים" },
  { href: "/faq", label: "שאלות נפוצות" },
  { href: "/about", label: "אודותינו" },
];

// Shared round icon-button styling for the header action cluster.
const iconBtn =
  "inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-main-foreground/10";

// Monochrome WhatsApp glyph (lucide has no brand icon) — inherits currentColor
// so it matches the other header icons.
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  // Inside the order flow the Stepper is the only chrome — hide the global
  // header so users can't bounce back to the homepage mid-booking.
  const hidden = pathname?.startsWith("/order");

  const isActive = (href: string) =>
    pathname === href || (pathname?.startsWith(href + "/") ?? false);

  // #25: artist/team pages push their name here so it sticks in the header once
  // the hero scrolls away. Detail pages mount <HeaderTitle name=…>.
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  useEffect(() => {
    const onTitle = (e: Event) =>
      setPageTitle((e as CustomEvent<string | null>).detail ?? null);
    window.addEventListener("myt:header-title", onTitle);
    return () => window.removeEventListener("myt:header-title", onTitle);
  }, []);

  // Open the search overlay in place. The homepage handles this in its hero
  // search; every other page has the GlobalSearch modal listen for it. Either
  // way we never navigate the user away just to search.
  const openSearch = () => {
    setMenuOpen(false);
    window.dispatchEvent(new CustomEvent("myt:open-search"));
  };

  // Mobile menu: close on outside click / Escape (the hamburger only exists on
  // mobile, so this covers the only case where the slide-down is open).
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
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
      ref={headerRef}
      className={cn(
        "fixed inset-x-0 top-0 z-50 bg-main text-main-foreground transition-transform duration-300",
        visible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="container relative mx-auto flex items-center gap-2 px-3 py-2.5 md:px-4 md:py-3">
        {/* Action cluster — RTL order (right→left): hamburger (mobile only),
            theme, whatsapp, search. Grouped in a subtle pill so it reads as one
            control, not a loaded row. First DOM child sits on the right in RTL. */}
        <div className="flex shrink-0 items-center gap-0 rounded-full bg-main-foreground/[0.06] px-0.5">
          <button
            type="button"
            aria-label={menuOpen ? "סגירת תפריט" : "פתיחת תפריט"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(iconBtn, "md:hidden")}
          >
            {menuOpen ? (
              <X className="size-[18px]" aria-hidden />
            ) : (
              <Menu className="size-[18px]" aria-hidden />
            )}
          </button>
          <ThemeToggle className="size-9" />
          <a
            href="https://wa.me/972542002722"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className={iconBtn}
          >
            <WhatsAppIcon className="size-[18px]" />
          </a>
          <button
            type="button"
            onClick={openSearch}
            aria-label="חיפוש אירוע"
            className={iconBtn}
          >
            <Search className="size-[18px]" aria-hidden />
          </button>
        </div>

        {/* Desktop inline nav — replaces the hamburger on ≥md. Centred like the
            page title; hidden on detail pages where the sticky title takes the
            centre slot instead. */}
        {!pageTitle && (
          <nav
            aria-label="ניווט"
            className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 md:flex"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-main-foreground/10",
                  isActive(link.href)
                    ? "bg-main-foreground/10 text-main-foreground"
                    : "text-main-foreground/80"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Desktop: the artist/team name sits centred once the hero scrolls
            away (mobile shows it beside the brand mark instead — see below). */}
        {pageTitle && (
          <span className="absolute left-1/2 top-1/2 hidden max-w-[62%] -translate-x-1/2 -translate-y-1/2 truncate text-center text-base font-bold md:block">
            {pageTitle}
          </span>
        )}

        {/* Brand mark + (mobile) page name, pinned to the RTL end (far left).
            On detail pages, mobile shows the compact square "ME" mark with the
            artist/team name right beside it; desktop keeps the full wordmark
            (the name is centred above). Every other page: wordmark only. */}
        <div className="ms-auto flex min-w-0 items-center gap-2">
          {pageTitle && (
            <span className="min-w-0 truncate text-sm font-bold md:hidden">
              {pageTitle}
            </span>
          )}
          <Link href="/" aria-label="MegaEvents — דף הבית" className="shrink-0">
            {pageTitle ? (
              <>
                <Image
                  src="/brand/logo-mark-ME.svg"
                  alt="MegaEvents"
                  width={38}
                  height={38}
                  className="size-8 md:hidden"
                  unoptimized
                />
                <MYT className="hidden w-auto md:block md:h-8" />
              </>
            ) : (
              <MYT className="h-5 w-auto sm:h-6 md:h-8" />
            )}
          </Link>
        </div>
      </div>

      {/* Slide-down menu — mobile only; desktop nav is inline above */}
      <div
        className={cn(
          "overflow-hidden border-t border-main-foreground/10 transition-[max-height] md:hidden",
          menuOpen ? "max-h-96" : "max-h-0 border-t-0"
        )}
      >
        <nav
          aria-label="ניווט"
          className="container mx-auto flex flex-col gap-0 px-4 py-3"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-main-foreground/10"
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
              className="hidden hover:underline md:inline"
            >
              WhatsApp
            </a>
            <a
              href="mailto:reservations@mega-events.co.il"
              className="hidden hover:underline md:inline"
            >
              מייל
            </a>
          </div>
        </nav>
      </div>
    </header>
    </>
  );
};
