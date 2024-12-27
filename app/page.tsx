"use client";

import Image from "next/image";
import { events as staticEvents } from "@/lib/events-data";
import { AppShell } from "@mantine/core";
import { useState } from "react";
import Link from "next/link";

export default function Home() {
  // Use the staticEvents directly instead of fetching
  const events = staticEvents;
  const [search, setSearch] = useState("");

  return (
    <AppShell>
      <main>
        <section className="w-full py-6 md:py-12 lg:py-18 xl:py-22 px-4 md:px-6 text-white bg-main relative">
          <div className="container mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-4">
              <span> כל האירועים השווים בחו״ל</span>
              <span className="text-secondary whitespace-nowrap text-5xl">
                {" "}
                במקום אחד
              </span>
            </h1>
            <p className="text-3xl tracking-tighter sm:text-4xl md:text-5xl mb-4 mb-8">
              !בחרו ותתחילו לתכנן
            </p>
          </div>
          <div className="w-full max-w-sm lg:max-w-xl mx-auto space-y-2 absolute bottom-0 left-0 right-0 transform translate-y-1/2 min-w-70">
            <form className="flex center shadow-md" dir="rtl">
              <input
                onChange={(e) => setSearch(e.target.value)}
                value={search}
                placeholder="חפש אירוע..."
                type="text"
                className="w-2/3 rounded-r p-2 text-main border"
              />
              <button className="w-1/3 bg-secondary text-main rounded-l">
                בוא נתחיל לתכנן!
              </button>
            </form>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800 px-4 md:px-6">
          <div className="container mx-auto">
            <div className="flex flex-row justify-end items-stretch">
              <div>
                <h2 className="text-2xl font-bold text-secondary tracking-tighter sm:text-4xl text-center mb-8 mx-2">
                  אירועים חמים
                </h2>
              </div>
              <div
                className="bg-secondary mx-1"
                style={{ height: 40, width: 23 }}
              />
              <div
                className="bg-secondary  mx-1"
                style={{ height: 40, width: 23 }}
              />
              <div
                className="bg-secondary  mx-1"
                style={{ height: 40, width: 46 }}
              />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <Link
                  href={`/order?eventId=${event.id}`}
                  className="cursor-pointer"
                  key={event.id}
                >
                  <div className="rounded-lg shadow-lg flex flex-row sm:flex-col ">
                    <div className="relative group overflow-hidden rounded-t-lg w-1/2 sm:w-auto">
                      <Image
                        src={event.imageUrl}
                        alt={event.name}
                        width={400}
                        height={300}
                        className="object-cover w-full h-60 transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity group-hover:bg-opacity-75" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                            {event.name}
                          </h3>
                          <p className="text-white mb-4">
                            {event.location.name} • {event.date}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-col text-center w-1/2 sm:w-auto">
                      <div className="p-2 px-4 font-bold">{event.name}</div>
                      <div className="py-1 bg-secondary ">
                        {event.date} | {event.location.name}
                      </div>
                      <div className="p-2 px-4 text-right" dir="rtl">
                        <div>בממוצע כ-</div>
                        <div className="whitespace-pre">
                          <span className="text-sm line-through">$1000</span>
                          <span className="text-xl font-bold">
                            ${event.tickets[0].price}
                          </span>
                        </div>
                        <div>לנוסע כולל טיסה, מלון וכרטיס למופע</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
