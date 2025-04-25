"use client";

import Image from "next/image";
import mail from "@/public/mail.svg";
import whatsapp from "@/public/whatsapp.svg";
import phone from "@/public/phone.svg";

import { useMediaQuery } from "@mantine/hooks";
import { cn } from "@/lib/utils";

const PHONE_NUMBER = "+972542002722";
const text = "דברו איתנו";

export const ContactUs = ({ inHeader = true }: { inHeader?: boolean }) => {
  const matches = useMediaQuery("(min-width: 640px)");

  const iconSize = inHeader ? (matches ? 30 : 18) : 24;

  return (
    <div
      className={cn(
        "sm:top-[unset] sm:left-[unset] sm:relative sm:flex flex-col items-center justify-center gap-1",
        inHeader && "absolute left-3 top-5"
      )}
    >
      <div className="text-white font-bold hidden sm:flex">
        <a href={`tel:${PHONE_NUMBER}`}>
          {text} {"054-200-2722"}
        </a>
      </div>
      <div
        className={cn(
          "flex gap-1 sm:gap-2 items-center justify-left w-full flex-col",
          inHeader && "flex-row"
        )}
      >
        {inHeader && (
          <a href="mailto:reservations@mega-events.co.il" className="flex">
            <Image
              alt="mail icon"
              src={mail}
              width={iconSize}
              height={iconSize}
            />
          </a>
        )}
        <a
          href={`tel:${PHONE_NUMBER}`}
          className={cn(
            !matches && inHeader && "border-l-[1px] border-white pl-1",
            "sm:hidden flex"
          )}
        >
          <Image
            alt="phone icon"
            src={phone}
            width={iconSize}
            height={iconSize}
          />
        </a>
        <a
          aria-label="Chat on WhatsApp"
          href={`https://wa.me/${PHONE_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            !matches && inHeader && "border-l-[1px] border-white pl-1"
          )}
        >
          <Image
            alt="whatsapp icon"
            src={whatsapp}
            width={iconSize}
            height={iconSize}
          />
        </a>
      </div>
    </div>
  );
};
