"use client";

import { Modal } from "@mantine/core";
import { X } from "lucide-react";
import { CLUB_COPY } from "@/lib/club/copy";
import { ClubForm, type ClubAppliedResult, type ClubMode } from "./ClubForm";
import type { ClubOk } from "./clubClient";

export type { ClubAppliedResult, ClubMode } from "./ClubForm";

/**
 * The MEGA CLUB popup of the order summary: its own Mantine modal with a close X around the shared ClubForm (the
 * site's components/ui/Modal.tsx has no close button and no form slot). Mantine unmounts closed content, so every
 * opening starts on the state the caller asked for, with what the passenger form holds.
 */
export function ClubModal({
  open,
  initialMode,
  onClose,
  prefill,
  eventId,
  method,
  onApplied,
  continueLabel,
  onContinue,
}: {
  open: boolean;
  initialMode: ClubMode;
  onClose(): void;
  prefill: { email: string; phone: string; firstName: string; lastName: string };
  eventId: number | null;
  method: "popup" | "row";
  onApplied(a: ClubOk, how: "join" | "lookup", name: string | null): ClubAppliedResult;
  /** D14: set when the popup interrupted the way to payment - "פעם הבאה" and the card's button carry it on. */
  continueLabel?: string | null;
  onContinue?(): void;
}) {
  return (
    <Modal
      opened={open}
      onClose={onClose}
      centered
      size="sm"
      radius="lg"
      withCloseButton={false}
      styles={{ body: { paddingTop: 12 } }}
    >
      {/* Dor 09.11: a clear X at the top RIGHT (physical, not the RTL end), with the wordmark on the left. */}
      <div dir="ltr" className="mb-3 flex items-center justify-between">
        <span className="text-sm font-extrabold tracking-[0.2em] text-forest dark:text-glow">{CLUB_COPY.brand}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={CLUB_COPY.close}
          className="-mr-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <ClubForm
        initialMode={initialMode}
        prefill={prefill}
        eventId={eventId}
        method={method}
        context="order"
        onApplied={onApplied}
        onDone={onClose}
        continueLabel={continueLabel ?? null}
        onContinue={onContinue}
      />
    </Modal>
  );
}
