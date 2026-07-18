/* eslint-disable @typescript-eslint/no-require-imports */
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  future: {
    // hover: styles only on devices with a real pointer. On iOS, dragging a
    // finger to scroll fires :hover on the touched card — its hover shadow +
    // lift + image zoom then repaint on EVERY scroll gesture (the "cards
    // reload while scrolling" bug, real devices only). Desktop is unchanged.
    hoverOnlyWhenSupported: true,
  },
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      // Cap content width so the layout breathes on wide screens (side margins)
      // instead of running full-bleed edge-to-edge.
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1140px",
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
        // Core brand greens — constant across themes (see globals.css).
        // Supports opacity modifiers: `bg-glow/10`, `border-forest/60`, etc.
        forest: "hsl(var(--brand-forest))",
        glow: "hsl(var(--brand-glow))",
        // Brand-level aliases kept for existing `bg-main` / `text-secondary` usages.
        main: {
          DEFAULT: "hsl(var(--surface-inverse))",
          foreground: "hsl(var(--surface-inverse-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        surface: {
          inverse: "hsl(var(--surface-inverse))",
          "inverse-foreground": "hsl(var(--surface-inverse-foreground))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
        badge: {
          urgent: "hsl(var(--badge-urgent))",
          new: "hsl(var(--badge-new))",
          vip: "hsl(var(--badge-vip))",
          soldout: "hsl(var(--badge-soldout))",
          foreground: "hsl(var(--badge-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Brand neon accents (category coding, glows, blobs) — Figma brand palette
        brand: {
          mint: "hsl(var(--brand-mint))",
          aqua: "hsl(var(--brand-aqua))",
          violet: "hsl(var(--brand-violet))",
          coral: "hsl(var(--brand-coral))",
          gold: "hsl(var(--brand-gold))",
          orange: "hsl(var(--brand-orange))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Arial Hebrew", "Arial", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      fontSize: {
        // Figma brand-book type scale (display + h1/h2/h3 = display font; rest = body)
        "display-sm": ["2rem", { lineHeight: "1.25", fontWeight: "700" }], // = h1 32/40
        "display-md": ["2.5rem", { lineHeight: "1.2", fontWeight: "700" }], // = display 40/48
        "display-lg": ["3.5rem", { lineHeight: "1.1", fontWeight: "800" }], // hero (beyond Figma)
        h1: ["2rem", { lineHeight: "1.25", fontWeight: "700" }], // 32/40
        h2: ["1.375rem", { lineHeight: "1.27", fontWeight: "700" }], // 22/28
        h3: ["1.125rem", { lineHeight: "1.33", fontWeight: "400" }], // 18/24
        price: ["1.375rem", { lineHeight: "1.27", fontWeight: "700" }], // 22/28
        label: ["0.75rem", { lineHeight: "1.33", fontWeight: "600" }], // 12/16
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover": "0 10px 24px -6px rgb(0 0 0 / 0.12)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
