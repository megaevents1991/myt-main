import { NextResponse } from "next/server";
import { amadeus } from "../amadeusClient";

export const maxDuration = 30;

type BaggageItem = {
  quantity: number;
  name: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  bookableByItinerary: boolean;
  segmentIds: string[];
  travelerIds: string[];
};

// El Al online (Amadeus/virtual) cancellation texts - El Al files NO
// detailed-fare-rules via Amadeus (verified 1.9.26 on a priced LY LITE offer),
// so these ARE the rules shown, per Dor 1.9.26. Which one applies depends on
// whether the FARE includes a checked bag (LITE = no bag, CLASSIC = bag).
const ELAL_ONLINE_NO_BAG_PENALTIES = `PE.PENALTIES
  CANCELLATIONS
  FULL CANCELLATION FEES APPLY FROM THE MOMENT OF BOOKING, SUBJECT TO THE ISRAELI CONSUMER PROTECTION LAW.
  FOR MORE INFORMATION PLEASE VISIT WWW.ELAL.COM/HEB/LEGAL/TICKET-CANCELLATION`;

const ELAL_ONLINE_WITH_BAG_PENALTIES = `PE.PENALTIES
  CANCELLATIONS
  UP TO 48 HOURS PRIOR TO DEPARTURE, CANCELLATION IS POSSIBLE AT A COST OF $120 PER PASSENGER.
  LESS THAN 48 HOURS PRIOR TO DEPARTURE, FULL CANCELLATION FEES APPLY.
  SUBJECT TO THE ISRAELI CONSUMER PROTECTION LAW.
  FOR MORE INFORMATION PLEASE VISIT WWW.ELAL.COM/HEB/LEGAL/TICKET-CANCELLATION`;

// Generic fallback - offline non-El-Al inventory, and any Amadeus-priced offer
// whose fare rules came back without a PENALTIES note (or whose pricing call
// failed). The Penalties dialog on the summary must never render empty.
const GENERIC_PENALTIES = `PE.PENALTIES
  CANCELLATIONS
  45 DAYS OR MORE BEFORE DEPARTURE CHARGE USD 100.00 FOR CANCELLATIONS PER TICKET.
  44-30 DAYS BEFORE DEPARTURE CHARGE USD 250.00 FOR CANCELLATIONS PER TICKET.
  LESS THAN 30 DAYS BEFORE DEPARTURE NON-REFUNDABLE.
  CHANGES
  BEFORE DEPARTURE CHARGE USD 120.00 FOR REISSUE/REVALIDATION. NOTE - WHEN THE FIRST FLIGHT COUPON IS BEING CHANGED NEW FARE WILL BE RECALCULATED USING FARES AND IATA RATE OF EXCHANGE IN EFFECT ON THE DATE OF REISSUE.
  AFTER DEPARTURE CHARGE USD 120.00 FOR REISSUE/REVALIDATION. CHARGE USD 200.00 FOR NO-SHOW. NOTE - BEFORE EXPIRY OF FLIGHT COUPON. UPGRADE TO ANY HIGHER FARE PERMITTED IN WHICH CASE CHANGE OF RESERVATION FEE OF USD 120.00 WILL ALSO APPLY. ------------------------------------------------ THE AP THE SECURITY AND INSURANCE SURCHARGE WHICH IS COLLECTED IN THE TFC AREA OF THE TICKET IS NOT REFUNDABLE. UNLESS THE TICKETS FARE IS FULLY REFUNDABLE `;

