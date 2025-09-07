import { contentfulClient } from "@/lib/contentful";
import { FootballFields } from "@/lib/app.types";
import { notFound } from "next/navigation";
import Image from "next/image";
import { BLOCKS, MARKS, Document } from "@contentful/rich-text-types";
import {
  documentToReactComponents,
  Options,
} from "@contentful/rich-text-react-renderer";
import { ReactNode } from "react";
import dayjs from "dayjs";
import Link from "next/link";
import { getEventsByName } from "@/lib/eventsData";
import ClientTracker from "../../../components/ClientTracker";
import EventButton from "../../../components/EventButton";
import CacheValidator from "../../../components/CacheValidator";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const { items } = await contentfulClient.getEntries({
      content_type: "footballTeamTemplate",
    });

    return items.map((item) => ({
      slug: item.sys.id,
    }));
  } catch (error) {
    console.error('Error generating static params for football teams:', error);
    return [];
  }
}

export default async function FootballPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  // Add timestamp for cache validation
  const timestamp = Date.now();
  
  try {
    const team = await contentfulClient.getEntry<FootballFields>(slug);

  if (!team || !team.fields) {
    notFound();
  }

  const { name, nameDBenglish, bio } = team.fields;
  
  // Defensive checks for required fields
  if (!name || !nameDBenglish) {
    console.error('Football team missing required fields:', { slug, name, nameDBenglish });
    notFound();
  }
  
  const bioDocument = bio as Document;

  const { events } = await getEventsByName(String(nameDBenglish));

  const Bold = ({ children }: { children: ReactNode }) => (
    <span className="font-bold">{children}</span>
  );

  const Text = ({ children }: { children: ReactNode }) => (
    <p className="align-center">{children}</p>
  );

  const options: Options = {
    renderMark: {
      [MARKS.BOLD]: (text: ReactNode): ReactNode => <Bold>{text}</Bold>,
    },
    renderNode: {
      [BLOCKS.PARAGRAPH]: (_node: unknown, children: ReactNode): ReactNode => (
        <Text>{children}</Text>
      ),
    },
  };

  return (
    <div dir="rtl" className="container mx-auto py-8 px-4">
      <ClientTracker />
      <CacheValidator pageId={slug} />
      {/* Add invisible element with timestamp for client checking */}
      <div id="page-timestamp" data-timestamp={timestamp} style={{ display: 'none' }} />
      <h1 className="text-4xl font-bold mb-4">{name}</h1>
      <div className="prose max-w-none">
        {documentToReactComponents(bioDocument, options)}
      </div>
      {/* Event Card Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-secondary mb-6">
          אירועים קרובים
        </h2>
        {events.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={
                  event.tags === "Sold"
                    ? "#no-op"
                    : `/order/${event.id}`
                }
                className={`${
                  event.tags === "Sold" ? "cursor-default" : "cursor-pointer"
                }`}
              >
                <EventButton event={event}>
                  <div className="rounded-lg shadow-lg flex flex-row-reverse sm:flex-col hover:shadow-xl hover:outline hover:outline-main">
                    <div
                      className="relative group overflow-hidden rounded-l-lg sm:rounded-t-lg sm:rounded-b-none w-[48%] sm:w-auto"
                      dir="rtl"
                    >
                      {event.tags === "LastTickets" && (
                        <div className="absolute top-0 left-0 w-64 h-10 bg-secondary text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5">
                          כרטיסים אחרונים!
                        </div>
                      )}
                      {event.tags === "Popular" && (
                        <div className="absolute top-0 left-0 w-64 h-10 bg-secondary text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5">
                          נמכר במהירות!
                        </div>
                      )}
                      {event.tags === "Restock" && (
                        <div className="absolute top-0 left-0 w-64 h-10 bg-[#52C4A3] text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5">
                          חזר למלאי!
                        </div>
                      )}
                      {event.tags === "VIP" && (
                        <div className="absolute top-0 left-0 w-64 h-10 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5">
                          אירוח VIP
                        </div>
                      )}
                      {event.tags === "Sold" && (
                        <div className="absolute top-0 left-0 w-64 h-10 bg-[#d63a59] text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5">
                          אזלו הכרטיסים
                        </div>
                      )}
                      <Image
                        src={event.card_image_url}
                        alt={name}
                        priority={true}
                        width={400}
                        height={300}
                        style={{
                          objectPosition: 'center top' // or 'center center', '20% 30%', etc.
                        }}
                        className="object-cover w-full h-72 transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-col text-center w-[52%] sm:w-auto">
                      <div
                        className="p-2 text-2xl font-bold"
                        style={{ lineHeight: "1.1" }}
                      >
                        {event.name}
                      </div>
                      <div className="py-1 px-2 bg-secondary font-semibold text-white flex flex-wrap justify-center items-center">
                        <span>
                          {event.date
                            ? dayjs(event.date).format("DD/MM/YYYY")
                            : "תאריך יפורסם בקרוב"}
                        </span>
                        <span className="sm:inline hidden mx-2">|</span>
                        <span className="w-full sm:w-auto whitespace-nowrap">
                          {event.location.name}
                        </span>
                      </div>
                      <div className="p-2 text-center flex flex-col flex-grow">
                        <div className="text-sm sm:text-base">
                          מחיר חבילה ממוצע לאדם
                        </div>
                        <div className="text-2xl font-extrabold">
                          $
                          {(
                            event.base_flight_price +
                            event.base_hotel_price +
                            Math.min(
                              ...event.tickets_and_rates.map(
                                (ticket) => ticket.price
                              )
                            ) +
                            Number(process.env.NEXT_PUBLIC_MARKUP || "175")
                          ).toLocaleString("en-US")}
                        </div>
                        <div className="flex-grow min-h-[4px]"></div>
                        <div
                          className="text-[14px]"
                          style={{ lineHeight: "1.1" }}
                        >
                          לנוסע, עבור טיסה, מלון וכרטיס לאירוע (בהרכב זוגי)
                        </div>
                        {event.tags === "Sold" ? (
                          <div className="my-2 py-2 flex-shrink-0 h-[22px] sm:h-[40px]"></div>
                        ) : (
                          <>
                            <div className="bg-[#002240] text-[14px] font-bold mx-1 my-2 justify-center text-white rounded-lg px-4 py-2 flex items-center sm:hidden">
                              הוזילו או שדרגו כאן {"  >"}
                            </div>
                            <u className="my-2 flex justify-center text-[#178189] text-[14px] font-bold hidden sm:flex">
                              הוזילו או שדרגו כאן {"  >"}
                            </u>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </EventButton>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">אין אירועים קרובים</p>
        )}
      </div>
    </div>
  );
  } catch (error) {
    // Log the error for debugging but don't crash the server
    console.error('Error fetching football team:', error);
    notFound();
  }
}
