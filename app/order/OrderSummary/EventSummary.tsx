import { formatPrice } from "@/lib/price.utils";

export const EventSummary = ({
  numberOfEventTickets,
  eventTicket,
  agentCommission,
  eventTicketPriceAddition,
}: {
  numberOfEventTickets: number;
  eventTicket: {
    category: string;
    description?: string;
  };
  agentCommission: number;
  eventTicketPriceAddition: number;
}) => {
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
          <div className="flex gap-[2px]">
            <div className="ml-1">
              {eventTicket.category || eventTicket.description}
            </div>
            {agentCommission <= 0 && (
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
          {agentCommission <= 0 && (
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
