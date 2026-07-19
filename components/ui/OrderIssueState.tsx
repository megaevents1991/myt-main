"use client";

import { CloudOff, MessageCircle, RefreshCw, SearchX } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const WHATSAPP_NUMBER = "972542002722";

/**
 * Friendly Hebrew empty/error state for the order flow (tickets, flights,
 * hotels). "empty" = nothing matched the criteria (soft, suggests loosening
 * filters); "error" = something broke on our side (apologetic, offers retry).
 */
export const OrderIssueState = ({
  variant = "empty",
  title,
  subtitle,
  onRetry,
  retryLabel = "נסו שוב",
  whatsAppText,
  showHomeLink = false,
  className,
}: {
  variant?: "empty" | "error";
  title: string;
  subtitle?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Prefilled WhatsApp message; when set, shows a "דברו איתנו" button */
  whatsAppText?: string;
  showHomeLink?: boolean;
  className?: string;
}) => {
  const Icon = variant === "error" ? CloudOff : SearchX;

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-primary">
        <Icon className="h-8 w-8" aria-hidden="true" />
      </div>
      <p className="text-xl font-bold text-foreground">{title}</p>
      {subtitle && (
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
      {(onRetry || whatsAppText || showHomeLink) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/90"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {retryLabel}
            </button>
          )}
          {whatsAppText && (
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsAppText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-accent"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              דברו איתנו
            </a>
          )}
          {showHomeLink && (
            <Link
              href="/"
              className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              חזרה לדף הבית
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
