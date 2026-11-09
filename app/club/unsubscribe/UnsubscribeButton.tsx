"use client";

import { useState } from "react";
import { CLUB_UNSUBSCRIBE_COPY as C } from "@/lib/club/copy";

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "gone" | "error">("idle");

  async function go() {
    setState("busy");
    try {
      const res = await fetch("/api/club/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ t: token }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; kind?: string } | null;
      setState(body?.ok ? "done" : body?.kind === "not_found" ? "gone" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") return <p className="text-lg font-semibold text-[#0A1A14]">{C.done}</p>;
  if (state === "gone") return <p className="text-base text-gray-700">{C.notFound}</p>;
  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={go}
        disabled={state === "busy"}
        className="rounded-full bg-[#0A1A14] px-6 py-3 text-base font-bold text-[#5BFF95] disabled:opacity-60"
      >
        {state === "busy" ? "..." : C.button}
      </button>
      {state === "error" && <p className="text-sm text-red-700">{C.error}</p>}
    </div>
  );
}
