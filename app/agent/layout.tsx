import { ReactNode } from "react";
import { getPartnerSession } from "@/lib/partner-auth";
import { AgentNav } from "./agent-nav";

/**
 * The signed-in agent/influencer area.
 *
 * Never statically rendered and never cached: every page under it is scoped to
 * one partner. The middleware already redirects an unauthenticated request to
 * /agent/login, so this only has to render the shell.
 */
export const dynamic = "force-dynamic";

export default async function AgentLayout({ children }: { children: ReactNode }) {
  const session = await getPartnerSession();

  return (
    <div dir="rtl" className="mx-auto w-full max-w-6xl px-4 py-6">
      {session && (
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">
              {session.display_name || session.email}
            </p>
            <p className="text-xs text-gray-500">
              {session.role === "agent" ? "סוכן" : "משפיען"} · קוד{" "}
              <span className="font-mono">{session.partner_code}</span>
            </p>
          </div>
          <AgentNav role={session.role} />
        </header>
      )}
      {children}
    </div>
  );
}
