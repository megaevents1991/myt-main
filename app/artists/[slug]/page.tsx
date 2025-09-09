import { contentfulClient } from "@/lib/contentful";
import { ArtistFields } from "@/lib/app.types";
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
import EventButton from "../../../components/EventButton";
import ClientTracker from "../../../components/ClientTracker";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const { items } = await contentfulClient.getEntries({
      content_type: "artistTemplate",
    });

    return items.map((item) => ({
      slug: item.sys.id,
    }));
  } catch (error) {
    console.error('Error generating static params for artists:', error);
    return [];
  }
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  // Add timestamp for cache validation
  const timestamp = Date.now();
  
  try {
    const artist = await contentfulClient.getEntry<ArtistFields>(slug);

    if (!artist || !artist.fields) {
      notFound();
    }

    const { name, nameDBenglish, bio } = artist.fields;
    
    // Defensive checks for required fields
    if (!name || !nameDBenglish) {
      console.error('Artist missing required fields:', { slug, name, nameDBenglish });
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
    <main dir="rtl" className="container mx-auto py-8 px-4">
      <ClientTracker />
      {/* Add invisible element with timestamp for client checking */}
      <div id="page-timestamp" data-timestamp={timestamp} style={{ display: 'none' }} />
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{name}</h1>
        <section className="prose max-w-none" aria-labelledby="artist-bio">
          <h2 id="artist-bio" className="sr-only">ביוגרפיה</h2>
          {documentToReactComponents(bioDocument, options)}
        </section>
      </header>
      {/* Event Card Section */}
      <section className="mt-12" aria-labelledby="upcoming-events">
        <h2 id="upcoming-events" className="text-2xl font-bold text-secondary mb-6">
          אירועים קרובים
        </h2>
        {events.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="רשימת אירועים קרובים">
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
                aria-label={event.tags === "Sold" ? `אירוע - אזל מהמלאי` : `הזמנת כרטיסים לאירוע`}
                role="listitem"
              >
                <EventButton event={event}>
                  <article className="rounded-lg shadow-lg flex flex-row-reverse sm:flex-col hover:shadow-xl hover:outline hover:outline-main">
                    <div
                      className="relative group overflow-hidden rounded-l-lg sm:rounded-t-lg sm:rounded-b-none w-[48%] sm:w-auto"
                      dir="rtl"
                    >
                      {event.tags === "LastTickets" && (
                        <div className="absolute top-0 left-0 w-64 h-10 bg-secondary text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5" aria-label="כרטיסים אחרונים זמינים">
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
                        {event.date
                          ? dayjs(event.date).format("DD/MM/YYYY")
                          : "תאריך יפורסם בקרוב"}
                      </div>
                      <div className="py-1 px-2 bg-secondary text-white font-semibold flex flex-wrap text-lg justify-center items-center">
                        {event.location.name}
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
                          <div className="my-2 py-2 flex-shrink-0 h-[22px] sm:h-[23px]"></div>
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
                  </article>
                </EventButton>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500" role="status" aria-live="polite">אין אירועים קרובים</p>
        )}
      </section>
    </main>
  );
  } catch (error) {
    // Log the error for debugging but don't crash the server
    console.error('Error fetching artist:', error);
    notFound();
  }
}
