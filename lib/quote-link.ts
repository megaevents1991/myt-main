/**
 * Signed quote links - the integrity half of "the PDF's pay CTA charges the
 * agent's price".
 *
 * The backoffice appends `&quote={id}&qsig={sig}` to a quote's payment link
 * (lib/actions/quote-actions.ts there), where sig = HMAC-SHA256 over
 * `quote:{id}:{totalUsd}` with the shared NEXT_SECRET_SESSION_SECRET (the
 * same parity contract the partner-handoff uses). The signature is the whole
 * capability: quotes have no share token, and a bare enumerable id must not
 * open another customer's offer (name + prices) or let anyone claim an
 * arbitrary total.
 */

function signingKey(): string {
  const key = process.env.NEXT_SECRET_SESSION_SECRET;
  if (!key) {
    throw new Error(
      "Missing NEXT_SECRET_SESSION_SECRET - quote links cannot be verified",
    );
  }
  return key;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return toBase64Url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True when sig matches this quote id + total (USD) under the shared secret. */
export async function verifyQuoteSig(
  quoteId: number,
  totalUsd: number,
  sig: string | null | undefined,
): Promise<boolean> {
  if (!sig) return false;
  try {
    const expected = await hmac(`quote:${quoteId}:${totalUsd}`);
    return timingSafeEqual(sig, expected);
  } catch (e) {
    console.error("verifyQuoteSig:", e);
    return false;
  }
}
