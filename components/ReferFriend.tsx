import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FiCopy, FiShare2, FiCheck } from "react-icons/fi";
import Image from "next/image";

export const ReferFriend = ({
  promoCode,
}: {
  promoCode: string;
}) => {
  // Steps data for the "How it works" section
  const howItWorksSteps = [
    "העתיקו את הקישור ושלחו לחברים",
    "החברים מבצעים הזמנה באתר",
    "אתם מקבלים החזר!",
  ];

  // Add state for modal and referral link
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCopyNotification, setShowCopyNotification] = useState(false);

  // Handle button click - API request and modal open
  const handleGetReferralLink = async () => {
    try {
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error fetching referral link:", error);
    }
  };

  // Handle copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(
      "https://mega-events.co.il/?utm_source=" + promoCode
    );

    setShowCopyNotification(true);
    setTimeout(() => {
      setShowCopyNotification(false);
    }, 2000);
  };

  // Handle share
  // const handleShare = () => {
  //   if (navigator.share) {
  //     navigator
  //       .share({
  //         title: "הזמנת חברים לחופשה",
  //         text: "לנו הצטרפו אלי לחופשה והרוויחו $20 הנחה לנוסע!",
  //         url: "https://mega-events.co.il/?utm_source=" + promoCode,
  //       })
  //       .catch((err) => console.error("Error sharing:", err));
  //   } else {
  //     // Fallback for browsers that don't support Web Share API
  //     handleCopy();
  //   }
  // };

  return (
    <Card className="flex flex-col w-full items-start gap-4 p-3 rounded-2xl shadow-[0px_0px_12px_#0000001a] [background:linear-gradient(180deg,rgba(0,172,194,1)_31%,rgba(39,126,137,1)_100%)]">
      <CardContent className="flex flex-col items-center gap-4 w-full p-0">
        <div className="relative w-[150px] mt-4 h-[107.0px] bg-[url(/undraw_travelers_kud9.png)] bg-[100%_100%]" />

        <div className="flex flex-col items-center gap-4 w-full">
          <p className="w-full font-normal text-white text-xl text-center leading-normal [font-family:'IBM_Plex_Sans_Hebrew',Helvetica] tracking-[0] [direction:rtl]">
            הזמינו חברים לחופשה ותוכלו לקבל
          </p>

          <p className="w-full font-bold text-white text-4xl text-center leading-[24.9px] [font-family:'IBM_Plex_Sans_Hebrew',Helvetica] tracking-[0] [direction:rtl]">
            עד $800 החזר!
          </p>

          <p className="w-full font-normal text-white text-base text-center leading-normal [font-family:'IBM_Plex_Sans_Hebrew',Helvetica] tracking-[0] [direction:rtl]">
            הזמינו חברים לרכוש באמצעות הלינק שלכם,{" "}
            <span className="font-bold">ותקבלו $40 החזר (לכל נוסע!)</span>, וגם
            הם יקבלו צ&apos;ופר!
          </p>
        </div>

        <Button
          variant="default"
          className="flex items-center justify-center px-3 py-1 w-full bg-white rounded-[10px] hover:bg-white/90"
          onClick={handleGetReferralLink}
          aria-label="קבל קישור הפניה לחברים"
        >
          <span className="font-bold text-[#277e89] text-base leading-normal [font-family:'IBM_Plex_Sans_Hebrew',Helvetica] tracking-[0] [direction:rtl]">
            {"העתיקו את הקישור"}
          </span>
        </Button>
      </CardContent>

      <div className="flex flex-col items-center gap-5 w-full">
        <h3 className="w-full font-bold text-white text-lg text-center leading-[23.2px] [font-family:'IBM_Plex_Sans_Hebrew',Helvetica] tracking-[0] [direction:rtl]">
          איך זה עובד?
        </h3>

        <div className="flex flex-col items-start w-full">
          {howItWorksSteps.map((step, index) => (
            <div
              key={index}
              className="flex items-start justify-end gap-4 px-5 py-0 w-full"
            >
              <div className="flex-1 font-normal text-white text-base leading-normal [font-family:'IBM_Plex_Sans_Hebrew',Helvetica] tracking-[0] [direction:rtl]">
                {step}
              </div>

              <div className="inline-flex flex-col items-center justify-center gap-1">
                <div className="flex w-6 h-6 items-center justify-center bg-white rounded-[20px]">
                  <div className="font-buttons-mobile-btn2 font-semibold text-[#277e89] text-xs text-center">
                    {index + 1}
                  </div>
                </div>
                {index < howItWorksSteps.length - 1 && (
                  <Image
                    className="w-0.5 h-4"
                    alt="Line"
                    src="/line-13.svg"
                    width={2}
                    height={16}
                    unoptimized
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-0 w-full">
        <p className="w-full font-light text-white text-[13px] leading-normal [font-family:'IBM_Plex_Sans_Hebrew',Helvetica] tracking-[0] [direction:rtl]">
          $40 החזר למשלם ההזמנה, על כל נוסע בהזמנה שתשולם! ועוד $20 הנחה לכל
          נוסע שישלים הזמנה. הקישור תקף ל-28 יום, ניתן לקבל החזר של עד $800.
        </p>
      </div>

      {/* Share Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-center text-[#277e89] font-bold">
              שתף עם חברים
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="bg-gray-100 p-3 rounded-md text-sm truncate text-center">
              {"https://mega-events.co.il/?utm_source=" + promoCode}
            </div>
            <div className="flex justify-center gap-8 pt-2">
              <Button
                variant="outline"
                className="flex flex-col items-center p-8"
                onClick={handleCopy}
                aria-label="העתק קישור הפניה"
              >
                <FiCopy size={36} className="text-[#277e89]" />
                <span className="text-base font-medium">העתק</span>
              </Button>
              {/*
              <Button
                variant="outline"
                className="flex flex-col items-center p-8"
                onClick={handleShare}
              >
                <FiShare2 size={36} className="text-[#277e89]" />
                <span className="text-base font-medium">שתף</span>
              </Button>
              */}
            </div>

            {/* Copy notification */}
            {showCopyNotification && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2 shadow-md transition-opacity duration-300">
                <FiCheck className="text-white" />
                <span className="font-medium">הועתק בהצלחה!</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
