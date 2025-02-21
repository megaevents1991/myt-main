"use client";

import { Suspense, useContext } from "react";
import { OrderForm } from "./OrderForm";
import { Event } from "@/lib/app.types";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/he";
import { OrderContext } from "../app.context";

export default function OrderPage() {
  const { event } = useContext(OrderContext);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DatesProvider
        settings={{
          locale: "he",
          firstDayOfWeek: 0,
          weekendDays: [6],
          timezone: "Israel",
        }}
      >
        {event && <OrderForm event={event as Event} />}
      </DatesProvider>
    </Suspense>
  );
}
