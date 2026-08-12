"use client";

import { useMemo, useState } from "react";
import type { FeedItem } from "@/lib/feed/metaCatalog";

/**
 * The feed row preview, filtered in the browser.
 *
 * Filtering client-side rather than through searchParams is deliberate: the
 * page rebuilds the entire feed from the DB on every request (seconds), so a
 * round trip per keystroke would make the filters unusable. The rows are
 * already here - narrowing them is free.
 */
type ImageFilter = "all" | "campaign" | "original";
type StockFilter = "all" | "in" | "out";

const BUTTON = "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors";
const ON = "border-main bg-main text-white";
const OFF = "border-gray-200 bg-white text-gray-900 hover:bg-gray-50";

export function FeedTable({ items }: { items: FeedItem[] }) {
  const [query, setQuery] = useState("");
  const [image, setImage] = useState<ImageFilter>("all");
  const [stock, setStock] = useState<StockFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (image === "campaign" && !it.has_campaign) return false;
      if (image === "original" && it.has_campaign) return false;
      if (stock === "in" && it.availability !== "in stock") return false;
      if (stock === "out" && it.availability === "in stock") return false;
      if (!q) return true;
      return (
        String(it.id).includes(q) ||
        it.title.toLowerCase().includes(q) ||
        it.product_type.toLowerCase().includes(q) ||
        it.custom_labels.some((l) => l.toLowerCase().includes(q))
      );
    });
  }, [items, query, image, stock]);

  const noCampaign = items.filter((it) => !it.has_campaign).length;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם, id, קטגוריה או תגית…"
          className="min-w-[240px] flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button type="button" className={`${BUTTON} ${image === "all" ? ON : OFF}`} onClick={() => setImage("all")}>
            כל התמונות
          </button>
          <button type="button" className={`${BUTTON} ${image === "campaign" ? ON : OFF}`} onClick={() => setImage("campaign")}>
            קמפיין
          </button>
          <button type="button" className={`${BUTTON} ${image === "original" ? ON : OFF}`} onClick={() => setImage("original")}>
            מקורי ({noCampaign})
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" className={`${BUTTON} ${stock === "all" ? ON : OFF}`} onClick={() => setStock("all")}>
            הכל
          </button>
          <button type="button" className={`${BUTTON} ${stock === "in" ? ON : OFF}`} onClick={() => setStock("in")}>
            במלאי
          </button>
          <button type="button" className={`${BUTTON} ${stock === "out" ? ON : OFF}`} onClick={() => setStock("out")}>
            אזל
          </button>
        </div>
      </div>

      <p className="mb-2 text-sm text-gray-500">
        מוצגים {filtered.length} מתוך {items.length}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs text-gray-500">
              <th className="px-3 py-2">id</th>
              <th className="px-3 py-2">image</th>
              <th className="px-3 py-2">title</th>
              <th className="px-3 py-2">price</th>
              <th className="px-3 py-2">availability</th>
              <th className="px-3 py-2">expiration</th>
              <th className="px-3 py-2">product_type</th>
              <th className="px-3 py-2">labels</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr key={it.id} className="border-b border-gray-200/50 align-top">
                <td className="px-3 py-2">
                  <a href={it.link} target="_blank" rel="noopener" className="font-semibold text-main hover:underline" dir="ltr">
                    {it.id}
                  </a>
                </td>
                <td className="px-3 py-2">
                  <a href={it.image_link} target="_blank" rel="noopener" className="relative block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.image_link} alt="" className="h-16 w-16 rounded-md border border-gray-200 object-cover" />
                    <span
                      className={
                        it.has_campaign
                          ? "absolute -bottom-1 -right-1 rounded-full bg-main px-1.5 py-0.5 text-[9px] font-bold text-white"
                          : "absolute -bottom-1 -right-1 rounded-full bg-gray-400 px-1.5 py-0.5 text-[9px] font-bold text-white"
                      }
                    >
                      {it.has_campaign ? "קמפיין" : "מקורי"}
                    </span>
                  </a>
                </td>
                <td className="max-w-[320px] px-3 py-2 text-gray-900">{it.title}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-900" dir="ltr">
                  {it.price}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={
                      it.availability === "in stock"
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800"
                        : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800"
                    }
                  >
                    {it.availability}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-900" dir="ltr">
                  {it.expiration_date}
                </td>
                <td className="max-w-[200px] px-3 py-2 text-gray-900" dir="ltr">
                  {it.product_type || "-"}
                </td>
                <td className="max-w-[220px] px-3 py-2 text-gray-900" dir="ltr">
                  {it.custom_labels.filter(Boolean).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500">
            {items.length === 0 ? "אין פריטים בפיד." : "אין תוצאות לסינון הזה."}
          </p>
        )}
      </div>
    </>
  );
}
