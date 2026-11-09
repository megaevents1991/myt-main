"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CLUB_UNSUBSCRIBE_COPY as C } from "@/lib/club/copy";

type State = "idle" | "busy" | "unsubscribed" | "left" | "gone" | "error";

/**
 * The member's two choices (D13): stop the updates and stay a member (first, prominent), or leave the club - low-key,
 * behind one confirmation, because it also cancels the member price.
 */
export function ClubPreferences({ token, subscribed }: { token: string; subscribed: boolean }) {
  const [state, setState] = useState<State>(subscribed ? "idle" : "unsubscribed");
  const [confirming, setConfirming] = useState(false);

  async function post(path: "/api/club/unsubscribe" | "/api/club/leave", done: State) {
    setState("busy");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ t: token }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; kind?: string } | null;
      setState(body?.ok ? done : body?.kind === "not_found" ? "gone" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "left") return <p role="status" className="text-lg font-semibold text-foreground">{C.leftDone}</p>;
  if (state === "gone") return <p role="status" className="text-base text-muted-foreground">{C.notFound}</p>;

  return (
    <div className="flex flex-col gap-8">
      {state === "unsubscribed" ? (
        <p role="status" className="text-lg font-semibold text-foreground">
          {C.done}
        </p>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <Button
            type="button"
            size="lg"
            className="font-bold"
            onClick={() => post("/api/club/unsubscribe", "unsubscribed")}
            disabled={state === "busy"}
          >
            {state === "busy" ? "..." : C.button}
          </Button>
          <p className="text-sm text-muted-foreground">{C.stayNote}</p>
        </div>
      )}

      <div className="border-t border-border pt-5 text-sm text-muted-foreground">
        {!confirming ? (
          <p>
            {C.leaveIntro}{" "}
            <button
              type="button"
              className="font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={() => setConfirming(true)}
            >
              {C.leaveLink}
            </button>
          </p>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-foreground">{C.leaveWarn}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => post("/api/club/leave", "left")}
                disabled={state === "busy"}
              >
                {state === "busy" ? "..." : C.leaveConfirm}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={state === "busy"}>
                {C.leaveCancel}
              </Button>
            </div>
          </div>
        )}
      </div>

      {state === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {C.error}
        </p>
      )}
    </div>
  );
}
