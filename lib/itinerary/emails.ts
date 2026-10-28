/**
 * "Build Your Euro Trip" - the two emails of a trip's 24-hour hold.
 *
 * - Ops: one plain-text email for the whole group (every reservation of the trip, what to buy for
 *   each, the flight legs, the hotels, the shares), to SALES_REP_EMAIL - the fields of
 *   confirm-order's "New Order Details" mail, per event.
 * - The customer: "קיבלנו את הבקשה. נציג יחזור אליכם תוך 24 שעות." and the trip - WITHOUT a pay
 *   link or a resume link (spec §7.5.1: until launch an itinerary hold is converted by sales by
 *   phone; the single-event resume link must never open a trip row).
 *
 * Sent through the same mail service and sender as confirm-order (ZeptoMail SMTP, the
 * EMAIL_SERVER_* credentials, reservations@mega-events.co.il). The builders are pure (tested);
 * `sendTripEmails` never throws - a failed email is logged and never fails a hold.
 */
import nodemailer from "nodemailer";
import type { Event, FlightSegment, ItineraryFlight, OrderHotel } from "@/lib/app.types";
import { roomsLabel } from "@/lib/events/readyPackage";
import { dayMonth, dayMonthYear, stayCityName } from "./builder";
import type { GroupRowInsert, RowEventInfo, TripSubmission } from "./confirm";
import { stays, trainLegs } from "./dates";
import { dayDiff, eventDay } from "./geo";
import { offlineHotelIds } from "./offlineHold";
import type { LivePrice } from "./progress";
import { fitTravellers, type ContactInput, type OtherTraveller } from "./travellers";
import type { TrainLeg } from "./types";

export type TripMailRow = {
  seq: number;
  /** The reservation's id (null before it exists). */
  id: number | null;
  reference: string | null;
  event: Event;
  info: RowEventInfo;
  shareUsd: number;
  shareIls: number;
};

export type TripMailInput = {
  group: string;
  status: string;
  /** Seq 1's booking reference - the customer's "מספר הבקשה". */
  reference: string | null;
  contact: ContactInput;
  others: OtherTraveller[];
  pax: number;
  rows: TripMailRow[];
  flight: ItineraryFlight;
  /** The moves the customer makes by train (not included). */
  trainLegs: TrainLeg[];
  /** One hotel per stay, with the city and the reservation it is on. */
  hotels: { city: string; hotel: OrderHotel; onRow: number | null }[];
  totalUsd: number;
  perTravellerUsd: number;
  totalIls: number;
  rateIls: number;
  affiliate: string;
  /** The customer pressed "רוצים לפצל תשלום? דברו עם נציג" (`TripSubmission.splitPay`). */
  splitPay: boolean;
};

/** The mails' input from what the route has in hand after the insert. */
export function tripMailInput(i: {
  sub: TripSubmission;
  route: Event[];
  rows: GroupRowInsert[];
  ids: (number | null)[];
  references: (string | null)[];
  price: LivePrice;
  rateIls: number;
}): TripMailInput {
  const { sub, route, rows } = i;
  const travellers = fitTravellers(sub.travellers, sub.pax);
  const hotels = stays(route, sub.dates).flatMap((stay) => {
    const hotel = sub.hotels[stay.key];
    if (!hotel) return [];
    const at = route.findIndex((e) => e.id === stay.events[0].id);
    return [{ city: stayCityName(stay.events[0]), hotel, onRow: at >= 0 ? (i.ids[at] ?? null) : null }];
  });
  return {
    group: rows[0]?.itinerary_group ?? sub.group,
    status: rows[0]?.status ?? "24Save",
    reference: i.references[0] ?? null,
    contact: travellers.contact,
    others: travellers.others,
    pax: sub.pax,
    rows: route.map((event, k) => ({
      seq: k + 1,
      id: i.ids[k] ?? null,
      reference: i.references[k] ?? null,
      event,
      info: rows[k].event_order_info,
      shareUsd: rows[k].user_shown_price,
      shareIls: rows[k].final_purchase_price_ils,
    })),
    flight: sub.flight,
    trainLegs: trainLegs(route, sub.dates, new Set(sub.train)),
    hotels,
    totalUsd: i.price.total,
    perTravellerUsd: i.price.perTraveller,
    totalIls: rows.reduce((sum, r) => sum + r.final_purchase_price_ils, 0),
    rateIls: i.rateIls,
    affiliate: sub.utmSource,
    splitPay: sub.splitPay === true,
  };
}

