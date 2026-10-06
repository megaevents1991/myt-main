import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The row of card / security logos shown beside a pay button. Used by the ready
 * package's narrow column (app/order/OrderReview.tsx); the regular summary still
 * carries its own two copies inline.
 */
export const PaymentLogos = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center justify-center gap-4", className)}>
    <Image
      src="/amex.svg"
      alt="American Express"
      width={40}
      height={25}
      className="h-6 w-auto"
      unoptimized
    />
    <Image
      src="/logo__pci.svg"
      alt="PCI Compliant"
      width={40}
      height={25}
      className="h-7 w-auto"
      unoptimized
    />
    <Image
      src="/mastercardSecuerd.png"
      alt="Mastercard Secure"
      width={50}
      height={30}
      className="h-8 w-auto"
      unoptimized
    />
    <Image
      src="/VisaVerify.png"
      alt="Visa Verified"
      width={50}
      height={30}
      className="h-8 w-auto"
      unoptimized
    />
  </div>
);
