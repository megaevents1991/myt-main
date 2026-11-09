"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CLUB_CONSENT_TEXT, CLUB_COPY } from "@/lib/club/copy";
import {
  memberAfterConfirmationJoin,
  type ClubConfirmationView,
  type ClubMemberHandoff,
  type ClubOfferHandoff,
} from "@/lib/club/confirm";
import { CLUB_GRADIENT, ClubCard } from "./ClubCard";
import { postClub, trackClubJoin, writeClubCookie, writeClubHandoff } from "./clubClient";

/**
 * D17: MEGA CLUB on the confirmation page. A visitor who joined in this order gets the card ("ברוכים הבאים"), a
 * remembered member the card with what it saved, a visitor who did not join a calm offer for the next order - which,
 * once joined, turns into the card in the same place.
 */
export function ClubConfirmation({
  view,
  handoff,
}: {
  view: ClubConfirmationView;
  handoff: ClubMemberHandoff | ClubOfferHandoff;
}) {
  if (handoff.kind === "member" && view !== "offer") return <ClubWelcome view={view} member={handoff} email={null} />;
  if (handoff.kind === "offer" && view === "offer") return <ClubOffer offer={handoff} />;
  return null;
}

function ClubWelcome({
  view,
  member,
  email,
}: {
  view: "welcome" | "member";
  member: ClubMemberHandoff;
  /** The address the welcome mail just went to (a join on this page); null = the mail line is generic. */
  email: string | null;
}) {
  const title =
    view === "member" ? CLUB_COPY.confirmMemberTitle : member.returning ? CLUB_COPY.welcomeBack : CLUB_COPY.welcome;
  const saved = member.savedUsd;
  const body =
    view === "member" && saved != null
      ? CLUB_COPY.confirmMemberSaved(saved)
      : saved != null
        ? CLUB_COPY.confirmSaved(saved)
        : CLUB_COPY.confirmNext;
  const mailSent = view === "welcome" && !member.returning;

  return (
    <section
      dir="rtl"
      aria-label={CLUB_COPY.brand}
      className="my-6 flex flex-col gap-3 rounded-[20px] border border-[#E7E5DC] bg-card p-4 text-center shadow-sm dark:border-border"
    >
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <ClubCard memberNo={member.no} name={member.name ?? null} reveal showSince={view === "welcome"} />
      <p className="club-fade-up text-[15px] leading-relaxed text-foreground">
        {body}
        {mailSent && email ? (
          <>
            {" "}
            {CLUB_COPY.mailSentBefore}
            <bdi dir="ltr">{email}</bdi>
            {CLUB_COPY.mailSentAfter}.
          </>
        ) : mailSent ? (
          <> {CLUB_COPY.confirmMail}</>
        ) : null}
      </p>
    </section>
  );
}

type OfferState = "idle" | "busy" | "error" | "rate_limited";

function ClubOffer({ offer }: { offer: ClubOfferHandoff }) {
  const [ticked, setTicked] = useState(false);
  const [state, setState] = useState<OfferState>("idle");
  const [joined, setJoined] = useState<ClubMemberHandoff | null>(null);
  const [gone, setGone] = useState(false);

  if (gone) return null;
  if (joined) return <ClubWelcome view="welcome" member={joined} email={joined.returning ? null : offer.email} />;

  const busy = state === "busy";
  const join = () => {
    if (!ticked || busy) return;
    setState("busy");
    void postClub("/api/club/join", {
      email: offer.email,
      phone: offer.phone,
      consent: true,
      firstName: offer.firstName,
      lastName: offer.lastName,
      eventId: offer.eventId,
      method: "confirmation",
      hp: "",
    }).then((a) => {
      if (!a.ok) {
        // The club was switched off since the order: nothing to offer any more.
        if (a.kind === "off") setGone(true);
        else setState(a.kind === "rate_limited" ? "rate_limited" : "error");
        return;
      }
      const member = memberAfterConfirmationJoin(offer, a, Date.now());
      writeClubCookie(member.name ? { v: 1, code: a.code, no: a.memberNo, name: member.name } : { v: 1, code: a.code, no: a.memberNo });
      writeClubHandoff(member);
      trackClubJoin("confirmation", a.returning);
      setJoined(member);
    });
  };

  const note = state === "rate_limited" ? CLUB_COPY.rateLimited : state === "error" ? CLUB_COPY.error : null;

  return (
    <section
      dir="rtl"
      aria-label={CLUB_COPY.brand}
      className="mb-6 flex flex-col gap-3 rounded-2xl bg-accent p-4 text-right text-accent-foreground"
    >
      <div className="flex items-center gap-3.5">
        <div className="w-[116px] shrink-0">
          <MiniCard />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-bold leading-snug text-foreground">{CLUB_COPY.offerTitle}</h2>
          <p className="text-[13px] leading-snug text-foreground/85">{CLUB_COPY.offerText(offer.perTicketUsd)}</p>
        </div>
      </div>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id="club-confirm-consent"
          checked={ticked}
          disabled={busy}
          onCheckedChange={(v) => setTicked(v === true)}
          className="mt-0.5 h-5 w-5 border-foreground/50"
        />
        <label htmlFor="club-confirm-consent" className="cursor-pointer text-[13px] leading-snug">
          {CLUB_CONSENT_TEXT}
        </label>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full border-forest bg-card font-bold text-forest hover:bg-card/80 dark:border-glow dark:text-glow"
        disabled={!ticked || busy}
        onClick={join}
      >
        {busy ? CLUB_COPY.inlineBusy : CLUB_COPY.offerCta}
      </Button>
      {note ? (
        <p role="alert" className="text-[13px] font-medium text-destructive">
          {note}
        </p>
      ) : (
        <p className="text-[12px] text-muted-foreground">
          {CLUB_COPY.offerWith}
          <bdi dir="ltr">{offer.email}</bdi>
        </p>
      )}
    </section>
  );
}

/** The card's small preview beside the offer: no number yet. */
function MiniCard() {
  return (
    <div
      aria-hidden
      className="relative flex h-[68px] flex-col justify-between overflow-hidden rounded-[10px] px-2.5 py-2 text-forest shadow-[0_8px_18px_-8px_rgba(37,211,176,0.6)]"
      style={{ background: CLUB_GRADIENT }}
    >
      <div className="absolute -left-6 -top-[30px] h-20 w-20 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }} />
      <div className="relative flex items-start justify-between">
        <span dir="ltr" className="text-[9px] font-extrabold tracking-[0.18em]">
          {CLUB_COPY.brand}
        </span>
        <span className="h-3 w-4 rounded-[3px]" style={{ background: "linear-gradient(135deg,#f6e7a8 0%,#d9b85a 100%)" }} />
      </div>
      <span className="relative text-[12px] font-extrabold tracking-[0.1em]">• • • •</span>
    </div>
  );
}
