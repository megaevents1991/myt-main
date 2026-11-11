/**
 * One ticket file of the customer's ticket page: `GET /api/ticket-file/<token>/<fileId>`.
 *
 * The token is the booking's own key. A file is served only when it belongs to that booking, the booking's tickets
 * were released to the customer, and it is a stored file (a ticket PDF or the seller's instruction letter) - never
 * a seller's proof of transfer. Everything else is a 404 that says nothing. Streamed from the private
 * `ticket-files` bucket; never cached.
 */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fileNameFor, isTicketToken } from "@/lib/tixstock-booking/ticket-page";
import { realTicketPageDeps } from "@/lib/tixstock-booking/ticket-page-deps";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A file's type comes from the seller's upload: only these are shown in the browser, each under its own type.
// Anything else is handed over as a download, so nothing a seller sent is ever rendered on our origin.
const INLINE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404, headers: { "cache-control": "private, no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; fileId: string }> }): Promise<Response> {
  const { token, fileId } = await params;
  if (!isTicketToken(token) || !UUID.test(fileId)) return notFound();

  try {
    const booking = await realTicketPageDeps().loadBookingByToken(token);
    if (!booking || booking.status === "cancelled" || booking.released_to_customer_at === null) return notFound();

    const { data: file, error } = await supabase
      .from("ticket_booking_files")
      .select("id, kind, row, seat, storage_path, content_type")
      .eq("id", fileId)
      .eq("booking_id", booking.id)
      .maybeSingle();
    if (error) {
      console.error("[ticket-file] read failed:", JSON.stringify(error));
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }
    if (!file || (file.kind !== "pdf" && file.kind !== "additional") || typeof file.storage_path !== "string" || file.storage_path === "") {
      return notFound();
    }

    const { data: blob, error: downloadError } = await supabase.storage.from("ticket-files").download(file.storage_path);
    if (downloadError || !blob) {
      console.error("[ticket-file] download failed:", JSON.stringify(downloadError));
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }

    const stored = typeof file.content_type === "string" ? file.content_type.trim().toLowerCase() : "";
    const type = stored === "" ? "application/pdf" : stored;
    const extension = INLINE_TYPES[type];
    const name = fileNameFor(String(file.kind), file.row ?? null, file.seat ?? null).replace(/\.pdf$/, `.${extension ?? "bin"}`);
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "content-type": extension ? type : "application/octet-stream",
        "content-disposition": `${extension ? "inline" : "attachment"}; filename="${name}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[ticket-file] failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
