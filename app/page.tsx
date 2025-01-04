"use client";

import Image from "next/image";
import { events as staticEvents } from "@/lib/events-data";
import { Combobox, Modal, useCombobox } from "@mantine/core";
import { Dispatch, RefObject, SetStateAction, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { useMediaQuery } from "@mantine/hooks";
import { Event } from "@/lib/app.types";
import { cn } from "@/lib/utils";

const SearchCombobox = ({
  searchValue,
  setSearchValue,
  events,
  ref,
  inline,
}: {
  setSearchValue: Dispatch<SetStateAction<string>>;
  events: Event[];
  searchValue: string;
  ref?: RefObject<HTMLInputElement>;
  inline?: boolean;
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
      value={item.id}
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
        setSearchValue(
          events.find((item) => item.id === optionValue)?.name || ""
        );
        router.push(`/order?eventId=${optionValue}`);
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
          {options.length === 0 ? (
            <Combobox.Empty>לא מצאנו משהו כזה</Combobox.Empty>
          ) : (
            options
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
};

export default function Home() {
  const matches = useMediaQuery("(min-width: 768px");
  const events = staticEvents;
  const [searchValue, setSearchValue] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <main>
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
            events={events}
            searchValue={searchValue}
            setSearchValue={setSearchValue}
          />
        </Modal>
      )}
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
            {!matches ? (
              <input
                onFocus={(e) => {
                  setShowSearchModal(true);
                  e.target.blur();
                }}
                onChange={(e) => setSearchValue(e.target.value)}
                value={searchValue}
                placeholder="חפש אירוע..."
                type="text"
                className="w-2/3 rounded-r p-2 text-main border"
              />
            ) : (
              <SearchCombobox
                inline
                events={events}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                ref={ref}
              />
            )}
            <button
              className="w-1/3 bg-secondary text-main rounded-l"
              onClick={(e) => {
                e.preventDefault();
                if (!matches) {
                  setShowSearchModal(true);
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
                <div className="rounded-lg shadow-lg flex flex-row sm:flex-col hover:shadow-xl hover:outline hover:outline-main">
                  <div className="relative group overflow-hidden rounded-t-lg w-1/2 sm:w-auto">
                    <Image
                      src={event.imageUrl}
                      alt={event.name}
                      width={400}
                      height={300}
                      className="object-cover w-full h-60 transition-transform group-hover:scale-105"
                    />
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
  );
}
