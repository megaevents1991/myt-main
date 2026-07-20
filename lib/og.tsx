import { ImageResponse } from "next/og";

/**
 * Branded Open-Graph card for artist / football-team pages (WhatsApp & social
 * link previews) — the new card-art design: dark brand canvas, the person's
 * cut-out on their blob color, name + wordmark. Rendered by the
 * `opengraph-image.tsx` route files.
 */

// EVENT_ART_COLORS resolved to literal hexes (satori can't read CSS vars).
const BLOB_HEX = [
  "#5BFF95", // mint
  "#45E2FF", // aqua
  "#BBA1FF", // violet
  "#FF4F61", // coral
  "#FACC15", // gold
  "#FF9D4D", // orange
] as const;

// The same Figma blob shapes EventArt uses on the site cards (3 shapes × 2
// mirrors = indices 0-5; photo backgrounds 6-8 fall back to shape 0).
const BLOB_SHAPES: { d: string; w: number; h: number }[] = [
  {
    d: "M376.567 312.293L311.733 247.245L360.413 239.179C395.964 233.277 409.983 189.739 384.522 164.305L331.689 111.226L370.84 104.771C398.3 100.259 409.156 66.545 389.487 46.8578L338.009 -4.75832C316.883 -25.942 286.807 -35.6261 257.394 -30.7155L185.469 -18.8338C158.009 -14.3216 147.154 19.3922 166.822 39.0795L194.851 67.1655L120.973 79.4455C85.4226 85.3477 71.4037 128.886 96.8645 154.319L133.914 191.587L46.4259 206.105C1.962 213.474 -15.5866 267.975 16.2236 299.904L99.5124 383.449C133.647 417.724 182.326 433.398 230.047 425.48L346.435 406.228C390.829 398.722 408.377 344.222 376.567 312.293Z",
    w: 400,
    h: 358,
  },
  {
    d: "M311.49 43.3357C307.568 14.9081 259.771 22.7798 196.776 58.596C179.306 -13.6957 151.603 -55.2606 127.922 -38.2394C104.241 -21.2181 91.9314 49.1704 95.8559 131.198C35.6311 184.076 -5.24942 239.816 -1.34339 268.128C2.57858 296.556 50.3756 288.684 113.371 252.868C130.86 321.145 157.627 359.699 180.55 343.223C203.473 326.746 215.732 260.141 212.981 181.334C273.956 128.235 315.428 71.8789 311.49 43.3357Z",
    w: 311,
    h: 311,
  },
  {
    d: "M414.973 186.331C410.064 153.061 341.982 130.658 251.657 128.637C228.526 39.1825 190.141 -23.6711 156.104 -20.5852C122.066 -17.4994 102.938 50.637 106.6 141.856C19.8136 160.072 -39.5599 193.893 -34.6713 227.028C-29.7628 260.298 38.3197 282.701 128.644 284.723C151.896 369.849 189.021 428.842 221.97 425.855C254.918 422.868 273.886 358.789 271.815 271.811C359.673 253.841 419.901 219.737 414.973 186.331Z",
    w: 315,
    h: 315,
  },
] as const;

export const OG_SIZE = { width: 1200, height: 630 };

/** Rubik subset with exactly the glyphs the card uses (Hebrew incl.) — the
 *  default og font is latin-only and would render Hebrew as tofu. Google
 *  returns TTF when fetched without a browser UA. */
