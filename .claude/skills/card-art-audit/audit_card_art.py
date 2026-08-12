"""Audit every artist / football-team card image (see SKILL.md).

Reads .env.local for Supabase credentials, then for each person with card art:
  - fetches the image, reports HTTP status and weight
  - measures the SOLID-alpha bounding box (matting leaves a full-canvas veil,
    so `alpha > 0` measures nothing) and reports how much canvas is wasted
  - flags buckets next/image would reject

  --sheet also renders each person across the three card aspect ratios the site
  uses (hero carousel / catalog card / detail circle) into one PNG to eyeball.

Usage:
    python .claude/skills/card-art-audit/audit_card_art.py [--sheet] [--out DIR]
"""

import argparse
import io
import json
import os
import re
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

# Brand blob palette, mirrored from lib/eventArt.ts (sheet stand-in only).
COLORS = ["#5BFF95", "#45E2FF", "#BBA1FF", "#FF4F61", "#FACC15", "#FF9D4D"]
SOLID = 200          # alpha at/above this counts as subject
MIN_RUN = 0.002      # a row/column needs this fraction solid to count
WASTED_LIMIT = 12    # % of canvas; above this the asset needs trimming
HEAVY_MB = 3.0
ALLOWED_PREFIX = "/storage/v1/object/public/"


def load_env(root):
    env = {}
    path = os.path.join(root, ".env.local")
    if not os.path.exists(path):
        sys.exit(f"missing {path}")
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            m = re.match(r"^([A-Z_]+)=(.*)$", line.strip())
            if m:
                env[m.group(1)] = m.group(2).strip().strip('"')
    return env


def solid_bbox(im):
    """Bounding box of solidly opaque pixels, ignoring specks and matting veil."""
    alpha = np.array(im.getchannel("A"))
    h, w = alpha.shape
    solid = alpha >= SOLID
    rows = np.where(solid.sum(1) >= max(1, int(w * MIN_RUN)))[0]
    cols = np.where(solid.sum(0) >= max(1, int(h * MIN_RUN)))[0]
    if not len(rows) or not len(cols):
        return None
    return int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1


def contain(im, bw, bh, scale=1.0):
    s = min(bw / im.width, bh / im.height) * scale
    return im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)


def card(im, color, w, h, anchor="center", scale=1.0):
    c = Image.new("RGBA", (w, h), (13, 26, 20, 255))
    ImageDraw.Draw(c).ellipse([-w * 0.25, h * 0.1, w * 1.25, h * 1.3], fill=color)
    p = contain(im, w, h, scale)
    y = (h - p.height) // 2 if anchor == "center" else h - p.height
    c.alpha_composite(p, ((w - p.width) // 2, y))
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", action="store_true", help="render the contact sheet")
    ap.add_argument("--out", default=".", help="where to write the sheet")
    ap.add_argument(
        "--fail-on-issues",
        action="store_true",
        help="exit 1 when anything is flagged (used by CI)",
    )
    args = ap.parse_args()

    root = os.getcwd()
    env = load_env(root)
    base = env["NEXT_SECRET_SUPABASE_URL"]
    key = env["NEXT_SECRET_SUPABASE_SERVICE_KEY"]
    headers = {"apikey": key, "Authorization": "Bearer " + key}

    def get(path):
        req = urllib.request.Request(base + path, headers=headers)
        return json.loads(urllib.request.urlopen(req, timeout=90).read())

    people, problems = [], []
    for table in ("artists", "football_teams"):
        rows = get(
            f"/rest/v1/{table}?select=name_english,art_image_url,art_color_index,"
            "art_image_scale,art_image_offset_y&art_image_url=not.is.null"
            "&is_active=eq.true&is_deleted=eq.false&order=name_english"
        )
        for r in rows:
            url = r["art_image_url"]
            name = str(r["name_english"])[:28]
            kind = "team" if table == "football_teams" else "artist"
            if ALLOWED_PREFIX not in url:
                problems.append(f"{name}: not a public Supabase URL - next/image will 400")
            try:
                raw = urllib.request.urlopen(url, timeout=120).read()
            except Exception as exc:  # noqa: BLE001 - report, never abort the audit
                problems.append(f"{name}: image unreachable ({type(exc).__name__})")
                print(f"{name:30} {kind:6} UNREACHABLE")
                continue
            mb = len(raw) / 1e6
            try:
                im = Image.open(io.BytesIO(raw)).convert("RGBA")
            except Exception:  # noqa: BLE001
                problems.append(f"{name}: not a decodable image")
                continue
            bb = solid_bbox(im)
            flags = []
            wasted = 0
            if bb:
                fw = (bb[2] - bb[0]) / im.width
                fh = (bb[3] - bb[1]) / im.height
                wasted = round((1 - fw * fh) * 100)
                # Crests are padded ON PURPOSE - FOOTBALL_CREST_ART sizes them on
                # their stadium background, and hand-trimming them is what broke
                # Inter / Bayern / PSG. Only people must be tight.
                if kind == "artist" and wasted >= WASTED_LIMIT:
                    flags.append(f"PADDED {wasted}%")
            else:
                flags.append("NO SOLID PIXELS")
            if mb > HEAVY_MB:
                flags.append(f"HEAVY {mb:.1f}MB")
            # Dials on a person distort the tall surfaces (see SKILL.md invariant 2).
            if kind == "artist" and (
                (r["art_image_scale"] or 1) != 1 or (r["art_image_offset_y"] or 0) != 0
            ):
                flags.append("DIAL SET (reset to 1/0 once trimmed)")
            print(
                f"{name:30} {kind:6} {im.width}x{im.height:<5} "
                f"{mb:5.2f}MB waste {wasted:3d}%  {' | '.join(flags)}"
            )
            if flags:
                problems.append(f"{name}: {', '.join(flags)}")
            if args.sheet:
                people.append((name, im, COLORS[(r["art_color_index"] or 0) % len(COLORS)]))

    print("\n" + (f"{len(problems)} issue(s):" if problems else "no issues"))
    for p in problems:
        print("  -", p)

    if args.sheet and people:
        HW, HH, CW, CH, SW, SH, pad, cols = 220, 320, 220, 250, 220, 220, 10, 4
        cell_w, cell_h = HW + CW + SW + pad * 3, max(HH, CH, SH) + 26
        rows_n = (len(people) + cols - 1) // cols
        sheet = Image.new(
            "RGBA", (cell_w * cols + pad, cell_h * rows_n + pad), (245, 245, 240, 255)
        )
        draw = ImageDraw.Draw(sheet)
        for i, (name, im, color) in enumerate(people):
            x = (i % cols) * cell_w + pad
            y = (i // cols) * cell_h + pad
            sheet.alpha_composite(card(im, color, HW, HH, "center"), (x, y + 20))
            sheet.alpha_composite(card(im, color, CW, CH, "bottom"), (x + HW + pad, y + 20))
            sheet.alpha_composite(
                card(im, color, SW, SH, "bottom", 0.8), (x + HW + CW + pad * 2, y + 20)
            )
            draw.text((x + 4, y + 4), name, fill=(0, 0, 0, 255))
        out = os.path.join(args.out, "card-art-surfaces.png")
        sheet.convert("RGB").save(out)
        print(f"\ncontact sheet: {out}  (hero | catalog | circle - READ IT)")

    if problems and args.fail_on_issues:
        sys.exit(1)


if __name__ == "__main__":
    main()
