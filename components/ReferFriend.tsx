import { useState } from "react";
import { FiCopy, FiCheck } from "react-icons/fi";
import Image from "next/image";

/**
 * Refer-a-friend card — brand redesign (Dark Forest + Glow Green).
 * The referral link is shown in a proper chip with an inline copy button,
 * instead of an opaque white "copy" square.
 */
export const ReferFriend = ({ promoCode }: { promoCode: string }) => {
  const referralUrl = `https://mega-events.co.il/?utm_source=${promoCode}`;
  const [copied, setCopied] = useState(false);

  const steps = [
    "שתפו את הקישור עם חברים",
    "הם מבצעים הזמנה באתר",
    "אתם מקבלים את ההחזר!",
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      dir="rtl"
      className="relative w-full overflow-hidden rounded-3xl bg-forest p-6 text-white shadow-[0_18px_44px_-24px_rgba(10,26,20,0.6)]"
    >
      {/* soft glow accent */}
      <div className="pointer-events-none absolute -top-20 -left-16 h-44 w-44 rounded-full bg-glow/20 blur-3xl" />

      <div className="relative flex flex-col items-center text-center">
        <Image
          src="/brand/logo-wordmark.svg"
          alt="MegaEvents"
          width={168}
          height={24}
          unoptimized
          className="mb-4 h-5 w-auto"
        />
        <Image
          src="/undraw_travelers_kud9.png"
          alt=""
          width={128}
          height={92}
          unoptimized
          className="mb-3 h-24 w-auto"
        />
        <span className="text-[13px] font-bold tracking-wide text-glow/80">
          הזמינו חברים לחופשה
        </span>
        <h3 className="mt-1 text-4xl font-extrabold text-glow">עד $800 החזר!</h3>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/75">
          על כל נוסע שיזמין דרך הקישור שלכם —{" "}
          <span className="font-bold text-glow">$40 החזר</span>, והם יהנו מהטבה
          בלעדית.
        </p>

        {/* Referral link chip */}
        <div className="mt-5 w-full">
          <span className="mb-1.5 block text-right text-xs font-bold text-glow/80">
            הקישור האישי שלך
          </span>
          <div className="flex items-center gap-2 rounded-2xl border border-glow/40 bg-black/25 p-1.5 pr-3">
            <span
              dir="ltr"
              className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-glow"
            >
              {referralUrl}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="העתקת הקישור"
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-glow px-4 py-2.5 text-sm font-extrabold text-forest transition-transform hover:-translate-y-px active:translate-y-0"
            >
              {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
              {copied ? "הועתק!" : "העתקה"}
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-7 w-full">
          <h4 className="mb-4 text-base font-extrabold">איך זה עובד?</h4>
          <div className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-glow text-[13px] font-extrabold text-glow">
                  {i + 1}
                </span>
                <span className="flex-1 text-right text-sm text-white/80">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-[12px] leading-relaxed text-white/55">
          $40 החזר למשלם על כל נוסע ששילם, ו-$20 הנחה לכל נוסע חדש. הקישור תקף
          ל-28 יום, עד $800 החזר.
        </p>
      </div>
    </div>
  );
};
