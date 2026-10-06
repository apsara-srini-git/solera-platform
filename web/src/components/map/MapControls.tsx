"use client";

import { useEffect } from "react";
import { ZoomControl, useMap } from "react-leaflet";
import { useLang } from "@/lib/i18n/context";
import { SEARCH } from "@/lib/i18n/pro/search";

/** Zoom buttons with titles in the page language, and the Leaflet attribution prefix without its English title. */
export function MapControls() {
  const t = SEARCH[useLang()].map;
  const map = useMap();
  useEffect(() => {
    map.attributionControl?.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  }, [map]);
  return <ZoomControl key={t.zoomIn} position="topleft" zoomInTitle={t.zoomIn} zoomOutTitle={t.zoomOut} />;
}
