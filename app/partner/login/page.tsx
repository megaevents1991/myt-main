import { redirect } from "next/navigation";

// Superseded by /agent/login - see app/partner/page.tsx.
export default function PartnerLoginRedirect() {
  redirect("/agent/login");
}
