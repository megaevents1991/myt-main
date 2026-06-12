"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  MantineProvider,
  createTheme,
  MantineColorsTuple,
} from "@mantine/core";

// MegaEvents 2.0 pulse-mint (#5BFF95) — tonal ramp so Mantine components match
// the brand-book primary. Shade 4 is the exact brand neon.
const myColor: MantineColorsTuple = [
  "#E6FFEF",
  "#C2FFD8",
  "#99FFBE",
  "#70FFA4",
  "#5BFF95",
  "#2EE875",
  "#15C95C",
  "#0FA049",
  "#0A7637",
  "#064D24",
];

const theme = createTheme({
  colors: {
    myColor,
  },
  primaryColor: "myColor",
  // Shade 6 (#15C95C) — a harder green than the neon brand mint (shade 4).
  // Selection controls (stepper, checkboxes, sliders) need the stronger tone
  // to read clearly on light surfaces; big brand CTAs keep the neon mint via
  // Tailwind classes.
  primaryShade: 6,
});

/**
 * Bridges the site theme (`.dark` class on <html>, managed by ThemeToggle +
 * the no-FOUC script in layout.tsx) to Mantine's color scheme. Without this,
 * Mantine components (Modal, Select, inputs, Stepper…) stay light-schemed in
 * dark mode. forceColorScheme keeps Mantine's own scheme manager from
 * fighting the attribute; the observer follows live toggles.
 */
export function MantineThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setScheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const update = () =>
      setScheme(root.classList.contains("dark") ? "dark" : "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <MantineProvider theme={theme} forceColorScheme={scheme}>
      {children}
    </MantineProvider>
  );
}
s