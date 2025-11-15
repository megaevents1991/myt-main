import { Timer } from "@/components/ui/Timer";
import { LuAlarmClockCheck } from "react-icons/lu";

import { TIMEOUT } from "../utils";
export const MobileHeader = ({
  handleTimeout,
  saving
}: {
  handleTimeout: () => void;
  saving: number;
}) => {
  return (
    <>
      <div
        className="bg-yellow-100 w-screen text-main p-2 -mt-3 text-center text-sm font-semibold flex items-center justify-center gap-1"
        dir="rtl"
      >
        <LuAlarmClockCheck className="text-yellow-700" size={20} />
        ההזמנה שמורה עבורך למשך
        <span className="text-secondary">
          <Timer onTimeElapsed={handleTimeout} duration={TIMEOUT} />
        </span>
        דקות
      </div>
      {saving > 0 && (
        <div className="w-full bg-[#EBFFEE] mt-3 p-2 rounded-xl flex items-center justify-center">
          <span className="">וואו! חסכת <span className="font-bold">${saving}</span> עם החבילה הזאת</span>
          <img
        src="/Union.svg"
        alt="Package Deal Icon"
        className="w-6 h-6 ml-2"
          />
        </div>
      )}
    </>
  );
};