/** `YYYY-MM-DDTHH:MM...` -> `YYYY-MM-DD HH:MM` (the leg's own local time). */
const legTime = (iso: string): string => `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;

const stopsText = (leg: FlightSegment): string => {
  const n = leg.stops?.length ?? 0;
  return n === 0 ? "direct" : `${n} stop${n > 1 ? "s" : ""} (${leg.stops.map((s) => s.iataCode).join(", ")})`;
};

const hotelRoom = (h: OrderHotel): string => h.rate?.room_name || h.hotelInformation?.roomName || "N/A";

const nightsOf = (h: OrderHotel): number => dayDiff(String(h.checkin).slice(0, 10), String(h.checkout).slice(0, 10));

/** The ops email: everything sales need to convert the hold, per reservation. */
export function tripOpsMail(i: TripMailInput): { subject: string; text: string } {
  const pad = "          ";
  const line = (s: string) => `${pad}${s}`;
  const ref = (r: TripMailRow) => `#${r.id ?? "?"}${r.reference ? ` (${r.reference})` : ""}`;
  const seq1 = i.rows[0];

  const events = i.rows.flatMap((r) => {
    const t = r.info;
    return [
      line(`[${r.seq}/${i.rows.length}] Reservation ${ref(r)}`),
      line(`Event: ${r.event.name} (event id ${r.event.id})`),
      line(`Date: ${r.event.date}`),
      line(`Location: ${t.location_name || "N/A"}`),
      line(`Ticket Type: ${t.category}`),
      line(`Quantity: ${t.number_of_ticket}`),
      line(`Ticket ID: ${t.id || "N/A"}`),
      line(`Vendor: ${t.vendor || "N/A"}`),
      line(
        `BUY FROM (supplier): ${
          t.own_stock ? "OUR STOCK - no purchase, allocate from the seats we hold" : (t.supplier || "N/A").toUpperCase()
        }`,
      ),
      line(`Supplier Event ID: ${t.supplier_event_id || "N/A"}`),
      line(`Supplier Category: ${t.supplier_category || "N/A"}`),
      line(`Our Zone: ${t.zone_label || "N/A"}`),
      ...(t.non_instant ? [line("!!! NOT INSTANT-CONFIRM - confirm with the supplier BEFORE confirming the order !!!")] : []),
      ...(t.seating_choice
        ? [line(`Seating chosen: ${t.seating_choice === "split" ? "split - pairs (and a triple / one apart for an odd party)" : "all together"}`)]
        : []),
      line(`Ticket price USD: ${t.price_per_ticket} x ${t.number_of_ticket}`),
      line(`This reservation's share: $${r.shareUsd} / ILS ${r.shareIls}`),
      "",
    ];
  });

  const f = i.flight;
  const flights = [
    line(`Airline: ${f.metadata?.name || f.airline || "N/A"}`),
    line(`Price for the party: $${f.price} (${f.numOfTravelers} travellers) - the full offer is on reservation ${seq1 ? ref(seq1) : "seq 1"}`),
    ...(f.legs ?? []).map(
      (leg, k) =>
        line(
          `${k + 1}. ${leg.departureAirport} -> ${leg.arrivalAirport}  ${legTime(leg.departureTime)} -> ${legTime(leg.arrivalTime)}  ${
            leg.flightNumber || "N/A"
          }  ${stopsText(leg)}`,
        ),
    ),
    ...i.trainLegs.map((t) => line(`Train (customer's own, NOT included): ${t.fromName} -> ${t.toName} on ${t.date}`)),
  ];

  const hotels = i.hotels.flatMap(({ city, hotel, onRow }) => [
    line(`${city} (on reservation #${onRow ?? "?"}): ${hotel.name}`),
    ...(offlineHotelIds(hotel)
      ? [
          line(
            `OUR STOCK - no purchase, rooms held from offline_hotels block(s) ${offlineHotelIds(hotel)?.join(", ")} (cost $${
              hotel.offlineRawPrice ?? "N/A"
            })`,
          ),
        ]
      : []),
    line(`Dates: ${String(hotel.checkin).slice(0, 10)} -> ${String(hotel.checkout).slice(0, 10)} (${nightsOf(hotel)} nights)`),
    line(`Room Type: ${hotelRoom(hotel)}`),
    line(`Rooms: ${roomsLabel(hotel.guests) || "N/A"}`),
    line(`Breakfast: ${hotel.rate?.meal_data?.has_breakfast ? "WITH breakfast" : "no breakfast"}`),
    line(`Price: $${hotel.price}`),
    "",
  ]);

  const hold = i.status === "24Save";
  const text = [
    "",
    ...(hold
      ? [
          line(`New EURO TRIP request - 24h HOLD (status ${i.status}).`),
          line("No payment link was sent to the customer - sales converts this hold by phone."),
        ]
      : [line(`New EURO TRIP order - PAY NOW (status ${i.status}) - the customer was sent to payment.`)]),
    ...(i.splitPay ? [line("*** SPLIT PAYMENT: the customer asked to split the payment - arrange it on the call. ***")] : []),
    line(`Group: ${i.group}`),
    line(`Reservations: ${i.rows.map((r) => `${ref(r)} = seq ${r.seq}/${i.rows.length}`).join(", ")}`),
    line(`Name: ${i.contact.firstName} ${i.contact.lastName}`),
    line(`Contact Details: ${i.contact.phone}, ${i.contact.email}`),
    line(`Travellers: ${i.pax}`),
    line(`More Pax: ${i.others.length}- ${i.others.map((o) => `${o.firstName} ${o.lastName}`).join("; ")}`),
    line(`Affiliate (utm_source): ${i.affiliate || "N/A"}`),
    "",
    line("******** Events ********"),
    ...events,
    line("******** Flights (the whole trip) ********"),
    ...flights,
    "",
    line("******** Hotels ********"),
    ...hotels,
    line("******************"),
    line(`Total Price USD: ${i.totalUsd} (per traveller ${i.perTravellerUsd})`),
    line(`Total Price ILS: ${i.totalIls}`),
    line(`Exchange Rate: ${Math.round(i.rateIls * 100)}`),
    "",
  ].join("\n");

  const names = i.rows.map((r) => r.event.name).join(" + ");
  return {
    subject: `${i.splitPay ? "[SPLIT PAYMENT] " : ""}${hold ? `New Euro Trip Hold (24h) - ${names}` : `New Euro Trip Order (pay now) - ${names}`}`,
    text,
  };
}

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const usd = (n: number): string => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const ils = (n: number): string => `₪${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const TD = 'style="padding: 6px 0; color: #444444; text-align: right; direction: rtl; font-size: 15px; line-height: 1.5;" dir="rtl"';
const H2 =
  'style="color: #0A1A14; font-size: 17px; font-weight: 800; margin: 22px 0 8px 0; padding-bottom: 8px; border-bottom: 2px solid #EEF6F0; text-align: right; direction: rtl;" dir="rtl"';

const rowsHtml = (lines: string[]): string =>
  `<table role="presentation" style="width: 100%; border-collapse: collapse; direction: rtl;" dir="rtl">${lines
    .map((l) => `<tr><td ${TD}>${l}</td></tr>`)
    .join("")}</table>`;

/** The customer's email: the request was received, a rep calls within 24 hours, the whole trip. */
export function tripHoldMail(i: TripMailInput): { subject: string; html: string } {
  const events = i.rows.map((r) => {
    const t = r.info;
    return `<strong style="color: #0A1A14;">${r.seq}. ${esc(r.event.name)}</strong><br>${esc(dayMonthYear(eventDay(r.event)))} · ${esc(
      t.location_name,
    )} · ${esc(t.zone_label || t.category)} × ${esc(t.number_of_ticket)}`;
  });

  const airline = i.flight.metadata?.name || i.flight.airline || "";
  const flights = [
    ...(i.flight.legs ?? []).map(
      (leg) =>
        `<span dir="ltr" style="unicode-bidi: embed;">${esc(leg.departureAirport)} → ${esc(leg.arrivalAirport)}</span> · ${esc(
          dayMonthYear(leg.departureTime.slice(0, 10)),
        )} <span dir="ltr" style="unicode-bidi: embed;">${esc(leg.departureTime.slice(11, 16))}</span>${
          leg.flightNumber ? ` · <span dir="ltr" style="unicode-bidi: embed;">${esc(leg.flightNumber)}</span>` : ""
        }${airline ? ` · ${esc(airline)}` : ""}`,
    ),
    ...i.trainLegs.map(
      (t) => `הגעה עצמאית: ${esc(t.fromName)} ← ${esc(t.toName)} · ${esc(dayMonth(t.date))} · בכוחות עצמכם, לא כלול במחיר`,
    ),
  ];

  const hotels = i.hotels.map(({ city, hotel }) => {
    const nights = nightsOf(hotel);
    return `<strong style="color: #0A1A14;">${esc(city)}:</strong> <span dir="ltr" style="unicode-bidi: embed;">${esc(hotel.name)}</span><br>${esc(
      dayMonth(String(hotel.checkin).slice(0, 10)),
    )}–${esc(dayMonth(String(hotel.checkout).slice(0, 10)))}${Number.isFinite(nights) ? ` · ${nights === 1 ? "לילה אחד" : `${nights} לילות`}` : ""}${
      roomsLabel(hotel.guests) ? ` · ${esc(roomsLabel(hotel.guests))}` : ""
    }`;
  });

  const party = i.pax === 1 ? "לנוסע אחד" : `ל-${i.pax} נוסעים`;

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>מגה איבנטס - בקשת טיול</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #EEEDE6; direction: rtl;" dir="rtl">
<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #EEEDE6; direction: rtl;" dir="rtl"><tr><td style="padding: 24px 12px; direction: rtl;" dir="rtl">
<table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; border-collapse: collapse; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; direction: rtl;" dir="rtl">
<tr><td style="background-color: #0A1A14; padding: 20px; text-align: center; color: #FFFFFF; font-size: 22px; font-weight: 800; direction: rtl;" dir="rtl">מגה איבנטס</td></tr>
<tr><td style="padding: 24px 20px; text-align: right; direction: rtl;" dir="rtl">
<h1 style="color: #0A1A14; font-size: 24px; margin: 0 0 12px 0; text-align: center; direction: rtl;" dir="rtl">קיבלנו את הבקשה</h1>
<p style="color: #333333; font-size: 16px; margin: 0 0 8px 0; text-align: center; direction: rtl;" dir="rtl">שלום ${esc(i.contact.firstName)},</p>
<p style="color: #333333; font-size: 16px; margin: 0 0 8px 0; text-align: center; direction: rtl;" dir="rtl">קיבלנו את הבקשה. נציג יחזור אליכם תוך 24 שעות.</p>
${
  i.splitPay
    ? `<p style="color: #333333; font-size: 16px; margin: 0 0 8px 0; text-align: center; direction: rtl;" dir="rtl">ביקשתם לפצל את התשלום - הנציג יתאם זאת איתכם בשיחה.</p>`
    : ""
}
${
  i.reference
    ? `<p style="color: #666666; font-size: 15px; margin: 0 0 8px 0; text-align: center; direction: rtl;" dir="rtl">מספר הבקשה: <strong style="color: #0A1A14; unicode-bidi: embed;" dir="ltr">${esc(i.reference)}</strong></p>`
    : ""
}
<h2 ${H2}>האירועים</h2>
${rowsHtml(events)}
<h2 ${H2}>טיסות</h2>
${rowsHtml(flights)}
<h2 ${H2}>מלונות</h2>
${rowsHtml(hotels)}
<table role="presentation" width="100%" style="border-collapse: separate; margin-top: 18px; direction: rtl;" dir="rtl"><tr><td style="background-color: #F2FBF5; border: 1px solid #D6F3E1; border-radius: 10px; padding: 13px 16px; text-align: right; direction: rtl;" dir="rtl"><strong style="color: #0A1A14; font-size: 15px;">מחיר כולל ${party}:</strong> <span style="color: #0A1A14; font-size: 18px; font-weight: 800; unicode-bidi: embed;" dir="ltr">${esc(
    usd(i.totalUsd),
  )}</span> <span style="color: #666666; font-size: 14px; unicode-bidi: embed;" dir="ltr">(${esc(ils(i.totalIls))})</span></td></tr></table>
<p style="color: #666666; font-size: 13px; margin: 14px 0 22px 0; text-align: right; direction: rtl;" dir="rtl">התשלום נעשה מול הנציג. המחירים והמקומות אינם מובטחים לאחר 24 השעות ועלולים להשתנות.</p>
<div style="text-align: center; color: #666666; font-size: 14px; direction: rtl;" dir="rtl">
<p style="margin: 0 0 6px 0;">לשאלות ובירורים:</p>
<p style="margin: 0;">טלפון: <a href="tel:+972-3-768-4800" style="color: #0A1A14; text-decoration: none;"><span style="unicode-bidi: embed;" dir="ltr">03-768-4800</span></a><br>
אימייל: <a href="mailto:reservations@mega-events.co.il" style="color: #0A1A14; text-decoration: none;">reservations@mega-events.co.il</a></p>
</div>
</td></tr>
<tr><td style="background-color: #0A1A14; padding: 18px; text-align: center; color: #FFFFFF; font-size: 12px; direction: rtl;" dir="rtl">מגה איבנטס מבית מגה תיירות. כל הזכויות שמורות.</td></tr>
</table>
</td></tr></table>
</body>
</html>`;

  return { subject: "קיבלנו את בקשת הטיול - נחזור אליכם תוך 24 שעות | מגה איבנטס", html };
}

