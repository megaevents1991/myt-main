import Image from "next/image";
import { Timer } from "@/components/ui/Timer";
import { LuAlarmClockCheck } from "react-icons/lu";

import { TIMEOUT } from "../utils";
export const MobileHeader = ({
  handleTimeout,
  saving,
  skipHotel
}: {
  handleTimeout: () => void;
  saving: number;
  skipHotel: boolean;
}) => {
  return (
    <>
      <div
        className="bg-yellow-100 w-screen text-main p-2 -mt-3 text-center text-sm font-semibold flex items-center justify-center gap-1"
        dir="rtl"
      >
        <LuAlarmClockCheck className="text-yellow-700" size={20} />
        ההזמנה שמורה עבורך למשך
        <span className="text-success font-bold">
          <Timer onTimeElapsed={handleTimeout} duration={TIMEOUT} />
        </span>
        דקות
      </div>
      {saving > 0 && !skipHotel && (
        <div className="w-full bg-[#EBFFEE] mt-3 p-2 rounded-xl flex items-center justify-center">
          <span className="">וואו! חסכת <span className="font-bold">${saving}</span> עם החבילה הזאת</span>
        <Image
          src="/Union.svg"
          alt="Package Deal Icon"
          width={24}
          height={24}
          className="ml-2"
        />
        </div>
      )}
    </>
  );
};
