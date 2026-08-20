"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, Search, X } from "lucide-react";

import { MYT } from "@/components/ui/myt";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; children?: NavLink[] };

// Always present, whatever the category tree looks like. The creative menu
// spec (2026-08-20) trimmed the bar to: כדורגל | הופעות | יעדים | שאלות
// נפוצות | אודות - קבוצות/אומנים live inside the dropdowns now.
const staticNavLinks: NavLink[] = [
  { href: "/faq", label: "שאלות נפוצות" },
  { href: "/about", label: "אודות" },
];

// Nav-only relabels for category roots whose DB name is too long for the bar
// ("הופעות מוזיקה" → "הופעות"). Keyed by href so a rename in the backoffice
// doesn't silently break the override.
const NAV_LABEL_OVERRIDES: Record<string, string> = {
  "/c/music": "הופעות",
};

// The leagues/genres picker PAGES are gone (they 301 to the hubs) - the
// dropdown's parent items deep-link to the tiles section on the hub instead
// of bouncing through a redirect (Dor 20.8: "באג בליגות - שולח לעמוד כדורגל").
const NAV_HREF_OVERRIDES: Record<string, string> = {
  "/c/football/leagues": "/c/football#hub-tiles-heading",
  "/c/music/genres": "/c/music#hub-tiles-heading",
};

const applyNavOverrides = (link: NavLink): NavLink => ({
  ...link,
  href: NAV_HREF_OVERRIDES[link.href] ?? link.href,
  label: NAV_LABEL_OVERRIDES[link.href] ?? link.label,
  ...(link.children?.length
    ? { children: link.children.map(applyNavOverrides) }
    : {}),
});

// Shared round icon-button styling for the header action cluster.
const iconBtn =
  "inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-main-foreground/10";

// Monochrome WhatsApp glyph (lucide has no brand icon) - inherits currentColor
// so it matches the other header icons.
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

/**
 * @param categories live top-level categories from the backoffice tree, passed
 *   by the root layout. They lead the nav so the structure the team builds is
 *   the structure people navigate; a new root category appears here on its own.
 */
