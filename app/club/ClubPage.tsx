"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClubCard } from "@/components/order/club/ClubCard";
import { ClubForm } from "@/components/order/club/ClubForm";
import { writeClubCookie } from "@/components/order/club/clubClient";
import { CLUB_COPY } from "@/lib/club/copy";
import { readClubCookie, type ClubCookie } from "@/lib/club/rules";

const NO_PREFILL = { email: "", phone: "", firstName: "", lastName: "" };

/**
 * The /club page's form side (D15). A member this device knows sees their card and code; everyone else joins (or says
 * "כבר חברים") with the order's own form. Joining here only remembers the member on this device - the next order
 * applies the price by itself.
 */
export function ClubPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [known, setKnown] = useState<ClubCookie | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setKnown(readClubCookie(document.cookie));
    fetch("/api/club/config")
      .then((r) => r.json())
      .then((c: { enabled?: unknown }) => setEnabled(c?.enabled === true))
      .catch(() => setEnabled(false));
  }, []);

  if (enabled === null) return <div className="h-80 animate-pulse rounded-xl bg-muted" aria-busy />;
  if (!enabled) return <p className="text-base text-muted-foreground">{CLUB_COPY.pageClosed}</p>;

  if (known && !showForm) {
    return (
      <div dir="rtl" className="flex flex-col gap-4 text-right">
        <ClubCard memberNo={known.no} name={known.name ?? null} />
        <p className="text-[15px] font-semibold text-foreground">{CLUB_COPY.pageKnown}</p>
        <p className="text-sm text-muted-foreground">
          {CLUB_COPY.pageCode}{" "}
          <bdi dir="ltr" className="font-mono text-base font-bold tracking-widest text-foreground">
            {known.code}
          </bdi>
        </p>
        <Button asChild size="lg" className="w-full font-bold">
          <Link href="/">{CLUB_COPY.pageCta}</Link>
        </Button>
        <button
          type="button"
          className="text-center text-sm font-semibold text-foreground underline underline-offset-4 decoration-foreground/40"
          onClick={() => setShowForm(true)}
        >
          {CLUB_COPY.pageOther}
        </button>
      </div>
    );
  }

  return (
    <ClubForm
      initialMode={showForm ? "member" : "join"}
      prefill={NO_PREFILL}
      eventId={null}
      method="page"
      context="page"
      onApplied={(a, _how, name) => {
        const cookie: ClubCookie = name ? { v: 1, code: a.code, no: a.memberNo, name } : { v: 1, code: a.code, no: a.memberNo };
        writeClubCookie(cookie);
        return { applied: false, savedUsd: 0 };
      }}
    />
  );
}
