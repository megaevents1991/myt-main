import { redirect } from "next/navigation";

// Superseded by /agent — real Supabase Auth sessions instead of an in-memory
// React context, and reservations/search live in the site itself. Kept as a
// redirect, not a deletion, for whatever bookmarks or old shared links point
// here.
export default function PartnerDashboardRedirect() {
  redirect("/agent");
}
