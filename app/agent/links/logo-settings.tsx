"use client";

import { useRef, useState } from "react";
import type React from "react";
import { uploadPartnerLogo, removePartnerLogo } from "@/lib/agent-branding-actions";

export function LogoSettings({ currentLogoUrl }: { currentLogoUrl: string | null }) {
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("יש לבחור קובץ");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    setBusy(true);
    try {
      const result = await uploadPartnerLogo(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLogoUrl(result.logo_url);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("שגיאת רשת — נסו שוב.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await removePartnerLogo();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLogoUrl(null);
    } catch {
      setError("שגיאת רשת — נסו שוב.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-md border p-4" dir="rtl">
      <div>
        <h2 className="font-bold">לוגו</h2>
        <p className="text-sm text-gray-500">
          מוצג בראש הצעות המחיר שלכם. PNG, JPG או WebP בלבד, עד 2MB.
        </p>
      </div>

      {logoUrl && (
        // Partner-controlled logo served from a public Storage bucket —
        // plain <img>, not a content asset this app owns the source of.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt="הלוגו שלכם"
          className="h-16 w-auto rounded border bg-gray-50 p-2"
        />
      )}

      <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-main px-4 py-2 text-sm font-medium text-main-foreground hover:bg-main/90 disabled:opacity-50"
        >
          {busy ? "מעלה..." : "העלאת לוגו"}
        </button>
        {logoUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="rounded-md border px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            הסרת לוגו
          </button>
        )}
      </form>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </section>
  );
}
