# Brand assets (from Figma)

Drop here, exact names:

## SVGs (Figma → Export → SVG)
- logo-wordmark.svg      — full "MegaΣvents." wordmark (already in code; export anyway as source of truth)
- logo-mark.svg          — short "MΣ." mark (used in the mobile center card)
- blob-1.svg … blob-4.svg — the 4 card swoosh/blob shapes (flat color shapes behind artists)

## Videos (when produced — see chat for how)
- mega-logo.mp4          — hero center card animation (desktop, ~560×800 or square)
- mega-logo-mobile.mp4   — mobile 160×160 center card animation
  (H.264 mp4, muted, loop-friendly, < 1.5MB each. Lottie .json also accepted — preferred.)

The code falls back to the CSS-animated wordmark when no video exists, so
nothing breaks while these are missing.