export async function POST(request: Request) {
  const {
    flightOffer,
    virtual,
    eventId,
  }: {
    flightOffer: FlightOffer;
    virtual: boolean;
    eventId?: number | string;
  } = await request.json();

  if (!amadeus) {
    return NextResponse.json(
      {
        error:
          "Amadeus client is not initialized. Check your environment variables.",
      },
      { status: 500 },
    );
  }
  if (virtual) {
    // Virtual = manually-modeled El Al package offers - sold with a checked
    // bag, so the with-bag terms apply.
    return NextResponse.json({
      bags: 65,
      penalties: ELAL_ONLINE_WITH_BAG_PENALTIES,
    });
  }

  // Offline flights (backoffice inventory) reach here with an EMPTY offer
  // ({}) - there is no Amadeus fare to read rules from, and OUR terms apply
  // to that inventory (Dor 1.9: the generic 45/30-day text IS the offline
  // policy, El Al offline included). Never dereference flightOffer.* here -
  // that was the crash that 500'ed every offline flight and blanked the
  // Penalties dialog on the summary.
  if (!flightOffer || Object.keys(flightOffer).length === 0) {
    return NextResponse.json({ bags: 65, penalties: GENERIC_PENALTIES });
  }

  // El Al online: Amadeus carries no fare rules for LY, so OUR texts are the
  // rules - picked by whether the fare itself includes a checked bag on every
  // segment (same test as bag-pricing's branded-fare check: LITE fails it,
  // CLASSIC passes). Missing data defaults to the STRICTER no-bag text.
  const validating = flightOffer.validatingAirlineCodes?.[0];
  const fareSegs = flightOffer.travelerPricings?.[0]?.fareDetailsBySegment ?? [];
  const fareIncludesBag =
    fareSegs.length > 0 &&
    fareSegs.every(
      (s) =>
        (s.includedCheckedBags?.quantity ?? 0) >= 1 ||
        (s.includedCheckedBags?.weight ?? 0) > 0,
    );
  if (validating === "LY") {
    return NextResponse.json({
      bags: 65,
      penalties: fareIncludesBag
        ? ELAL_ONLINE_WITH_BAG_PENALTIES
        : ELAL_ONLINE_NO_BAG_PENALTIES,
    });
  }

  // Non-LY fallback for a live offer whose rules are unavailable.
  const fallbackPenalties = GENERIC_PENALTIES;
  try {
    // Amadeus per-request client reference (ama-Client-Ref) - required by the
    // production-certification checklist. Falls back to a time-only ref if the
    // caller didn't send an eventId.
    const clientRef = eventId
      ? `MYT-${eventId}-${Math.floor(Date.now() / 1000)}`
      : `MYT-${Math.floor(Date.now() / 1000)}`;

    const response = await amadeus.shopping.flightOffers.pricing.post(
      {
        data: {
          type: "flight-offers-pricing",
          flightOffers: [flightOffer],
        },
      },
      { include: ["bags", "detailed-fare-rules"], clientRef },
    );

    // processing the response and returning it to the client.
    const data = JSON.parse(response.body);
    // Fare rules are keyed per segment ("1","2",...) - take the first rule
    // that carries a PENALTIES note, not blindly segment "1" (which can be
    // the one segment filed without it).
    const fareRules = Object.values(
      data.included?.["detailed-fare-rules"] ?? {},
    ) as Array<{
      fareNotes?: { descriptions?: Array<{ descriptionType?: string; text?: string }> };
    }>;
    const penalties = fareRules
      .flatMap((rule) => rule.fareNotes?.descriptions ?? [])
      .find((desc) => desc.descriptionType === "PENALTIES")?.text;

    if (!penalties) {
      console.warn("No PENALTIES fare note in the pricing response.", {
        itineraries: flightOffer.itineraries,
        ruleCount: fareRules.length,
      });
    }

    const bagCostString = (
      Object.values(data?.included?.["bags"] ?? {}) as BaggageItem[]
    ).find((item) => item.quantity === 1 && item.name === "CHECKED_BAG")?.price
      ?.amount;
    let bags = parseInt(bagCostString || "0");
    if (bags) {
      bags = bags + 5;
    } // TODO: convert euro to USD

    // Never hand the summary an empty Penalties dialog - fall back to the
    // carrier-appropriate static text when no PENALTIES note was filed.
    return NextResponse.json({
      bags,
      penalties: penalties || fallbackPenalties,
    });
  } catch (error) {
    console.error("Error fetching flights:", error);
    // Fail SOFT: the Penalties dialog is a legal-terms display, not a price -
    // a pricing hiccup must not blank it (the old 500 left the dialog empty).
    return NextResponse.json({ bags: 65, penalties: fallbackPenalties });
  }
}
