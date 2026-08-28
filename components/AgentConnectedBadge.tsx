"use client";

import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "מחובר כסוכן" chip (V2 spec 2026-08-27: a signed-in agent browsing the main
 * site sees a connected indicator on the top menu; a visitor who is NOT
 * signed in sees nothing). Fetches /api/partner-session after hydration -
 * the partner_session cookie is httpOnly and reading it in the root layout
 * would force every page dynamic. Renders null for non-agents, so it can sit
 * unconditionally in the header and the order-flow Stepper row.
 */
export function AgentConnectedBadge({ className }: { className?: string }) {
  const [agentName, setAgentName] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

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
    </span>
  );
}
