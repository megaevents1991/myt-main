"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { readStoredView, viewStateKey, writeStoredView } from "@/lib/viewState";

/**
 * `useState` that remembers its value for this page in this browser tab, so a refresh
 * or a Back from another page finds the list as the visitor left it (lib/viewState.ts).
 *
 * Safe on server-rendered pages: the first render always uses `fallback` (what the
 * server printed), and the stored value is applied right after hydration. `parse`
 * returns the value when it is still acceptable, or null to ignore it.
 *
 * `name` must be unique per page - two lists on one page need two names.
 */
export function useSessionState<T>(
  name: string,
  fallback: T,
  parse: (value: unknown) => T | null,
): [T, Dispatch<SetStateAction<T>>] {
  const key = viewStateKey(usePathname(), name);
  const [value, setValue] = useState<T>(fallback);
  // The key whose stored value was already read. Writing before that would replace
  // what is stored with the default the page opens on.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    const saved = readStoredView(key, parse);
    if (saved !== null) setValue(saved);
    setLoadedKey(key);
    // `parse` is a per-call-site constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (loadedKey !== key) return;
    writeStoredView(key, Object.is(value, fallback) ? null : value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey, key, value]);

  return [value, setValue];
}
