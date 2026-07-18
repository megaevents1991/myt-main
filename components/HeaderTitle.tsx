"use client";

import { useEffect } from "react";

/**
 * #25 — pushes the current page's title (artist / team name) to the global
 * Header so it sticks in the bar once the hero scrolls away. Renders nothing.
 */
export const HeaderTitle = ({ name }: { name: string }) => {
  useEffect(() => {
    const set = (detail: string | null) =>
      window.dispatchEvent(new CustomEvent("myt:header-title", { detail }));
    set(name);
    return () => {
      set(null);
    };
  }, [name]);
  return null;
};
