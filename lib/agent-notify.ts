import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";
import type { OrderData } from "@/lib/app.types";

/**
 * Agent notification for "לינק תשלום ללקוח" (payment-link) holds - see
 * app/api/payment/validateAndRecord.ts, which calls notifyAgentOfPaymentLinkPaid
 * the moment such a reservation's customer-paid link lands it on status Paid.
 *
 * Never throws past its own boundary; every failure is logged and swallowed -
 * a missing notification must never be allowed to affect a payment that
 * already succeeded (same fail-open posture as the customer email next to it).
 */

/**
 * Namespaces agent slugs from marketing uses of utm_content (ad-creative
 * names etc). MUST match myt-backoffice's lib/portal-attribution.ts
 * AGENT_UTM_PREFIX exactly - that module is the one thing that ever WRITES
 * this prefix, stamping `utm_content=ag-<agent_slug>` onto every portal link
 * it builds (office-agents feature, spec 2026-08-19-office-agents-design.md).
 * Separate repos/deployments, so the constant is duplicated here rather than
 * imported - kept as a literal, not re-derived, so the two can't silently drift.
 */
const AGENT_UTM_PREFIX = "ag-";

const EMAIL_SERVER_USER = process.env.EMAIL_SERVER_USER || "";
const EMAIL_SERVER_PASSWORD = process.env.EMAIL_SERVER_PASSWORD || "";

type ResolvedRecipient = { email: string; displayName: string | null };

/**
 * Who gets credited for this reservation: the office-agent behind its
 * primary UTM touch (utm_touches position 0, utm_content "ag-<slug>" ->
 * user_profiles.agent_slug), falling back to the referring partner row
 * itself. Mirrors the read side of myt-backoffice's
 * getReservationAttribution/getAgentLabelsForReservations (lib/portal-attribution.ts)
 * but resolves a single reservation and needs a real email to notify, not a
 * display label - reimplemented rather than imported (separate repos).
 */
async function resolveCreatingAgent(
  reservationId: number,
  affPartnerTrackingCode: string | null | undefined,
): Promise<ResolvedRecipient | null> {
  try {
    const { data: touch, error: touchError } = await supabase
      .from("utm_touches")
      .select("utm_content")
      .eq("reservation_id", reservationId)
      .eq("position", 0)
      .maybeSingle();
    if (touchError) {
      console.error(
        "resolveCreatingAgent: utm_touches lookup failed:",
        JSON.stringify(touchError),
      );
    }

    const utmContent = (touch as { utm_content?: string | null } | null)
      ?.utm_content;
    if (utmContent && utmContent.startsWith(AGENT_UTM_PREFIX)) {
      const slug = utmContent.slice(AGENT_UTM_PREFIX.length);
      if (slug) {
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("email, display_name")
          .eq("agent_slug", slug)
          .maybeSingle();
        if (profileError) {
          console.error(
            "resolveCreatingAgent: user_profiles lookup failed:",
            JSON.stringify(profileError),
          );
        }
        const email = (profile as { email?: string | null } | null)?.email;
        if (email) {
          return {
            email,
            displayName:
              (profile as { display_name?: string | null } | null)
                ?.display_name ?? null,
          };
        }
      }
    }

    // Fallback: the partner row the reservation is attributed to - covers a
    // pre-slug link, a resolution miss above, or an office with no per-agent
    // slugs at all (solo partners never get an "ag-" touch to begin with).
    if (affPartnerTrackingCode) {
      const { data: partner, error: partnerError } = await supabase
        .from("partners")
        .select("email, name_hebrew")
        .eq("partner_tracking_code", affPartnerTrackingCode)
        .maybeSingle();
      if (partnerError) {
        console.error(
          "resolveCreatingAgent: partners fallback failed:",
          JSON.stringify(partnerError),
        );
      }
      const email = (partner as { email?: string | null } | null)?.email;
      if (email) {
        return {
          email,
          displayName:
            (partner as { name_hebrew?: string | null } | null)
              ?.name_hebrew ?? null,
        };
      }
    }

    return null;
  } catch (e) {
    console.error("resolveCreatingAgent failed:", e);
    return null;
  }
}

/**
 * Notifies the agent who created a "לינק תשלום ללקוח" hold the moment the
 * customer's own payment on that link lands the reservation on Paid.
 *
 * Caller contract: only invoke this for a reservation whose
 * partner_settlement_method is already confirmed "payment_link" AND whose
 * payment just succeeded - this function does not re-check either.
 */
export async function notifyAgentOfPaymentLinkPaid(
  reservationId: number,
  orderData: OrderData,
): Promise<void> {
  try {
    const agent = await resolveCreatingAgent(
      reservationId,
      orderData.aff_partner_tracking_code,
    );
    if (!agent) {
      console.error(
        "notifyAgentOfPaymentLinkPaid: no agent/partner email resolved for reservation",
        reservationId,
      );
      return;
    }

    const customerName = `${orderData.main_contact_first_name ?? ""} ${
      orderData.main_contact_last_name ?? ""
    }`.trim();
    const amountIls = Number(orderData.final_purchase_price_ils);
    const amountFormatted = Number.isFinite(amountIls)
      ? `₪${amountIls.toLocaleString("he-IL")}`
      : "";

    const transporter = nodemailer.createTransport({
      host: "smtp.zeptomail.com",
      port: 587,
      auth: {
        user: EMAIL_SERVER_USER,
        pass: EMAIL_SERVER_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: '"MegaEvents Reservations" <reservations@mega-events.co.il>',
      to: agent.email,
      subject: `ההזמנה שולמה - ${customerName}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; font-size: 15px; color: #0A1A14; line-height: 1.6;">
          <p>שלום${agent.displayName ? ` ${agent.displayName}` : ""},</p>
          <p>ההזמנה ששלחת ללקוח בקישור תשלום שולמה בהצלחה.</p>
          <table role="presentation" style="margin-top: 12px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 12px 4px 0;"><strong>מספר הזמנה:</strong></td>
              <td style="padding: 4px 0;">${orderData.booking_reference ?? ""}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px 4px 0;"><strong>אירוע:</strong></td>
              <td style="padding: 4px 0;">${orderData.event_order_info?.name ?? ""}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px 4px 0;"><strong>לקוח:</strong></td>
              <td style="padding: 4px 0;">${customerName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px 4px 0;"><strong>סכום:</strong></td>
              <td style="padding: 4px 0;">${amountFormatted}</td>
            </tr>
          </table>
        </div>
      `,
    });
  } catch (e) {
    // Fail-open by design - see module doc comment. Payment is already
    // recorded by the time this runs; a notification miss is a report gap,
    // never a reason to retry/undo the payment write.
    console.error(
      "notifyAgentOfPaymentLinkPaid failed:",
      JSON.stringify({ reservationId, error: String(e) }),
    );
  }
}
