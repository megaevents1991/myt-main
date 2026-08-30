"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "מחובר כסוכן" chip (V2 spec 2026-08-27: a signed-in agent browsing the main
 * site sees a connected indicator on the top menu; a visitor who is NOT
 * signed in sees nothing). Fetches /api/partner-session after hydration -
 * the partner_session cookie is httpOnly and reading it in the root layout
 * would force every page dynamic. Renders null for non-agents, so it can sit
 * unconditionally in the header and the order-flow Stepper row.
 *
 * 2026-08-30 (doc items 1-3): that endpoint now re-checks the BACKOFFICE
 * login, so this chip shows the agent who is signed in to the portal right
 * now - never a stale identity from an earlier handoff. The exit button leaves
 * agent mode in this browser (the portal login itself stays), so the customer
 * view can be tested without hunting for cookies.
 */
export function AgentConnectedBadge({
  className,
  /** The order flow shows the exit control; the global header stays minimal. */
  showExit = false,
}: {
  className?: string;
  showExit?: boolean;
}) {
  const [agentName, setAgentName] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/partner-session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.connected || data.role !== "agent") return;
        setConnected(true);
        setAgentName(typeof data.name === "string" && data.name ? data.name : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const leaveAgentMode = async () => {
    setLeaving(true);
    try {
      await fetch("/api/partner-session", { method: "DELETE" });
      // Full reload, not a state flip: prices, settlement options and the
      // referral strip are all decided from that cookie.
      window.location.reload();
    } catch {
      setLeaving(false);
    }
  };

  if (!connected) return null;

  return (
    <span
      dir="rtl"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300",
        className
      )}
      title={agentName ? `מחובר כסוכן: ${agentName}` : "מחובר כסוכן"}
    >
      <BadgeCheck size={13} aria-hidden className="shrink-0" />
      <span className="max-w-28 truncate">
        {agentName ? `סוכן · ${agentName}` : "מחובר כסוכן"}
      </span>
      {showExit && (
        <button
          type="button"
          onClick={leaveAgentMode}
          disabled={leaving}
          aria-label="יציאה ממצב סוכן"
          title="יציאה ממצב סוכן"
          className="ms-0.5 inline-flex size-4 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100 disabled:opacity-40"
        >
          <LogOut size={11} aria-hidden />
        </button>
      )}
    </span>
  );
}
