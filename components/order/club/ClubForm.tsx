"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CLUB_CONSENT_TEXT, CLUB_COPY } from "@/lib/club/copy";
import { cleanEmail, cleanPhone } from "@/lib/club/rules";
import { CLUB_GRADIENT, ClubCard } from "./ClubCard";
import { postClub, trackClubApplied, trackClubJoin, type ClubOk } from "./clubClient";

export type ClubMode = "join" | "member";
type View = ClubMode | "joined" | "welcome_back";

export type ClubAppliedResult = { applied: boolean; savedUsd: number };

/**
 * The MEGA CLUB form (spec §5, mockup version C): join = email + phone + the consent box (unticked; the button waits
 * for it), "כבר חברים?" = email only, then the member card. The amount is never shown before joining. One form for the
 * order's popup (`context: "order"`) and the /club page (`context: "page"`, D15) - each mount starts fresh.
 */
export function ClubForm({
  initialMode,
  prefill,
  eventId,
  method,
  context,
  onApplied,
  onDone,
}: {
  initialMode: ClubMode;
  prefill: { email: string; phone: string; firstName: string; lastName: string };
  eventId: number | null;
  method: "popup" | "row" | "page";
  context: "order" | "page";
  onApplied(a: ClubOk, how: "join" | "lookup", name: string | null): ClubAppliedResult;
  /** "חזרה להזמנה" in the order; the page links to the site instead. */
  onDone?(): void;
}) {
  const [view, setView] = useState<View>(initialMode);
  const [email, setEmail] = useState(prefill.email);
  const [phone, setPhone] = useState(prefill.phone);
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [done, setDone] = useState<{ answer: ClubOk; result: ClubAppliedResult; name: string | null } | null>(null);

  const failText = (kind: string) =>
    kind === "invalid" ? CLUB_COPY.invalid : kind === "rate_limited" ? CLUB_COPY.rateLimited : CLUB_COPY.error;

  async function join() {
    if (busy) return;
    if (!cleanEmail(email) || !cleanPhone(phone)) return setError(CLUB_COPY.invalid);
    setBusy(true);
    setError(null);
    const a = await postClub("/api/club/join", {
      email,
      phone,
      consent,
      firstName: prefill.firstName || undefined,
      lastName: prefill.lastName || undefined,
      eventId,
      method,
      hp,
    });
    setBusy(false);
    if (!a.ok) return setError(failText(a.kind));
    const name = a.returning ? null : a.firstName;
    const result = onApplied(a, "join", name);
    trackClubJoin(method === "row" ? "row" : method === "page" ? "page" : "popup", a.returning);
    setDone({ answer: a, result, name });
    setView(a.returning ? "welcome_back" : "joined");
  }

  async function lookup() {
    if (busy) return;
    if (!cleanEmail(email)) return setError(CLUB_COPY.invalid);
    setBusy(true);
    setError(null);
    setNotFound(false);
    const a = await postClub("/api/club/lookup", { email, eventId, hp });
    setBusy(false);
    if (!a.ok) {
      if (a.kind === "not_found") return setNotFound(true);
      return setError(failText(a.kind));
    }
    const result = onApplied(a, "lookup", null);
    trackClubApplied("lookup");
    setDone({ answer: a, result, name: null });
    setView("welcome_back");
  }

  // Site tokens only (light + dark): the inputs, the mint CTA and the checkbox are the order page's own.
  const fieldCls = "flex flex-col gap-1.5 text-sm font-semibold text-foreground";
  const linkCls =
    "text-center text-sm font-semibold text-foreground underline underline-offset-4 decoration-foreground/40 hover:decoration-foreground";

  return (
      <div dir="rtl" className="flex flex-col gap-4 pb-1 text-right text-foreground">
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

        {view === "join" && (
          <>
            {context === "page" ? (
              // The page already says what the club is beside the form (D15): here, the heading and the fields.
              <h2 className="text-xl font-extrabold leading-tight">{CLUB_COPY.pageFormTitle}</h2>
            ) : (
              <>
              <div className="rounded-2xl p-4 text-forest" style={{ background: CLUB_GRADIENT }}>
                <h2 className="text-xl font-extrabold leading-tight">{CLUB_COPY.title}</h2>
                <p className="mt-1 text-sm font-medium">{CLUB_COPY.sub}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {CLUB_COPY.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[14px]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              </>
            )}
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void join();
              }}
            >
              <label className={fieldCls}>
                {CLUB_COPY.emailLabel}
                <Input
                  type="email"
                  dir="ltr"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className={fieldCls}>
                {CLUB_COPY.phoneLabel}
                <Input
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </label>
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="club-consent"
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5 h-5 w-5 border-foreground/50"
                />
                <label htmlFor="club-consent" className="cursor-pointer text-[13px] leading-snug text-foreground">
                  {CLUB_CONSENT_TEXT}
                </label>
              </div>
              {error && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full font-bold" disabled={!consent || busy}>
                {busy ? "..." : CLUB_COPY.cta}
              </Button>
            </form>
            <button
              type="button"
              className={linkCls}
              onClick={() => {
                setError(null);
                setView("member");
              }}
            >
              {CLUB_COPY.already}
            </button>
          </>
        )}

        {view === "member" && (
          <>
            <div>
              <h2 className="text-xl font-extrabold leading-tight">{CLUB_COPY.memberTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{CLUB_COPY.memberSub}</p>
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void lookup();
              }}
            >
              <label className={fieldCls}>
                {CLUB_COPY.emailLabel}
                <Input
                  type="email"
                  dir="ltr"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setNotFound(false);
                  }}
                  required
                />
              </label>
              {notFound && (
                <p role="status" className="text-sm text-foreground">
                  {CLUB_COPY.notFound}.{" "}
                  <button
                    type="button"
                    className="font-semibold underline underline-offset-4"
                    onClick={() => {
                      setNotFound(false);
                      setView("join");
                    }}
                  >
                    {CLUB_COPY.joinInstead}
                  </button>
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full font-bold" disabled={busy || !email.trim()}>
                {busy ? "..." : CLUB_COPY.memberCta}
              </Button>
            </form>
            <button
              type="button"
              className={linkCls}
              onClick={() => {
                setError(null);
                setView("join");
              }}
            >
              {CLUB_COPY.joinInstead}
            </button>
          </>
        )}

        {(view === "joined" || view === "welcome_back") && done && (
          <>
            <h2 className="text-xl font-extrabold leading-tight">
              {view === "joined" ? CLUB_COPY.welcome : CLUB_COPY.welcomeBack}
            </h2>
            <ClubCard memberNo={done.answer.memberNo} name={done.name} />
            <div className="flex flex-col gap-1.5 text-[14px]">
              <p className="font-bold">
                {context === "page"
                  ? CLUB_COPY.pageApplied
                  : done.result.applied
                    ? CLUB_COPY.appliedLine(done.result.savedUsd)
                    : CLUB_COPY.keptBetter}
              </p>
              <p>{CLUB_COPY.everyOrder(done.answer.discountValue)}</p>
              {view === "joined" && (
                <p className="text-muted-foreground">
                  {CLUB_COPY.mailSentBefore}
                  <bdi dir="ltr">{email.trim()}</bdi>
                  {CLUB_COPY.mailSentAfter}
                </p>
              )}
            </div>
            {context === "page" ? (
              <Button asChild size="lg" className="w-full font-bold">
                <Link href="/">{CLUB_COPY.pageCta}</Link>
              </Button>
            ) : (
              <Button type="button" size="lg" className="w-full font-bold" onClick={onDone}>
                {CLUB_COPY.backToOrder}
              </Button>
            )}
          </>
        )}
      </div>
  );
}
