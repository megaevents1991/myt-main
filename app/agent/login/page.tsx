import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPartnerSession } from "@/lib/partner-auth";
import { PartnerLoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function PartnerLoginPage() {
  // Already signed in — don't show a login form to someone who has a session.
  if (await getPartnerSession()) redirect("/agent");

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold" dir="rtl">
        אזור סוכנים ומשפיענים
      </h1>
      {/* useSearchParams needs a Suspense boundary to keep this page static-safe. */}
      <Suspense fallback={null}>
        <PartnerLoginForm />
      </Suspense>
    </main>
  );
}
