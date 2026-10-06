"use client";

import dynamic from "next/dynamic";
import { useLang } from "@/lib/i18n/context";
import { SEARCH } from "@/lib/i18n/pro/search";
import type { MadridMapProps } from "./MadridMapInner";

/** Leaflet touches `window`, so the map is client-only and code-split (next/dynamic, ssr: false). */
const Inner = dynamic(() => import("./MadridMapInner"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export function MapSkeleton({ label }: { label?: string }) {
  const fallback = SEARCH[useLang()].map.loading;
  return (
    <div className="grid h-full w-full place-items-center bg-[#eef1f4] text-[13px] text-muted" role="status">
      <span className="inline-flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" />
        </svg>
        {label ?? fallback}
      </span>
    </div>
  );
}

export default function MadridMap(props: MadridMapProps) {
  return <Inner {...props} />;
}

export type { MadridMapProps };
