"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md bg-main px-4 py-2 text-sm font-medium text-main-foreground hover:bg-main/90"
    >
      הדפסה / שמירה כ-PDF
    </button>
  );
}
