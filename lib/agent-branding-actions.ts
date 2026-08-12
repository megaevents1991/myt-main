"use server";

import { requirePartner } from "@/lib/partner-auth";
import { supabase } from "@/lib/supabase";

/**
 * The partner's own logo - shown on the printable quote page
 * (`app/agent/quotes/[id]/page.tsx`, which already reads `profile.logo_url`
 * via `getPartnerProfile`) and, going forward, anywhere else a partner's own
 * branding is shown.
 *
 * Ported from myt-backoffice's `lib/actions/portal-branding-actions.ts` -
 * same shared `partner-logos` Storage bucket and `user_profiles.logo_url`
 * column both apps already read from. `logAudit()` calls from the source are
 * dropped: this app has no equivalent audit-log system to write to.
 */

const BUCKET = "partner-logos";
const MAX_FILE_BYTES = 2 * 1024 * 1024;
/**
 * No SVG. This bucket is world-readable and the uploader is a partner, not
 * staff - a scripted SVG would be attacker-controlled active content served
 * from the Supabase origin. Raster only.
 */
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Serve what we resolved, not what the browser claimed. */
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export type BrandingResult =
  | { ok: true; logo_url: string }
  | { ok: false; error: string };

export async function uploadPartnerLogo(
  formData: FormData,
): Promise<BrandingResult> {
  const session = await requirePartner();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "לא נבחר קובץ" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "הקובץ גדול מדי (עד 2MB)" };
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return { ok: false, error: "אפשר להעלות PNG, JPG או WebP בלבד" };
  }

  // Read the previous logo before overwriting the row, so the old object can
  // be cleaned up - otherwise every replacement orphans a file in a public
  // bucket.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (supabase as any)
    .from("user_profiles")
    .select("logo_url")
    .eq("id", session.sub)
    .maybeSingle();
  const previousUrl: string | null = current?.logo_url ?? null;

  // Random suffix per upload: avoids collisions between partners and stops a
  // replaced logo being served from a stale CDN cache under the same URL.
  const path = `${session.partner_code}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: CONTENT_TYPE_BY_EXT[ext],
      upsert: false,
    });
  if (uploadError) {
    console.error("uploadPartnerLogo:", JSON.stringify(uploadError));
    return { ok: false, error: "העלאת הלוגו נכשלה. נסו שוב." };
  }

  const logo_url = supabase.storage.from(BUCKET).getPublicUrl(path)
    .data.publicUrl;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("user_profiles")
    .update({ logo_url })
    .eq("id", session.sub);
  if (error) {
    // Don't leave the file behind if it will never be referenced.
    await supabase.storage.from(BUCKET).remove([path]);
    console.error("uploadPartnerLogo profile:", JSON.stringify(error));
    return { ok: false, error: "העלאת הלוגו נכשלה. נסו שוב." };
  }

  // Only now that the row points at the new file. A quote print page opened
  // earlier still references the old URL, but that document is already
  // rendered - nothing new will ask for it.
  if (previousUrl) {
    const previousPath = previousUrl.split(`/object/public/${BUCKET}/`)[1];
    if (previousPath) {
      await supabase.storage.from(BUCKET).remove([previousPath]);
    }
  }

  return { ok: true, logo_url };
}

export async function removePartnerLogo(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await requirePartner();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("user_profiles")
    .update({ logo_url: null })
    .eq("id", session.sub);
  if (error) {
    console.error("removePartnerLogo:", JSON.stringify(error));
    return { ok: false, error: "לא הצלחנו להסיר את הלוגו" };
  }

  // The file itself is left in the bucket on purpose: a quote print page
  // rendered earlier still points at that URL, and breaking old documents is
  // worse than an unreferenced image.
  return { ok: true };
}
