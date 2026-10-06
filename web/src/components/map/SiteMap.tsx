"use client";

import dynamic from "next/dynamic";
import { MapSkeleton } from "./MadridMap";
import type { SiteMapProps } from "./SiteMapInner";

const Inner = dynamic(() => import("./SiteMapInner"), { ssr: false, loading: () => <MapSkeleton /> });

export default function SiteMap(props: SiteMapProps) {
  return <Inner {...props} />;
}
