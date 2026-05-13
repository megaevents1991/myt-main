// Helpers for the "back to homepage" CTA: on the mondial2026.* subdomain
// it should return to the main marketing site, not the mondial subdomain home.

const MAIN_SITE_URL = "https://www.mega-events.co.il/";

export function isMondialHost(host: string | null | undefined): boolean {
  return !!host && host.startsWith("mondial2026.");
}

export function homeHrefFromHost(host: string | null | undefined): string {
  return isMondialHost(host) ? MAIN_SITE_URL : "/";
}

// Server-side helper. Imports from next/headers — do NOT use in client components.
export async function getServerHomeHref(): Promise<string> {
  const { headers } = await import("next/headers");
  const host = (await headers()).get("host");
  return homeHrefFromHost(host);
}

// Client-side helper. Safe in browser; falls back to "/" during SSR/no-window.
export function getClientHomeHref(): string {
  if (typeof window === "undefined") return "/";
  return homeHrefFromHost(window.location.host);
}
