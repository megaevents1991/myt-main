"use client";

import { ReactNode, useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { youtubeEmbed } from "@/lib/youtube";

/**
 * Hero-bubble media rule (Dor 2026-08-21): when a page has BOTH card art and
 * a hero video, open on the branded blob art and crossfade into the looping
 * video a few seconds later - the art is the identity, the video is the
 * reward. Also hides YouTube's black loading flash: the iframe mounts hidden
 * a beat early to buffer, then the art fades off it.
 *
 * Reduced-motion users stay on the still art.
 */
export const HeroVideoReveal = ({
  videoId,
  title,
  children,
}: {
  videoId: string;
  title: string;
  /** The server-rendered art (EventArt / Image) shown first. */
  children: ReactNode;
}) => {
  const [stage, setStage] = useState<"art" | "buffer" | "video">("art");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mount = setTimeout(() => setStage("buffer"), 1200);
    const reveal = setTimeout(() => setStage("video"), 3200);
    return () => {
      clearTimeout(mount);
      clearTimeout(reveal);
    };
  }, []);

  return (
    <div className="absolute inset-0">
      {stage !== "art" && (
        // 16:9 clip scaled to cover the square circle (same math as the
        // direct-video hero in DetailHero).
        <iframe
          src={youtubeEmbed(videoId, { autoplay: true, mute: true, loop: true })}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="pointer-events-none absolute left-1/2 top-1/2 h-full w-[177.78%] -translate-x-1/2 -translate-y-1/2"
          aria-hidden
        />
      )}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-1000 motion-reduce:transition-none",
          stage === "video" ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        {children}
      </div>
    </div>
  );
};
