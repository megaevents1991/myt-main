import { supabase } from "@/lib/supabase";

/**
 * Login throttling for the partner area, backed by the shared `audit_log`
 * table (owned by myt-backoffice, already service-role-only) instead of an
 * in-memory counter - Vercel runs this route across many serverless
 * instances with no shared memory, so an in-process Map would only ever
 * throttle a fraction of the attempts.
 */

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS_PER_EMAIL = 5;
const MAX_ATTEMPTS_PER_IP = 10;
const ACTION = "partner_login_failed";

export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function checkLoginRateLimit(
  email: string,
  ip: string,
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  const { data, error } = await supabase
    .from("audit_log")
    .select("actor_email, ip")
    .eq("action", ACTION)
    .gte("created_at", since)
    .or(`actor_email.eq.${email},ip.eq.${ip}`);

  if (error) {
    // Fail open: a broken query must not lock every partner out of the site.
    console.error(
      "partner login rate-limit check failed:",
      JSON.stringify(error),
    );
    return { allowed: true };
  }

  const byEmail = data.filter((row) => row.actor_email === email).length;
  const byIp = data.filter((row) => row.ip === ip).length;

  if (byEmail >= MAX_ATTEMPTS_PER_EMAIL || byIp >= MAX_ATTEMPTS_PER_IP) {
    return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60 };
  }
  return { allowed: true };
}

export async function recordFailedLogin(
  email: string,
  ip: string,
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    actor_email: email,
    action: ACTION,
    ip,
  });
  if (error) {
    // Never let logging failure surface as a login failure of its own.
    console.error(
      "partner login: failed to record attempt -",
      JSON.stringify(error),
    );
  }
}
