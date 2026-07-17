"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable — user can select the text manually */
        }
      }}
      className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-gray-50"
    >
      {copied ? "הועתק ✓" : "העתק כתובת"}
    </button>
  );
}
