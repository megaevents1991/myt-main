"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { forgetOrdersLeft } from "@/lib/order/draftStorage";

/**
 * A draft lives only while the tab is on its order page (lib/order/draft.ts).
 *
 * Mounted once in the root layout: on every page load and route change it lets go of
 * every order draft whose `/order/<id>` this page is not - the customer left the order
 * for the homepage, the event page or another event's order, by a Link or a full load
 * alike - so the next visit to that event starts from step 1 (14.10: a customer who had
 * reached the summary with two travellers and wanted five opened the order again and
 * landed on the same summary). A refresh or a tab the phone dropped reloads the same
 * order page, so those still restore. Renders nothing.
 */
export function OrderDraftSweeper() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) forgetOrdersLeft(pathname);
  }, [pathname]);
  return null;
}
