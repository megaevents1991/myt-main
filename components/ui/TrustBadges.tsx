import { Home, Ticket, Lock } from "lucide-react";

import { cn } from "@/lib/utils";

const badges = [
  { Icon: Home, label: "מבית מגה תיירות · 30 שנות ניסיון" },
  { Icon: Ticket, label: "כרטיסים רשמיים בלבד" },
  { Icon: Lock, label: "תשלום מאובטח" },
];

/** Divider-separated trust row used in the hero and detail-hero. */
export const TrustBadges = ({ className }: { className?: string }) => (
  <ul
    className={cn(
      "flex flex-wrap items-center gap-x-4 gap-y-2 text-sm",
      className
    )}
  >
    {badges.map(({ Icon, label }, i) => (
      <li key={label} className="flex items-center gap-2">
        {i > 0 && (
          <span
            aria-hidden
            className="me-2 hidden h-4 w-px bg-current opacity-30 sm:block"
          />
        )}
        <Icon className="size-4 shrink-0" aria-hidden />
        <span>{label}</span>
      </li>
    ))}
  </ul>
);
