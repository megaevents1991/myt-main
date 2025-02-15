"use client";

import Image from "next/image";
import Link from "next/link";
import { useAffiliate, orderStage } from "../app/hooks/Affiliate";
import dayjs from "dayjs";
import { useMediaQuery } from "@mantine/hooks";
import { useState, useEffect, useRef } from "react";
import { useStatsigClient } from "@statsig/react-bindings";
import { Event } from "@/lib/app.types";
import { Combobox, Modal, useCombobox } from "@mantine/core";
import { ArrowLeftIcon } from "lucide-react";
import { Dispatch, RefObject, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MYT } from "./ui/myt";

interface Props {
  initialEvents: Event[];
}

const SearchCombobox = ({
  searchValue,
  setSearchValue,
  events,
  ref,
  inline,
  onOpenFeedbackModal,
}: {
  setSearchValue: Dispatch<SetStateAction<string>>;
  events: Event[];
  searchValue: string;
  ref?: RefObject<HTMLInputElement>;
  inline?: boolean;
  onOpenFeedbackModal: () => void;
  mobile?: boolean;
}) => {
  const router = useRouter();
  const combobox = useCombobox();

  const filteredOptions = events.filter(({ name, location }) => {
    const value = searchValue.toLowerCase().trim();
    return (
      name.toLowerCase().includes(value) ||
      location.name.toLowerCase().includes(value)
    );
  });

  const options = filteredOptions.map((item) => (
    <Combobox.Option
      value={item.id.toString()}
      key={item.id}
      style={{ textAlign: "right" }}
    >
      <span className="font-bold">{item.name}</span>
      <br />
      {item.date} | {item.location.name}
    </Combobox.Option>
  ));

  return (
    <Combobox
      onOptionSubmit={(optionValue) => {
        if (optionValue === "feedback") {
          onOpenFeedbackModal();
        } else {
          setSearchValue(
            events.find((item) => item.id.toString() === optionValue)?.name ||
              ""
          );
          router.push(`/order?eventId=${optionValue}`);
        }
      }}
      store={combobox}
    >
      <Combobox.Target>
        <input
          ref={ref}
          className={cn(
            "w-full",
            inline ? "rounded-r" : "rounded border-secondary",
            "p-2 text-main border"
          )}
          dir="rtl"
          placeholder="חפש אירוע..."
          value={searchValue}
          onChange={(event) => {
            setSearchValue(event.currentTarget.value);
            if (event.currentTarget.value.length > 1) {
              combobox.openDropdown();
            } else {
              combobox.closeDropdown();
            }
            combobox.updateSelectedOptionIndex();
          }}
          onClick={() => searchValue.length > 1 && combobox.openDropdown()}
          onFocus={() => searchValue.length > 1 && combobox.openDropdown()}
          onBlur={() => combobox.closeDropdown()}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options>
          {options}
          <Combobox.Option value="feedback" style={{ textAlign: "right" }}>
            לא מצאתם מה שחיפשתם? ספרו לנו
          </Combobox.Option>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
};

export function ClientSideHomepage({ initialEvents }: Props) {
  const matches = useMediaQuery("(min-width: 768px)");
  const [searchValue, setSearchValue] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [feedbackInSearchModal, setfeedbackInSearchModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const mobileComboboxRef = useRef<HTMLInputElement>(null);
  const { client } = useStatsigClient();
  const [errorDebug, setErrorDebug] = useState(Object);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleSearchModalOpen = () => {
    setShowSearchModal(true);
    setTimeout(() => {
      mobileComboboxRef.current?.focus();
    }, 100);
  };

  useEffect(() => {
    window.onerror = function (message, source, lineno, colno, error) {
      setErrorDebug({ message, error });
      console.error("Global error caught:", message, error);
    };
  }, []);

  useAffiliate();

  const handleMoreEventsSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const event = formData.get("event");

    try {
      const response = await fetch("/api/more-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event }),
      });

      if (response.ok) {
      } else {
        console.error("Failed to submit event");
      }
      setShowFeedbackModal(false);
      setShowSuccessMessage(false);
      if (feedbackInSearchModal) {
        setSearchValue("");
        setShowSearchModal(false);
      }
    } catch (error) {
      setShowFeedbackModal(false);
      setShowSuccessMessage(false);
      if (feedbackInSearchModal) {
        setSearchValue("");
        setShowSearchModal(false);
      }
      console.error("Error submitting event:", error);
    }
  };

  if (errorDebug.error) {
    return (
      <div className="container mx-auto">
        <h1>אופס! קרתה תקלה</h1>
        <p>אנא נסו שוב מאוחר יותר</p>
        <p>{errorDebug.message}</p>
        <p>{errorDebug.error}</p>
      </div>
    );
  }

  return (
    <>
      {!matches && (
        <Modal
          closeButtonProps={{
            icon: <ArrowLeftIcon />,
            style: { position: "absolute" },
          }}
          opened={showSearchModal}
          fullScreen
          onClose={() => setShowSearchModal(false)}
        >
          <SearchCombobox
            ref={mobileComboboxRef}
            events={initialEvents}
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            onOpenFeedbackModal={() => {
              setfeedbackInSearchModal(true);
              setShowFeedbackModal(true);
            }}
            mobile={true}
          />
        </Modal>
      )}
      <Modal
        opened={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        title="ספרו לנו לאן תרצו לטוס"
        dir="rtl"
      >
        {showSuccessMessage ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">תודה על שיתוף הפעולה!</h2>
            <p>האירוע נשלח בהצלחה.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              handleMoreEventsSubmit(e);
              setShowSuccessMessage(true);
            }}
          >
            <div className="mb-4">
              <label
                className="block text-gray-700 text-sm font-bold mb-2"
                htmlFor="event"
              >
                מה שם האומן/משחק והאם יש העדפה למקום?
              </label>
              <input
                id="event"
                name="event"
                type="text"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="ביונסה בפריז"
              />
              <label
                className="block text-gray-700 text-sm font-bold mt-6 mb-2"
                htmlFor="event"
              >
                שנהיה בקשר כשיש כרטיסים (לא חייבים אם לא רוצים)?
              </label>
              <input
                id="email"
                name="email"
                type="text"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="טלפון או אימייל"
              />
            </div>
            <button
              type="submit"
              className="bg-secondary hover:bg-secondary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              שלח
            </button>
          </form>
        )}
      </Modal>
      <section className="w-full py-6 lg:py-10 px-4 md:px-6 text-white bg-main relative">
        <div className="container mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl mb-4">
            <span> כל האירועים השווים בחו״ל</span>
            <span className="text-secondary whitespace-nowrap text-5xl">
              {" "}
              במקום אחד
            </span>
          </h1>
          <p className="text-3xl sm:text-4xl md:text-5xl mb-4 mb-8">
            !בחרו ותתחילו לתכנן
          </p>
        </div>
        <div className="w-full max-w-sm lg:max-w-xl mx-auto space-y-2 absolute bottom-0 left-0 right-0 transform translate-y-1/2 min-w-70">
          <form className="flex center shadow-md" dir="rtl">
            {!matches ? (
              <input
                onFocus={(e) => {
                  handleSearchModalOpen();
                  e.target.blur();
                }}
                onChange={(e) => setSearchValue(e.target.value)}
                value={searchValue}
                placeholder="חפש אירוע..."
                type="text"
                className="w-2/3 rounded-r rounded-l-none p-2 text-main border"
              />
            ) : (
              <SearchCombobox
                inline
                events={initialEvents}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                ref={ref}
                onOpenFeedbackModal={() => setShowFeedbackModal(true)}
              />
            )}
            <button
              className="w-1/3 bg-secondary text-white rounded-l"
              onClick={(e) => {
                e.preventDefault();
                if (!matches) {
                  handleSearchModalOpen();
                } else {
                  ref.current?.focus();
                }
              }}
            >
              בוא נתחיל לתכנן!
            </button>
          </form>
        </div>
      </section>
      <section className="w-full py-12 lg:py-14 bg-gray-100 dark:bg-gray-800 px-4 md:px-6">
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {initialEvents
              .sort(
                (a, b) =>
                  new Date(a.date).getTime() - new Date(b.date).getTime()
              )
              .map((event) => (
                <Link
                  href={`/order?eventId=${event.id}`}
                  className="cursor-pointer"
                  key={event.id}
                  onClick={() => {
                    orderStage("EVENT_SELECTED", { event: event.name });
                    client.logEvent("user_selected_event", event.id, {
                      item_name: event.name,
                    });
                  }}
                >
                  <div className="rounded-lg shadow-lg flex flex-row sm:flex-col hover:shadow-xl hover:outline hover:outline-main">
                    <div className="relative group overflow-hidden rounded-l-lg sm:rounded-t-lg sm:rounded-b-none w-1/2 sm:w-auto">
                      <Image
                        src={event.card_image_url}
                        alt={event.name}
                        priority={true}
                        width={400}
                        height={300}
                        className="object-cover w-full h-60 transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="flex-col text-center w-1/2 sm:w-auto">
                      <div className="p-2 px-4 text-xl font-bold">
                        {event.name}
                      </div>
                      <div className="py-1 bg-secondary text-white">
                        {dayjs(event.date).format("DD/MM/YYYY")} |{" "}
                        {event.location.name}
                      </div>
                      <div className="p-2 px-4 text-right" dir="rtl">
                        <div>בממוצע כ-</div>
                        <div className="flex items-baseline gap-1">
                          <div className="text-2xl font-bold">
                            $
                            {(
                              event.base_flight_price +
                              event.base_hotel_price +
                              Math.min(
                                ...event.tickets_and_rates.map(
                                  (ticket) => ticket.price
                                )
                              ) +
                              Number(process.env.NEXT_PUBLIC_MARKUP || "150")
                            ).toLocaleString("en-US")}
                          </div>
                          <div className="text-sm line-through">
                            ${event.usual_price.toLocaleString("en-US")}
                          </div>{" "}
                        </div>
                        <div>לנוסע כולל טיסה, מלון וכרטיס לאירוע</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            <div
              className="rounded-lg shadow-lg flex flex-col hover:shadow-xl hover:outline hover:outline-main cursor-pointer"
              onClick={() => setShowFeedbackModal(true)}
            >
              <div className="relative group overflow-hidden rounded-t-lg w-full bg-main h-60 flex items-center justify-center">
                <MYT className="" />
              </div>
              <div
                className="p-4 text-center text-main text-xl font-bold h-20"
                dir="rtl"
              >
                לא מצאתם מה שחיפשתם? ספרו לנו!
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
