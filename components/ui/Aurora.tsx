import { cn } from "@/lib/utils";

/**
 * Aurora — the MegaEvents signature background. Layered neon gradient blobs that
 * drift on slow independent loops, blending to a luminous "northern lights" wash.
 * Designed to sit behind hero / accent sections on dark surfaces.
 *
 * - GPU-friendly: animates `transform` only (see keyframes in globals.css).
 * - `mix-blend-mode: screen` makes the brand neons glow against dark.
 * - Decorative + pointer-events-none; the global prefers-reduced-motion rule
 *   freezes the drift automatically.
 *
 * Drop inside a `relative overflow-hidden` parent; keep foreground content at a
 * higher stacking context (e.g. `relative z-10`).
 */
export const Aurora = ({
  className,
  intensity = 0.55,
}: {
  className?: string;
  /** Opacity of the whole mesh (0–1). Lower over content-heavy sections. */
  intensity?: number;
}) => {
  // NOTE: the live `filter: blur(56px)` + `mix-blend-mode: screen` live in the
  // `.aurora-blob` class (globals.css) and apply on DESKTOP ONLY. On iOS those
  // five giant blurred, blended, animated layers forced WebKit to re-composite
  // the page on every scroll — the whole page repainted for seconds each scroll
  // (bisected on-device: killing filters fixed it; killing shadows didn't).
  // Mobile gets the same drifting blobs with softness baked into the gradient
  // instead — transform-only animation is composited and stays cheap.
  const blob = (
    color: string,
    size: string,
    pos: React.CSSProperties,
    anim: string,
    duration: string,
    delay = "0s",
  ): React.CSSProperties & { "--ab-color": string } => ({
    position: "absolute",
    width: size,
    height: size,
    borderRadius: "9999px",
    // Gradient itself comes from `.aurora-blob` (globals.css) so each
    // breakpoint can tune softness; the blob only supplies its color.
    "--ab-color": color,
    animation: `${anim} ${duration} var(--ease-out) infinite`,
    animationDelay: delay,
    willChange: "transform",
    ...pos,
  });

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ opacity: intensity }}
    >
      <div className="aurora-blob" style={blob("var(--mesh-1)", "42vw", { top: "-12%", insetInlineStart: "-6%" }, "aurora-drift-a", "14s")} />
      <div className="aurora-blob" style={blob("var(--mesh-2)", "38vw", { top: "8%", insetInlineEnd: "-8%" }, "aurora-drift-b", "18s", "-3s")} />
      <div className="aurora-blob" style={blob("var(--mesh-3)", "34vw", { bottom: "-14%", insetInlineStart: "22%" }, "aurora-drift-c", "16s", "-6s")} />
      <div className="aurora-blob" style={blob("var(--mesh-4)", "26vw", { top: "26%", insetInlineStart: "30%" }, "aurora-drift-b", "20s", "-9s")} />
      <div className="aurora-blob" style={blob("var(--mesh-5)", "22vw", { bottom: "6%", insetInlineEnd: "12%" }, "aurora-drift-a", "22s", "-5s")} />
    </div>
  );
};
