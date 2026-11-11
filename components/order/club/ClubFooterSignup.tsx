"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CLUB_CONSENT_TEXT, CLUB_COPY } from "@/lib/club/copy";
import { cleanEmail, cleanPhone, footerClubShows, readClubCookie, type ClubCookie } from "@/lib/club/rules";
import { influencerPrimaryCode, readUtmCookieFromHeader } from "@/lib/utm";
import { CLUB_GRADIENT } from "./ClubCard";
import { postClub, trackClubJoin, writeClubCookie } from "./clubClient";

/**
 * D19 (Tom 11.11): MEGA CLUB's sign-up in the site footer - email, phone and the consent box, recorded as
 * `site_footer`. It wakes only when the footer comes near the screen (no club request for a visitor who never scrolls
 * there) and renders nothing until it knows the visitor should see it (`footerClubShows`). The club's own mint card,
 * in brand colours that stay the same in both themes, so it reads on the dark footer.
 */
export function ClubFooterSignup() {
  const pathname = usePathname() ?? "/";
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [member, setMember] = useState<ClubCookie | null>(null);
  const [partnerCode, setPartnerCode] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ no: number; returning: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    fetch("/api/club/config")
      .then((r) => r.json())
      .then((c: { enabled?: unknown }) => {
        if (!cancelled) setEnabled(c?.enabled === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [near]);

  // A join elsewhere (the order, /club) or a partner's link changes the answer: read both again on every page. The
  // footer outlives a client navigation, so this page's "welcome" line is dropped too - a new member's next page shows
  // nothing, and never on /order or /confirmation.
  useEffect(() => {
    if (!near) return;
    setDone(null);
    setMember(readClubCookie(document.cookie));
    setPartnerCode(influencerPrimaryCode(readUtmCookieFromHeader(document.cookie)));
  }, [near, pathname]);

  const show = done !== null || footerClubShows({ enabled, member, partnerCode, path: pathname });

  async function join() {
    if (busy) return;
    if (!cleanEmail(email) || !cleanPhone(phone)) return setError(CLUB_COPY.invalid);
    if (!consent) return;
    setBusy(true);
    setError(null);
    const a = await postClub("/api/club/join", { email, phone, consent: true, eventId: null, method: "footer", hp });
    setBusy(false);
    if (!a.ok) {
      if (a.kind === "off") return setEnabled(false);
      return setError(
        a.kind === "invalid" ? CLUB_COPY.invalid : a.kind === "rate_limited" ? CLUB_COPY.rateLimited : CLUB_COPY.error,
      );
    }
    const name = a.returning ? null : a.firstName;
    writeClubCookie(name ? { v: 1, code: a.code, no: a.memberNo, name } : { v: 1, code: a.code, no: a.memberNo });
    trackClubJoin("footer", a.returning);
    setDone({ no: a.memberNo, returning: a.returning });
  }

  const inputCls =
    "h-11 border-forest/25 bg-white text-base text-forest placeholder:text-forest/50 focus-visible:ring-forest/40";

  return (
    <div ref={ref}>
      {show && (
        <section
          dir="rtl"
          aria-labelledby="club-footer-title"
          className="mb-8 rounded-2xl p-5 text-right text-forest md:p-6"
          style={{ background: CLUB_GRADIENT }}
        >
          {done ? (
            <p role="status" className="text-base font-bold leading-snug">
              {done.returning ? CLUB_COPY.footerWelcomeBack(done.no) : CLUB_COPY.footerJoined(done.no)}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-start md:gap-8">
              <div className="min-w-0">
                <h2 id="club-footer-title" className="text-xl font-extrabold leading-tight">
                  {CLUB_COPY.footerTitle}
                </h2>
                <p className="mt-1 text-sm font-medium leading-snug">{CLUB_COPY.footerSub}</p>
              </div>
              <form
                className="flex min-w-0 flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void join();
                }}
              >
                {/* Honeypot: people never see it, form-filling bots do. */}
                <input
                  type="text"
                  name="company_website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                />
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">
                    {CLUB_COPY.emailLabel}
                    <Input
                      type="email"
                      dir="ltr"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={inputCls}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">
                    {CLUB_COPY.phoneLabel}
                    <Input
                      type="tel"
                      dir="ltr"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className={inputCls}
                    />
                  </label>
                  {/* On a phone the box comes before the button it switches on; from sm up it sits under the row. */}
                  <div className="flex items-start gap-2.5 sm:order-last sm:col-span-3">
                    <Checkbox
                      id="club-footer-consent"
                      checked={consent}
                      onCheckedChange={(v) => setConsent(v === true)}
                      className="mt-0.5 h-5 w-5 border-forest/60 data-[state=checked]:border-forest data-[state=checked]:bg-forest data-[state=checked]:text-glow"
                    />
                    <label htmlFor="club-footer-consent" className="cursor-pointer text-[13px] leading-snug">
                      {CLUB_CONSENT_TEXT}
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={!consent || busy}
                    className="h-11 self-end rounded-full bg-forest px-6 text-base font-bold text-glow transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "..." : CLUB_COPY.footerCta}
                  </button>
                </div>
                {error && (
                  <p role="alert" className="text-sm font-bold">
                    {error}
                  </p>
                )}
                <Link
                  href="/club"
                  className="self-start text-sm font-semibold underline decoration-forest/40 underline-offset-4 hover:decoration-forest"
                >
                  {CLUB_COPY.already}
                </Link>
              </form>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
