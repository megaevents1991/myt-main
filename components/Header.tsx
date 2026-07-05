"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Ellipsis, Menu, Search, X } from "lucide-react";

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
  // Hero floating corner: the single left-corner button fans out to the
  // theme/whatsapp/search icons while this is true.
  const [cornerOpen, setCornerOpen] = useState(false);
  const cornerRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  // The fan's real source of truth is a CSS checkbox (works pre-hydration);
  // closing programmatically must clear BOTH the box and the mirrored state.
  const fanCheckRef = useRef<HTMLInputElement>(null);
  const closeFan = () => {
    if (fanCheckRef.current) fanCheckRef.current.checked = false;
    setCornerOpen(false);
  };
  // Shared-element hand-off: when the navbar appears, the two floating corner
  // units glide into the navbar's icon pill (and back). These hold the
  // measured translate deltas from each corner to its slot in the pill.
  const clusterRef = useRef<HTMLDivElement>(null);
  const flyLeftRef = useRef<HTMLDivElement>(null);
  const flyRightRef = useRef<HTMLDivElement>(null);
  const [fly, setFly] = useState({ lx: 0, ly: 0, rx: 0, ry: 0 });
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

  // Fan-out corner: close on outside click / Escape.
  useEffect(() => {
    if (!cornerOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!cornerRef.current?.contains(e.target as Node)) closeFan();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeFan();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [cornerOpen]);

  // Mobile menu: close on outside click / Escape (the hamburger only exists on
  // mobile, so this covers the only case where the slide-down is open).
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      // Ignore the floating corner layer — the hamburger there OPENS the menu
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
  // Plain pages (catalog/text) have no overlay hero — reserve a spacer so the
  // fixed header never covers the page's first content.
  const [needsSpacer, setNeedsSpacer] = useState(false);

  useEffect(() => {
    setPageTitle(null); // reset on navigation; the new page re-sets it if any
    // Which pages carry their own top hero the header floats over: the
    // homepage (its search bar) and artist/football detail pages (their
    // DetailHero). Decided by route — not DOM presence — so a slow-loading
    // hero never makes us mistake the page for a plain one.
    const hasOwnHero =
      pathname === "/" || /^\/(artists|football)\/[^/]+$/.test(pathname ?? "");

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

  // Measure the corners' flight paths into the navbar pill. The pill's final
  // viewport position is derived from layout offsets (transform-independent —
  // the bar itself may be translated off-screen); the corners are measured
  // while they sit at their natural spots.
  useEffect(() => {
    const measure = () => {
      const cluster = clusterRef.current;
      const L = flyLeftRef.current;
      const R = flyRightRef.current;
      const H = headerRef.current;
      if (!cluster || !L || !R || !H) return;
      let cx = 0;
      let cy = 0;
      let el: HTMLElement | null = cluster;
      while (el && el !== H) {
        cx += el.offsetLeft;
        cy += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      }
      const l = L.getBoundingClientRect();
      const r = R.getBoundingClientRect();
      if (!l.width || !r.width) return;
      setFly({
        // Left unit → the pill's LEFT end (where search/theme/whatsapp live in RTL).
        lx: cx + 4 - l.left,
        ly: cy + cluster.offsetHeight / 2 - (l.top + l.height / 2),
        // Hamburger → the pill's RIGHT end (its slot in the bar).
        rx: cx + cluster.offsetWidth - 4 - r.right,
        ry: cy + cluster.offsetHeight / 2 - (r.top + r.height / 2),
      });
    };
    // Only measurable while the corners are at rest at their natural spots.
    if (!(overHero && !menuOpen)) return;
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [overHero, menuOpen, pathname]);

  // Leaving the hero folds the fan-out closed.
  useEffect(() => {
    if (!overHero) closeFan();
  }, [overHero]);

  if (hidden) return null;

  // Over the hero: no bar at all — floating corner controls (Claude-style).
  // Hamburger in the top-right corner, theme/whatsapp/search in the top-left,
  // on every screen size. Opening the menu / scrolling past the hero slides
  // the solid bar in while the corners fade out (both stay mounted so the
  // hand-off animates instead of snapping).
  const showFloating = overHero && !menuOpen;
  // Same dark pill as the navbar cluster — in BOTH themes (the hero is always
  // dark, and the icons land inside the navbar's dark pill when scrolling).
  const floatBtn =
    "inline-flex size-9 shrink-0 touch-manipulation md:size-11 items-center justify-center rounded-full bg-main text-main-foreground shadow-card ring-1 ring-white/15 transition-colors hover:bg-secondary hover:text-black hover:ring-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  // Flight styling shared by the two corner units: transform+opacity only
  // (GPU-friendly), interruptible, skipped under reduced-motion.
  const flyCls =
    "transition-[transform,opacity] duration-500 ease-in-out motion-reduce:transition-none";
  const cornerActive = showFloating && cornerOpen;

  return (
    <>
    {needsSpacer && <div aria-hidden className="h-14 md:h-16" />}
    {!needsSpacer && (
      <div
        ref={floatingRef}
        aria-hidden={!showFloating}
        className={cn(
          "fixed inset-x-0 top-0 z-50",
          !showFloating && "pointer-events-none"
        )}
      >
        <div className="flex items-start justify-between px-3 pt-3 md:px-5 md:pt-4">
          {/* RTL: first child sits in the RIGHT corner — the hamburger. It
              flies into its slot at the pill's right end when the bar shows. */}
          <div
            ref={flyRightRef}
            className={cn(flyCls, !showFloating && "opacity-0")}
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
              // pointerdown (not click): reacts on touch-start, so a tap while
              // the left fan is open can't get lost in the fan's outside-close
              // re-render. onClick kept for keyboard activation.
              onPointerDown={() => {
                setCornerOpen(false);
                setMenuOpen(true);
              }}
              onClick={() => setMenuOpen(true)}
              className={floatBtn}
            >
              <Menu className="size-4 md:size-5" aria-hidden />
            </button>
          </div>
          {/* LEFT corner: one button that fans out to theme / whatsapp / search.
              Fan-out sits BEFORE the toggle in DOM (= its right in RTL), so the
              toggle stays pinned in the corner and the icons expand toward the
              center. Collapsed, the fan-out takes no width. The whole unit
              flies into the pill's left end when the bar shows. */}
          <div
            ref={flyLeftRef}
            className={cn(flyCls, !showFloating && "opacity-0")}
            style={
              showFloating
                ? undefined
                : { transform: `translate(${fly.lx}px, ${fly.ly}px) scale(0.85)` }
            }
          >
          {/* Fan toggle is a PURE-CSS checkbox (peer) — it opens the instant
              the page paints, BEFORE React hydrates (on phones hydration takes
              seconds and a JS-driven toggle feels dead until then). React only
              mirrors the state (onChange) for outside-click/scroll close.
              Animation is transform+opacity only — GPU, no reflow. */}
          <div ref={cornerRef} className="relative">
            <input
              ref={fanCheckRef}
              type="checkbox"
              id="hero-quick-actions"
              className="peer absolute -z-10 size-px overflow-hidden opacity-0"
              aria-label="פעולות מהירות"
              tabIndex={showFloating ? 0 : -1}
              onChange={(e) => setCornerOpen(e.currentTarget.checked)}
            />
            <label
              htmlFor="hero-quick-actions"
              className={cn(
                floatBtn,
                "cursor-pointer select-none active:scale-95",
                "peer-checked:[&_.i-dots]:hidden peer-checked:[&_.i-x]:block",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
              )}
            >
              <Ellipsis className="i-dots size-4 md:size-5" aria-hidden />
              <X className="i-x hidden size-4 md:size-5" aria-hidden />
            </label>
            <div
              className={cn(
                "pointer-events-none absolute left-full top-0 ml-1.5 flex items-center gap-1.5 peer-checked:pointer-events-auto md:ml-2 md:gap-2",
                "[&>*]:-translate-x-2 [&>*]:scale-75 [&>*]:opacity-0 [&>*]:transition-[transform,opacity] [&>*]:duration-200 [&>*]:ease-out motion-reduce:[&>*]:transition-none",
                "peer-checked:[&>*]:translate-x-0 peer-checked:[&>*]:scale-100 peer-checked:[&>*]:opacity-100"
              )}
            >
              <ThemeToggle className={floatBtn} />
              <a
                href="https://wa.me/972542002722"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                tabIndex={cornerActive ? 0 : -1}
                className={floatBtn}
              >
                <WhatsAppIcon className="size-4 md:size-5" />
              </a>
              <button
                type="button"
                onClick={openSearch}
                aria-label="חיפוש אירוע"
                tabIndex={cornerActive ? 0 : -1}
                className={floatBtn}
              >
                <Search className="size-4 md:size-5" aria-hidden />
              </button>
            </div>
          </div>
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
        {/* Action cluster — RTL order (right→left): hamburger (mobile only),
            theme, whatsapp, search. Grouped in a subtle pill so it reads as one
            control, not a loaded row. First DOM child sits on the right in RTL. */}
        <div ref={clusterRef} className="flex shrink-0 items-center gap-0 rounded-full bg-main-foreground/[0.06] px-0.5">
          <button
            type="button"
            aria-label={menuOpen ? "סגירת תפריט" : "פתיחת תפריט"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            // Desktop normally has the inline nav — but when the menu was
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

        {/* Desktop inline nav — replaces the hamburger on ≥md. Centred like the
            page title; hidden on detail pages where the sticky title takes the
            centre slot instead. */}
        {!pageTitle && !menuOpen && (
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

      {/* Slide-down menu — all sizes (desktop reaches it via the hero's
          floating hamburger; the inline nav hides while it's open). */}
      <div
        className={cn(
          "overflow-hidden border-t border-main-foreground/10 transition-[max-height]",
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
