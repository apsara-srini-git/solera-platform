"use client";

import dynamic from "next/dynamic";
import type { PatientMapProps } from "./PatientMapInner";

/** Leaflet needs `window`: client-only, code-split. */
const Inner = dynamic(() => import("./PatientMapInner"), {
  ssr: false,
  loading: () => null,
});

export default function PatientMap(props: PatientMapProps) {
  return (
    <div className={props.className} style={{ position: "relative" }}>
      <div className="absolute inset-0 grid place-items-center bg-[#eef1f4] text-[13px] text-muted" aria-hidden>
        {props.labels.loading}
      </div>
      <Inner {...props} className="absolute inset-0" />
    </div>
  );
}

export type { PatientMapProps };
