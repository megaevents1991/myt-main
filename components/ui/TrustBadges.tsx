import { Award, Ticket, Lock } from "lucide-react";

import { cn } from "@/lib/utils";

// Short labels on mobile (space-tight), full labels on desktop.
const badges = [
  { Icon: Award, short: "30 שנות ניסיון", long: "מבית מגה תיירות · 30 שנות ניסיון", iconClass: "" },
  { Icon: Ticket, short: "כרטיסים רשמיים", long: "כרטיסים רשמיים בלבד", iconClass: "" },
  { Icon: Lock, short: "תשלום מאובטח", long: "תשלום מאובטח", iconClass: "" },
];

/** Divider-separated trust row used in the hero and detail-hero. Single line
 *  on mobile (short labels, smaller type), full labels on desktop. */
export const TrustBadges = ({ className }: { className?: string }) => (
  <ul
    className={cn(
      "flex flex-nowrap items-center whitespace-nowrap gap-x-1.5 text-[15px] font-bold sm:gap-x-4 sm:text-base",
      className
    )}
  >
    {badges.map(({ Icon, short, long, iconClass }, i) => (
      <li key={long} className="flex items-center gap-1 sm:gap-2">
        {i > 0 && (
          <span
            aria-hidden
            className="me-1 h-3.5 w-px bg-current opacity-30 sm:me-2 sm:h-4"
          />
        )}
        <Icon className={cn("size-[18px] shrink-0 sm:size-5", iconClass)} aria-hidden />
        <span className="sm:hidden">{short}</span>
        <span className="hidden sm:inline">{long}</span>
      </li>
    ))}
  </ul>
);
