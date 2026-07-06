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
}) {
  const color = BLOB_HEX[Math.abs(p.colorIndex ?? 0) % BLOB_HEX.length];
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
          }}
        >
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
                style={{
                  width: 440,
                  height: 440,
                  objectFit: p.cutoutUrl ? "contain" : "cover",
                }}
              />
            ) : null}
          </div>
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
