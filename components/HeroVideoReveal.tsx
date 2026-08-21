"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Hero-bubble media rule (Dor 2026-08-21): open on the branded blob art and
 * crossfade into the looping hero video - the art is the identity, the video
 * is the reward.
 *
 * Built on the YouTube IFrame API rather than a bare embed because embeds
 * always paint their mobile chrome (title, play/pause overlay, "more
 * videos") over the clip - controls=0 hides only the scrub bar. So the art
 * stays on top until playback is CONFIRMED, then holds ~3s more while
 * YouTube's own overlay fades, and only then reveals. If autoplay is blocked
 * (iOS Low-Power Mode etc.) the page simply keeps the still art - no player
 * chrome ever shows.
 */

type YTPlayer = {
  destroy: () => void;
  mute: () => void;
  playVideo: () => void;
  /** Kills the auto-enabled captions muted playback turns on. */
  unloadModule?: (module: string) => void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (e: { target: YTPlayer }) => void;
        onStateChange: (e: { data: number; target: YTPlayer }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// One API script per page, shared by every reveal instance.
let ytApiPromise: Promise<YTNamespace> | null = null;
const loadYouTubeApi = (): Promise<YTNamespace> => {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytApiPromise;
};

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
  const mountRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let player: YTPlayer | null = null;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      player = new YT.Player(mountRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          loop: 1,
          playlist: videoId,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          disablekb: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: (e) => {
            e.target.mute();
            e.target.unloadModule?.("captions");
            e.target.unloadModule?.("cc");
            e.target.playVideo();
          },
          onStateChange: (e) => {
            // Muted playback re-enables auto-captions - keep them off.
            e.target.unloadModule?.("captions");
            e.target.unloadModule?.("cc");
            // Reveal only once playback is real, and give YouTube's own
            // title/overlay chrome ~3s to fade behind the art first.
            if (e.data === YT.PlayerState.PLAYING && !revealTimer) {
              revealTimer = setTimeout(() => {
                if (!cancelled) setRevealed(true);
              }, 3000);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (revealTimer) clearTimeout(revealTimer);
      try {
        player?.destroy();
      } catch {
        // player may already be gone mid-navigation
      }
    };
  }, [videoId]);

  return (
    <div className="absolute inset-0">
      {/* 16:9 player scaled to cover the square circle; the extra height
          crop also pushes YouTube's top title band outside the mask. */}
      {/* The API REPLACES the mount div with the player iframe, so the size
          rules live on this wrapper and target any descendant iframe. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[115%] w-[204.4%] -translate-x-1/2 -translate-y-1/2 [&_iframe]:h-full [&_iframe]:w-full"
        aria-hidden
      >
        <div ref={mountRef} title={title} className="h-full w-full" />
      </div>
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-1000 motion-reduce:transition-none",
          revealed ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        {children}
      </div>
    </div>
  );
};
