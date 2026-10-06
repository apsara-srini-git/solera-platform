"use client";

import { useEffect } from "react";
import { cx } from "@/components/ui";

/** Opens every <details> before printing so registry criteria are printed in full. */
export function PrintExpand() {
  useEffect(() => {
    const open = () => document.querySelectorAll(".patient-portal details:not([open])").forEach((d) => d.setAttribute("open", ""));
    window.addEventListener("beforeprint", open);
    return () => window.removeEventListener("beforeprint", open);
  }, []);
  return null;
}

export function PrintButton({ label, className }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cx("portal-noprint btn-secondary h-9 gap-2", className)}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7v-7Z" />
      </svg>
      {label}
    </button>
  );
}
