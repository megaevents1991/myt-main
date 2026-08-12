import { formatPrice } from "@/lib/price.utils";

export const EventSummary = ({
  numberOfEventTickets,
  eventTicket,
  agentCommission,
  isAgent,
  eventTicketPriceAddition,
}: {
  numberOfEventTickets: number;
  eventTicket: {
    category: string;
    description?: string;
  };
  agentCommission: number;
  /** Any signed agent code - commission may be 0. Falls back to commission>0. */
  isAgent?: boolean;
  eventTicketPriceAddition: number;
}) => {
  // The per-item price-addition breakdown is retail-customer-only - hidden
  // from every agent, including 0%-commission ones.
  const agentViewer = isAgent ?? agentCommission > 0;
  return (
    <div className="">
      <h3 className="font-bold text-lg hidden md:block">
        כרטיסים{" "}
        <span>
          {"("}
          {numberOfEventTickets}
          {" כרטיסים)"}
        </span>
      </h3>
      <div className="flex justify-between items-center w-full">
        <div
          className="flex w-full justify-between gap-1"
          dir="rtl"
        >
          <div>
            <div className="flex gap-[2px]">
            <div className="ml-1">
              {eventTicket.category}
            </div>
            {!agentViewer && (
              <div>
                {eventTicketPriceAddition ? (
                  <>
                    ({formatPrice(eventTicketPriceAddition)}
                    )/לכרטיס
                  </>
                ) : (
                  ""
                )}
              </div>
            )}
          </div>
            <p className="text-[14px]" dir="rtl">
              {eventTicket.description}
            </p>
          </div>
          {!agentViewer && (
            <div>
              {eventTicketPriceAddition
                ? formatPrice(eventTicketPriceAddition, {
                    factor: numberOfEventTickets,
                    applyColor: false,
                    bold: false,
                  })
                : "כלול במחיר"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