/** Where both emails come from - confirm-order's sender. */
const FROM = '"MegaEvents Reservations" <reservations@mega-events.co.il>';

const errText = (e: unknown): string => (e instanceof Error ? e.message : JSON.stringify(e));

/**
 * Sends the ops email (always) and the customer's hold email (`customer`). Never throws: each
 * failure is logged; the answer says what went out.
 */
export async function sendTripEmails(i: TripMailInput, opts: { customer: boolean }): Promise<{ ops: boolean; customer: boolean }> {
  const sent = { ops: false, customer: false };
  let transporter: ReturnType<typeof nodemailer.createTransport>;
  try {
    transporter = nodemailer.createTransport({
      host: "smtp.zeptomail.com",
      port: 587,
      auth: { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD },
    });
  } catch (e) {
    console.warn("[itinerary/confirm] mail transport failed (non-fatal):", errText(e));
    return sent;
  }
  try {
    const m = tripOpsMail(i);
    await transporter.sendMail({ from: FROM, to: process.env.SALES_REP_EMAIL, subject: m.subject, text: m.text });
    sent.ops = true;
  } catch (e) {
    console.warn("[itinerary/confirm] ops email failed (non-fatal):", errText(e));
  }
  if (opts.customer) {
    try {
      const m = tripHoldMail(i);
      await transporter.sendMail({
        from: FROM,
        replyTo: process.env.SALES_REP_EMAIL,
        to: i.contact.email,
        subject: m.subject,
        html: m.html,
      });
      sent.customer = true;
    } catch (e) {
      console.warn("[itinerary/confirm] customer email failed (non-fatal):", errText(e));
    }
  }
  return sent;
}
