import { Home, Ticket, Lock } from "lucide-react";

import { cn } from "@/lib/utils";

const badges = [
  { Icon: Home, label: "מבית מגה תיירות · 30 שנות ניסיון" },
  { Icon: Ticket, label: "כרטיסים רשמיים בלבד" },
  { Icon: Lock, label: "תשלום מאובטח" },
];

/** Divider-separated trust row used in the hero and detail-hero. Single line
 *  on mobile (smaller type), roomier on desktop. */
export const TrustBadges = ({ className }: { className?: string }) => (
  <ul
    className={cn(
      "flex flex-nowrap items-center whitespace-nowrap gap-x-2 text-[11px] sm:gap-x-4 sm:text-sm",
      className
    )}
  >
    {badges.map(({ Icon, label }, i) => (
      <li key={label} className="flex items-center gap-1 sm:gap-2">
        {i > 0 && (
          <span
            aria-hidden
            className="me-1 h-3.5 w-px bg-current opacity-30 sm:me-2 sm:h-4"
          />
        )}
        <Icon className="size-3.5 shrink-0 sm:size-4" aria-hidden />
        <span>{label}</span>
      </li>
    ))}
  </ul>
);
