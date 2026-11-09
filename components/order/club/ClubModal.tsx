"use client";

import { Modal } from "@mantine/core";
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
}: {
  open: boolean;
  initialMode: ClubMode;
  onClose(): void;
  prefill: { email: string; phone: string; firstName: string; lastName: string };
  eventId: number | null;
  method: "popup" | "row";
  onApplied(a: ClubOk, how: "join" | "lookup", name: string | null): ClubAppliedResult;
}) {
  return (
    <Modal
      opened={open}
      onClose={onClose}
      centered
      size="sm"
      radius="lg"
      withCloseButton
      closeButtonProps={{ "aria-label": CLUB_COPY.close }}
      title={
        <span dir="ltr" className="text-sm font-extrabold tracking-[0.2em] text-forest dark:text-glow">
          {CLUB_COPY.brand}
        </span>
      }
      styles={{ header: { paddingBottom: 0 } }}
    >
      <ClubForm
        initialMode={initialMode}
        prefill={prefill}
        eventId={eventId}
        method={method}
        context="order"
        onApplied={onApplied}
        onDone={onClose}
      />
    </Modal>
  );
}
