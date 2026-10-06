import type { ReactNode } from "react";
import { cx } from "@/components/ui";

// Calm, categorical visuals for therapeutic areas (no stock photos of patients). The colour only identifies the area;
// it never encodes quality, and the area name is always printed next to it.

interface AreaStyle {
  /** band background */
  bg: string;
  /** soft ring / pattern */
  tint: string;
  /** icon + label ink (≥ 7:1 on bg) */
  fg: string;
  path: string;
}

const AREA_STYLES: Record<string, AreaStyle> = {
  oncology: { bg: "#fcf1f5", tint: "#f4d3e0", fg: "#8b2a4f", path: "M12 3c-2 0-3.5 1.6-3.5 3.6 0 1.6 1 3.4 2.2 5.2L6 20l2.6.6 3.4-5.6 3.4 5.6L18 20l-4.7-8.2c1.2-1.8 2.2-3.6 2.2-5.2C15.5 4.6 14 3 12 3Z" },
  hematology: { bg: "#fdf2f0", tint: "#f6d5cf", fg: "#8e3125", path: "M12 3s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11Z" },
  cardiovascular: { bg: "#fff4ed", tint: "#f8dcc8", fg: "#8a3b12", path: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" },
  neurology: { bg: "#f4f1fd", tint: "#ddd5f6", fg: "#4f3a99", path: "M9.5 4A3 3 0 0 0 6.5 7 3 3 0 0 0 4.5 12a3 3 0 0 0 2 5 3 3 0 0 0 5.5 1V5.5A2.5 2.5 0 0 0 9.5 4Zm5 0a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-5.5 1" },
  psychiatry: { bg: "#eff3fd", tint: "#d3ddf6", fg: "#34489a", path: "M9 21v-3H7a2 2 0 0 1-2-2v-3l-2-1 2-3.5A7 7 0 0 1 19 9c0 2.6-1 4.2-2 5.5V21" },
  infectious: { bg: "#f2f8ec", tint: "#d8e9c6", fg: "#3f6212", path: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-12v4m0 8v4M4 12h4m8 0h4M6.3 6.3l2.9 2.9m5.6 5.6 2.9 2.9M6.3 17.7l2.9-2.9m5.6-5.6 2.9-2.9" },
  respiratory: { bg: "#eef7fc", tint: "#cfe6f3", fg: "#0b5a80", path: "M12 4v8m0 0-3 2m3-2 3 2M8.5 7C6 7 4 11 4 16c0 2 1 3 2.5 3S9 18 9 16V9.5A2.5 2.5 0 0 0 8.5 7Zm7 0C18 7 20 11 20 16c0 2-1 3-2.5 3S15 18 15 16V9.5A2.5 2.5 0 0 1 15.5 7Z" },
  gastro_hepatology: { bg: "#fdf6e9", tint: "#f3e1bd", fg: "#7c4a03", path: "M9 3v4c0 2-3 3-3 7a6 6 0 0 0 6 6h2a5 5 0 0 0 5-5c0-3-2-4-4-4s-3 1-4 1-1-1-1-2V3" },
  endocrine_metabolic: { bg: "#f8f7e8", tint: "#e7e3bd", fg: "#5f5a0b", path: "M7 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm.7-14.3 6.6 4.6M8.3 16.1l7-3.4" },
  // antibody "Y" (neutral; no shield or check mark, which could read as a safety / approval badge)
  immunology_rheumatology: { bg: "#ecf8f6", tint: "#c9e9e4", fg: "#0f5f59", path: "M12 21v-8m0 0L6.5 7.5M12 13l5.5-5.5M6.5 7.5 4 5m2.5 2.5L9 5m8.5 2.5L20 5m-2.5 2.5L15 5" },
  dermatology: { bg: "#fdf3ee", tint: "#f5dacd", fg: "#85432a", path: "M3 9l9-5 9 5-9 5-9-5Zm0 5 9 5 9-5" },
  nephrology_urology: { bg: "#edf5fb", tint: "#cde1f1", fg: "#1d4f7a", path: "M15 4c3 0 5 3.5 5 8s-2 8-5 8-4-2-4-4 1.5-2.5 1.5-4S11 9.5 11 8s1-4 4-4ZM4 12h7.5" },
  womens_health: { bg: "#fbf0fa", tint: "#f0d3ec", fg: "#7d2a72", path: "M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 0v7m-3-3h6" },
  ophthalmology: { bg: "#eef2fd", tint: "#d2dcf6", fg: "#2b4a9b", path: "M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
  rare_genetic: { bg: "#f5effc", tint: "#e0d2f3", fg: "#5b2d8e", path: "M7 3c0 6 10 6 10 12 0 3-2 5-2 6M17 3c0 6-10 6-10 12 0 3 2 5 2 6M8.5 7h7M8.5 17h7" },
};

const DEFAULT_STYLE: AreaStyle = {
  bg: "#f1f4f6",
  tint: "#dde3e8",
  fg: "#3d4a52",
  path: "M9 4h6v3H9V4Zm-2 1H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M8.5 12h7M8.5 16h5",
};

export function areaStyle(area: string | undefined): AreaStyle {
  return (area && AREA_STYLES[area]) || DEFAULT_STYLE;
}

export function AreaIcon({ area, size = 18, className }: { area?: string; size?: number; className?: string }) {
  const s = areaStyle(area);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" className={className}>
      <path d={s.path} />
    </svg>
  );
}

/** Coloured header band: area icon + name on the left, `right` slot (status pill) on the right, a faint large icon
 *  as decoration. */
export function AreaBand({
  area,
  label,
  extra,
  caption,
  right,
  className,
  size = "md",
}: {
  area?: string;
  label: string;
  extra?: string;
  /** Small muted line under the label (e.g. that the area is Solera's own grouping, not registry data). */
  caption?: string;
  right?: ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  const s = areaStyle(area);
  return (
    <div
      className={cx("relative isolate flex flex-wrap items-start justify-between gap-x-3 gap-y-2 overflow-hidden", size === "lg" ? "px-5 py-5 sm:px-7" : "px-4 pt-3.5 pb-3", className)}
      style={{ background: `linear-gradient(120deg, ${s.bg} 0%, ${s.bg} 55%, ${s.tint} 140%)`, color: s.fg }}
    >
      <svg
        aria-hidden
        focusable="false"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cx("pointer-events-none absolute -z-10 opacity-[0.13]", size === "lg" ? "-right-4 -bottom-10 h-44 w-44" : "-right-3 -bottom-7 h-24 w-24")}
      >
        <path d={s.path} />
      </svg>
      <span className="inline-flex min-w-[9.5rem] flex-1 items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/80 ring-1 ring-current/15">
          <AreaIcon area={area} size={17} />
        </span>
        <span className="min-w-0 text-[12.5px] leading-tight font-semibold">
          {label}
          {extra && <span className="ml-1 font-medium opacity-80">{extra}</span>}
          {caption && <span className="mt-0.5 block text-[11px] font-normal opacity-85">{caption}</span>}
        </span>
      </span>
      {right && <span className="shrink-0">{right}</span>}
    </div>
  );
}
