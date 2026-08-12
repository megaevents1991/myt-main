"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type NavItem = { name: string; href: string; agentOnly?: boolean };

const items: NavItem[] = [
  { name: "חיפוש חבילות", href: "/agent" },
  { name: "דשבורד", href: "/agent/dashboard" },
  { name: "הזמנות", href: "/agent/reservations" },
  { name: "הצבירה שלי", href: "/agent/credit" },
  { name: "קופונים", href: "/agent/coupons" },
  { name: "קישורים", href: "/agent/links" },
  // Agent-only - an influencer shares a link and never prices for a named
  // customer (same rule requireAgent() enforces server-side for the routes
  // themselves; this is just the tab, not the gate).
  { name: "הצעות מחיר", href: "/agent/quotes", agentOnly: true },
];

export function AgentNav({ role }: { role: "agent" | "affiliate" }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/partner-auth/logout", { method: "POST" });
    router.replace("/agent/login");
    router.refresh();
  };

  return (
    <nav className="flex items-center gap-1">
      {items
        .filter((item) => !item.agentOnly || role === "agent")
        .map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/agent" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                active ? "bg-main text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      <button
        type="button"
        onClick={logout}
        className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
      >
        התנתקות
      </button>
    </nav>
  );
}
