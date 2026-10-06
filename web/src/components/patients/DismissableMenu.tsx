"use client";

import { useEffect } from "react";

/** Closes open <details data-dismissable> menus on Escape (focus back on the summary) and on a click outside them. */
export function DismissableMenu() {
  useEffect(() => {
    const open = () => [...document.querySelectorAll<HTMLDetailsElement>("details[data-dismissable][open]")];
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      for (const d of open()) {
        d.open = false;
        d.querySelector<HTMLElement>("summary")?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      for (const d of open()) if (!d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
