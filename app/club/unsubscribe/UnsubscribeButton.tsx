"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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

  if (state === "done") return <p role="status" className="text-lg font-semibold text-foreground">{C.done}</p>;
  if (state === "gone") return <p role="status" className="text-base text-muted-foreground">{C.notFound}</p>;
  return (
    <div className="flex flex-col items-start gap-3">
      <Button type="button" size="lg" className="font-bold" onClick={go} disabled={state === "busy"}>
        {state === "busy" ? "..." : C.button}
      </Button>
      {state === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {C.error}
        </p>
      )}
    </div>
  );
}
