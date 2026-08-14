import { permanentRedirect } from "next/navigation";

// LEGACY-ROUTE: the /c/ tree is canonical (2026-08-14). This route survives
// only for old links/campaigns/Google - delete it (and this redirect) per
// docs/LEGACY-ROUTES-TODO.md once campaigns run on /c/ URLs.
export default async function ArtistsPage() {
  permanentRedirect("/c/music/artists");
}
