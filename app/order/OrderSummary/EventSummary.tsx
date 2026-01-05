import { formatPrice } from "@/lib/price.utils";
import { isMobile } from "react-device-detect";

export const EventSummary = ({
  eventTitle,
  eventSubtitle,
  numberOfEventTickets,
  totalTickets,
  eventTicket,
  agentCommission,
  eventTicketPriceAddition,
  isBundle,
  bundleLines,
}: {
  eventTitle?: string;
  eventSubtitle?: string;
  numberOfEventTickets: number;
  totalTickets?: number;
  eventTicket: {
    category: string;
    description?: string;
  };
  agentCommission: number;
  eventTicketPriceAddition: number;
  isBundle?: boolean;
  bundleLines?: Array<{
    label: string;
    category?: string;
    locationText?: string;
    dateText?: string;
    quantity?: number;
  }>;
}) => {
  const unitLabel = "לכרטיס";

  return (
    <div className="">
      {eventTitle ? (
        <div className="mb-2" dir="rtl">
          <div className="font-bold text-lg">{eventTitle}</div>
          {eventSubtitle ? (
            <div className="text-sm font-semibold text-muted-foreground">{eventSubtitle}</div>
          ) : null}
        </div>
      ) : null}
      <h3 className="font-bold text-lg hidden md:block">
        כרטיסים{" "}
        <span>
          {"("}
          {isBundle ? (totalTickets ?? numberOfEventTickets) : numberOfEventTickets}
          {" כרטיסים)"}
        </span>
      </h3>

      {isBundle && bundleLines && bundleLines.length > 0 ? (
        <div className="mb-2 space-y-1" dir="rtl">
          {bundleLines.map((l) => (
            <div key={l.label} className="text-[14px]">
              <div className="font-semibold">{l.label}</div>
              {isMobile ? (
                <div className="text-[13px] text-muted-foreground" dir="rtl">
                  {l.dateText ? <span dir="ltr">,{l.dateText}</span> : null}
                  {l.category ? <span className="mr-2">{l.category}</span> : null}
                  {typeof l.quantity === "number" ? <span className="mr-0.5">({l.quantity}x)</span> : null}
                  {l.locationText ? <span className="mr-1">- {l.locationText}</span> : null}
                </div>
              ) : (
                <div dir="rtl">
                  {l.dateText ? (<span dir="ltr">,{l.dateText}</span>) : null}
                  {l.category ? <span className="mr-2">{l.category}</span> : null}
                  {typeof l.quantity === "number" ? (
                    <span className="mr-1 text-muted-foreground">({l.quantity}x)</span>
                  ) : null}
                  {l.locationText ? <span className="mr-1">- {l.locationText}</span> : null}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex justify-between items-center w-full">
        <div
          className="flex w-full justify-between gap-1"
          dir="rtl"
        >
          <div className="flex gap-[2px]">
            <div className="ml-1">
              {!isBundle ? eventTicket.description : null}
            </div>
            {agentCommission <= 0 && (
              <div>
                {!isBundle && eventTicketPriceAddition ? (
                  <>
                    ({formatPrice(eventTicketPriceAddition)}
                    )/{unitLabel}
                  </>
                ) : (
                  ""
                )}
              </div>
            )}
          </div>
          {agentCommission <= 0 && (
            <div>
              {eventTicketPriceAddition
                ? (isBundle
                    ? formatPrice(eventTicketPriceAddition, {
                        factor: 1,
                        applyColor: false,
                        bold: false,
                      })
                    : formatPrice(eventTicketPriceAddition, {
                        factor: numberOfEventTickets,
                        applyColor: false,
                        bold: false,
                      }))
                : "כלול במחיר"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