export const Header = ({ categories = [] }: { categories?: NavLink[] }) => {
  const navLinks: NavLink[] = [
    ...categories.map(applyNavOverrides),
    ...staticNavLinks,
  ];
  const [menuOpen, setMenuOpen] = useState(false);
  // Mobile accordion: hrefs of tree nodes whose children are expanded. All
  // collapsed by default so the menu opens short; cleared again on close.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!menuOpen) setExpanded(new Set());
  }, [menuOpen]);
  const toggleBranch = (href: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  const floatingRef = useRef<HTMLDivElement>(null);
  // Shared-element hand-off: when the navbar appears, the floating corner
  // hamburger glides into the navbar's icon pill (and back). Holds the
  // measured translate delta from the corner to its slot in the pill.
  const clusterRef = useRef<HTMLDivElement>(null);
  const flyRightRef = useRef<HTMLDivElement>(null);
  const [fly, setFly] = useState({ rx: 0, ry: 0 });
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  // Inside the order flow the Stepper is the only chrome - hide the global
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
      // Ignore the floating corner layer - the hamburger there OPENS the menu
      // on pointerdown, and this mousedown (same gesture) must not undo it.
      if (
        !headerRef.current?.contains(e.target as Node) &&
        !floatingRef.current?.contains(e.target as Node)
      )
        setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  // The header is always visible. Over a page's own hero (homepage search /
  // detail hero) it goes translucent + blurred so the hero keeps its wow
  // factor; once the hero scrolls away it turns solid bg-main.
  const [overHero, setOverHero] = useState(false);
  // Plain pages (catalog/text) have no overlay hero - reserve a spacer so the
  // fixed header never covers the page's first content.
  const [needsSpacer, setNeedsSpacer] = useState(false);

  useEffect(() => {
    setPageTitle(null); // reset on navigation; the new page re-sets it if any
    // Which pages carry their own top hero the header floats over: the
    // homepage (its search bar) and artist/football detail pages (their
    // DetailHero). Decided by route - not DOM presence - so a slow-loading
    // hero never makes us mistake the page for a plain one.
    const hasOwnHero =
      pathname === "/" ||
      /^\/(artists|football)\/[^/]+$/.test(pathname ?? "") ||
      // Category pages open on a DetailHero too - without this the solid bar
      // sat on top of their hero instead of sliding in behind it.
      /^\/c\//.test(pathname ?? "");

    if (!hasOwnHero) {
      // Plain page (e.g. /football, /artists, /faq): solid header from the
      // top and push content down so the fixed bar never covers it.
      setOverHero(false);
      setNeedsSpacer(true);
      return;
    }

    // Hero page: translucent while the hero is on screen, solid after. The
    // sentinel may mount after this effect (loading skeleton first), so wait
    // for it via rAF before observing.
    setNeedsSpacer(false);
    setOverHero(true);
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
      io = new IntersectionObserver(([e]) => setOverHero(e.isIntersecting), {
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

  // Measure the corner hamburger's flight path into the navbar pill. The
  // pill's final viewport position is derived from layout offsets
  // (transform-independent - the bar itself may be translated off-screen); the
  // corner is measured while it sits at its natural spot.
  useEffect(() => {
    const measure = () => {
      const cluster = clusterRef.current;
      const R = flyRightRef.current;
      const H = headerRef.current;
      if (!cluster || !R || !H) return;
      let cx = 0;
      let cy = 0;
      let el: HTMLElement | null = cluster;
      while (el && el !== H) {
        cx += el.offsetLeft;
        cy += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      }
      const r = R.getBoundingClientRect();
      if (!r.width) return;
      setFly({
        // Hamburger → the pill's RIGHT end (its slot in the bar).
        rx: cx + cluster.offsetWidth - 4 - r.right,
        ry: cy + cluster.offsetHeight / 2 - (r.top + r.height / 2),
      });
    };
    // Only measurable while the corner is at rest at its natural spot.
    if (!(overHero && !menuOpen)) return;
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [overHero, menuOpen, pathname]);

  if (hidden) return null;

  // Over the hero: no bar at all - a floating corner hamburger (Claude-style)
  // in the top-right corner, on every screen size. Opening the menu /
  // scrolling past the hero slides the solid bar in while the corner fades
  // out (both stay mounted so the hand-off animates instead of snapping).
  const showFloating = overHero && !menuOpen;
  // Same dark pill as the navbar cluster - in BOTH themes (the hero is always
  // dark, and the icon lands inside the navbar's dark pill when scrolling).
  const floatBtn =
    "inline-flex size-9 shrink-0 touch-manipulation md:size-11 items-center justify-center rounded-full bg-main text-main-foreground shadow-card ring-1 ring-white/15 transition-colors hover:bg-secondary hover:text-black hover:ring-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  // Flight styling for the corner unit: transform+opacity only
  // (GPU-friendly), interruptible, skipped under reduced-motion.
  const flyCls =
    "transition-[transform,opacity] duration-500 ease-in-out motion-reduce:transition-none";

  return (
    <>
    {needsSpacer && <div aria-hidden className="h-14 md:h-16" />}
    {/* The floating strip is click-transparent - only the corner units accept
        input, so the hero logo underneath (centered, same band) stays
        clickable. */}
    {!needsSpacer && (
      <div
        ref={floatingRef}
        aria-hidden={!showFloating}
        className="pointer-events-none fixed inset-x-0 top-0 z-50"
      >
        <div className="flex items-start justify-between px-3 pt-3 md:px-5 md:pt-4">
          {/* RTL: first child sits in the RIGHT corner - the hamburger. It
              flies into its slot at the pill's right end when the bar shows. */}
          <div
            ref={flyRightRef}
            className={cn(
              flyCls,
              showFloating ? "pointer-events-auto" : "opacity-0"
            )}
            style={
              showFloating
                ? undefined
                : { transform: `translate(${fly.rx}px, ${fly.ry}px) scale(0.85)` }
            }
          >
            <button
              type="button"
              aria-label="פתיחת תפריט"
              aria-expanded={false}
              tabIndex={showFloating ? 0 : -1}
              // pointerdown (not click): reacts on touch-start for zero
              // latency. onClick kept for keyboard activation.
              onPointerDown={() => setMenuOpen(true)}
              onClick={() => setMenuOpen(true)}
              className={floatBtn}
            >
              <Menu className="size-4 md:size-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    )}
    <header
      ref={headerRef}
      className={cn(
        "fixed inset-x-0 top-0 z-50 bg-main text-main-foreground transition-transform duration-500 motion-reduce:transition-none",
        showFloating ? "-translate-y-full" : "translate-y-0"
      )}
    >
      <div className="container relative mx-auto flex items-center gap-2 px-3 py-2.5 md:px-4 md:py-3">
        {/* Action cluster - RTL order (right→left): hamburger (mobile only),
            theme, whatsapp, search. Grouped in a subtle pill so it reads as one
            control, not a loaded row. First DOM child sits on the right in RTL. */}
        <div ref={clusterRef} className="flex shrink-0 items-center gap-0 rounded-full bg-main-foreground/[0.06] px-0.5">
          <button
            type="button"
            aria-label={menuOpen ? "סגירת תפריט" : "פתיחת תפריט"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            // Desktop normally has the inline nav - but when the menu was
            // opened from the hero's floating hamburger, keep the X visible
            // on every size so it can be closed.
            className={cn(iconBtn, !menuOpen && "md:hidden")}
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

        {/* Desktop inline nav - replaces the hamburger on ≥md. Centred like the
            page title; hidden on detail pages where the sticky title takes the
            centre slot instead. */}
        {!pageTitle && !menuOpen && (
          <nav
            aria-label="ניווט"
            className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 md:flex"
          >
            {navLinks.map((link) =>
              link.children?.length ? (
                <div key={link.href} className="relative group">
                  <Link
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
                  <div className="invisible absolute right-0 top-full z-40 max-h-[70vh] min-w-56 overflow-y-auto rounded-xl border border-main-foreground/10 bg-main p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    {link.children.map((child) =>
                      child.children?.length ? (
                        <div key={child.href} className="py-0.5">
                          <Link
                            href={child.href}
                            className="block rounded-lg px-3 py-1.5 text-sm font-bold text-main-foreground hover:bg-main-foreground/10"
                          >
                            {child.label}
                          </Link>
                          <div className="mr-3 flex flex-col border-r border-main-foreground/10 pr-2">
                            {child.children.map((grandchild) => (
                              <Link
                                key={grandchild.href}
                                href={grandchild.href}
                                className="rounded-lg px-3 py-1 text-sm text-main-foreground/80 hover:bg-main-foreground/10"
                              >
                                {grandchild.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block rounded-lg px-3 py-1.5 text-sm font-semibold text-main-foreground/80 hover:bg-main-foreground/10"
                        >
                          {child.label}
                        </Link>
                      )
                    )}
                  </div>
                </div>
              ) : (
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
              )
            )}
          </nav>
        )}

        {/* Desktop: the artist/team name sits centred once the hero scrolls
            away (mobile shows it beside the brand mark instead - see below). */}
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
          <Link href="/" aria-label="MegaEvents - דף הבית" className="shrink-0">
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

      {/* Slide-down menu - all sizes (desktop reaches it via the hero's
          floating hamburger; the inline nav hides while it's open). */}
      <div
        className={cn(
          "overflow-hidden border-t border-main-foreground/10 transition-[max-height]",
          menuOpen ? "max-h-[80vh] overflow-y-auto" : "max-h-0 border-t-0"
        )}
      >
        <nav
          aria-label="ניווט"
          className="container mx-auto flex flex-col gap-0 px-4 py-3"
        >
          {/* Collapsible tree: the label still navigates; the chevron (44px
              target) expands the branch. Everything starts collapsed so the
              menu opens short. Height animates via the grid-rows trick -
              transform-free, no layout jitter. */}
          {navLinks.map((link) => (
            <div key={link.href}>
              {/* Chevron hugs the label (RTL: label right, arrow just to its
                  left) instead of drifting to the far edge of the full-width
                  menu row. */}
              <div className="flex items-center justify-start">
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block min-h-11 content-center rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-main-foreground/10"
                >
                  {link.label}
                </Link>
                {link.children?.length ? (
                  <button
                    type="button"
                    onClick={() => toggleBranch(link.href)}
                    aria-expanded={expanded.has(link.href)}
                    aria-label={`הצג תת-קטגוריות של ${link.label}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-main-foreground/10"
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform duration-200",
                        expanded.has(link.href) && "rotate-180"
                      )}
                      aria-hidden
                    />
                  </button>
                ) : null}
              </div>
              {link.children?.length ? (
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    expanded.has(link.href) ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="mr-3 flex flex-col border-r border-main-foreground/10 pr-2">
                      {link.children.map((child) =>
                        child.children?.length ? (
                          <div key={child.href}>
                            <div className="flex items-center justify-start">
                              <Link
                                href={child.href}
                                onClick={() => setMenuOpen(false)}
                                className="block min-h-11 content-center rounded-lg px-3 py-1.5 text-sm font-bold hover:bg-main-foreground/10"
                              >
                                {child.label}
                              </Link>
                              <button
                                type="button"
                                onClick={() => toggleBranch(child.href)}
                                aria-expanded={expanded.has(child.href)}
                                aria-label={`הצג תת-קטגוריות של ${child.label}`}
                                className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-main-foreground/10"
                              >
                                <ChevronDown
                                  className={cn(
                                    "size-4 transition-transform duration-200",
                                    expanded.has(child.href) && "rotate-180"
                                  )}
                                  aria-hidden
                                />
                              </button>
                            </div>
                            <div
                              className={cn(
                                "grid transition-[grid-template-rows] duration-200 ease-out",
                                expanded.has(child.href)
                                  ? "grid-rows-[1fr]"
                                  : "grid-rows-[0fr]"
                              )}
                            >
                              <div className="overflow-hidden">
                                <div className="mr-3 flex flex-col border-r border-main-foreground/10 pr-2">
                                  {child.children.map((grandchild) => (
                                    <Link
                                      key={grandchild.href}
                                      href={grandchild.href}
                                      onClick={() => setMenuOpen(false)}
                                      className="block min-h-11 content-center rounded-lg px-3 py-1 text-sm text-main-foreground/80 hover:bg-main-foreground/10"
                                    >
                                      {grandchild.label}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setMenuOpen(false)}
                            className="block min-h-11 content-center rounded-lg px-3 py-1.5 text-sm font-semibold text-main-foreground/80 hover:bg-main-foreground/10"
                          >
                            {child.label}
                          </Link>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          {/* Contact - plain inline links (ContactUs positions itself absolutely,
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
