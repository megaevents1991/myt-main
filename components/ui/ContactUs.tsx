import Image from "next/image";
import { Mail } from "lucide-react";
import whatsappIcon from "@/public/Digital_Glyph_White.svg";

const PHONE_NUMBER = "+972542002722";
const text = "דברו איתנו";

export const ContactUs = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div className="text-white font-bold hidden sm:flex">
        <a href={`tel:${PHONE_NUMBER}`}>
          {text} {"054-200-2722"}
        </a>
      </div>
      <div className="flex gap-2 items-center justify-left w-full flex-row">
        <a
          href="mailto:reservations@mega-events.co.il"
          className="hidden sm:flex"
        >
          <Mail style={{ color: "white" }} size={32} />
        </a>
        <a
          aria-label="Chat on WhatsApp"
          href={`https://wa.me/${PHONE_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            className="bg-[#20B038] rounded-md p-[4px]"
            alt="amenity icon"
            src={whatsappIcon}
            width={26}
            height={26}
          />
        </a>
      </div>
    </div>
  );
};