async function loadHebrewFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Rubik:wght@700&text=${encodeURIComponent(text)}`
      )
    ).text();
    const m = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!m) return null;
    return await (await fetch(m[1])).arrayBuffer();
  } catch {
    return null;
  }
}

/** Satori has no RTL/bidi — Hebrew strings must be pre-reversed so the LTR
 *  layout draws them right-to-left. Latin-only strings pass through. */
const rtl = (s: string) =>
  /[֐-׿]/.test(s) ? [...s].reverse().join("") : s;

export async function personOgImage(p: {
  name: string;
  nameEnglish?: string;
  /** Transparent cut-out (art_image_url) — preferred. */
  cutoutUrl?: string | null;
  /** Flat photo fallback when there's no cut-out. */
  photoUrl?: string | null;
  colorIndex?: number | null;
  shapeIndex?: number | null;
  /** Backoffice zoom dial — only honored for football-logos-library crests
   *  (tight badges with no built-in padding); art_blobs cutouts already
   *  read right at the fixed CARD_W-30/CARD_H-60 box, so callers simply
   *  don't pass this for them. */
  imageScale?: number | null;
}) {
  const color = BLOB_HEX[Math.abs(p.colorIndex ?? 0) % BLOB_HEX.length];
  const isLogoLibraryCrest = p.cutoutUrl?.includes("/football-logos/") ?? false;
  const cutoutScale = isLogoLibraryCrest ? p.imageScale ?? 1 : 1;
  const si = Math.abs(p.shapeIndex ?? 0);
  const shape = BLOB_SHAPES[si % BLOB_SHAPES.length];
  const mirrored = si >= 3 && si <= 5;
  // shapeIndex 6-8 = the site's photo backgrounds (stadium etc.) instead of a
  // blob. Served from prod so the OG renderer can fetch them from anywhere.
  const photoBg =
    si >= 6
      ? `https://www.mega-events.co.il/art-backgrounds/${
          ["cars.jpg", "tennis.jpg", "football.jpg"][(si - 6) % 3]
        }`
      : null;
  // Card box (same proportions as the site's catalog card) with the blob
  // scaled to COVER it, like EventArt's blobFit="cover".
  const CARD_W = 410;
  const CARD_H = 530;
  const cover = Math.max(CARD_W / shape.w, CARD_H / shape.h) * 1.05;
  const bw = Math.round(shape.w * cover);
  const bh = Math.round(shape.h * cover);
  const tagline = "טיסות · מלון · כרטיסים — חבילה אחת";
  const font = await loadHebrewFont(
    `${p.name} ${p.nameEnglish ?? ""} MegaΣvents. ${tagline}`
  );
  const img = p.cutoutUrl || p.photoUrl || null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          backgroundColor: "#070618",
          color: "#FAFAF5",
          fontFamily: "Rubik",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1200,
            height: 630,
            background: `radial-gradient(620px 430px at 78% 45%, ${color}40, transparent 70%)`,
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "0 72px",
            width: 640,
          }}
        >
          <div style={{ display: "flex", fontSize: 36, color: "#5BFF95" }}>
            MegaΣvents.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 74,
              fontWeight: 700,
              marginTop: 22,
              lineHeight: 1.1,
            }}
          >
            {rtl(p.name)}
          </div>
          {p.nameEnglish ? (
            <div
              style={{
                display: "flex",
                fontSize: 42,
                color: "rgba(250,250,245,0.72)",
                marginTop: 10,
              }}
            >
              {p.nameEnglish}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: "rgba(250,250,245,0.78)",
              marginTop: 30,
            }}
          >
            {rtl(tagline)}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 560,
            height: 630,
            position: "relative",
          }}
        >
          {p.cutoutUrl ? (
            /* The site's catalog card, reproduced: dark rounded card, the
               real Figma blob covering it, cut-out on top. */
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                width: CARD_W,
                height: CARD_H,
                borderRadius: 44,
                overflow: "hidden",
                backgroundColor: "#0D0C1E",
                position: "relative",
                boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
              }}
            >
              {photoBg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoBg}
                  width={CARD_W}
                  height={CARD_H}
                  alt=""
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: CARD_W,
                    height: CARD_H,
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    position: "absolute",
                    top: (CARD_H - bh) / 2,
                    left: (CARD_W - bw) / 2,
                    width: bw,
                    height: bh,
                    transform: mirrored ? "scaleX(-1)" : "scaleX(1)",
                  }}
                >
                  <svg width={bw} height={bh} viewBox={`0 0 ${shape.w} ${shape.h}`}>
                    <path d={shape.d} fill={color} />
                  </svg>
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.cutoutUrl}
                width={Math.round((CARD_W - 30) * cutoutScale)}
                height={Math.round((CARD_H - 60) * cutoutScale)}
                alt=""
                style={{
                  width: Math.round((CARD_W - 30) * cutoutScale),
                  height: Math.round((CARD_H - 60) * cutoutScale),
                  objectFit: "contain",
                  position: "relative",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                width: 440,
                height: 440,
                borderRadius: 9999,
                backgroundColor: color,
                overflow: "hidden",
                boxShadow: `0 0 130px ${color}66`,
              }}
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  width={440}
                  height={440}
                  alt=""
                  style={{ width: 440, height: 440, objectFit: "cover" }}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: font
        ? [{ name: "Rubik", data: font, weight: 700, style: "normal" }]
        : undefined,
    }
  );
}
