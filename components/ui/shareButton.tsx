"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import whatsapp from "@/public/whatsapp.svg";
import facebook from "@/public/facebook.svg";
import telegram from "@/public/telegram.svg";

interface ShareButtonProps {
  shareText: string;
}

export function ShareButton({ shareText }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const encodedText = encodeURIComponent(shareText);

  const shareLinks = {
    whatsapp: `https://api.whatsapp.com/send?text=${encodedText}`,
    messenger: `https://www.facebook.com/dialog/send?link=${encodeURIComponent(
      window.location.href
    )}&app_id=YOUR_FACEBOOK_APP_ID&redirect_uri=${encodeURIComponent(
      window.location.href
    )}&quote=${encodedText}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(
      window.location.href
    )}&text=${encodedText}`,
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 rounded-full">
          <Share className="!w-5 !h-5" />
          <span className="sr-only">שתף</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => window.open(shareLinks.whatsapp, "_blank")}
        >
          <div className="flex items-center gap-2">
            <Image alt="whatsapp icon" src={whatsapp} width={24} height={24} />
            <span>שתף בוואטסאפ</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open(shareLinks.messenger, "_blank")}
        >
          <div className="flex items-center gap-2">
            <Image alt="whatsapp icon" src={facebook} width={24} height={24} />
            <span>שתף במסנג׳ר</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open(shareLinks.telegram, "_blank")}
        >
          <div className="flex items-center gap-2">
            <Image alt="whatsapp icon" src={telegram} width={24} height={24} />
            <span>שתף בטלגרם</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
