"use client";

import "leaflet/dist/leaflet.css";
import "./map.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { useLang } from "@/lib/i18n/context";
import { SEARCH } from "@/lib/i18n/pro/search";
import { MapControls } from "./MapControls";
import { OSM_TILES } from "./types";

export interface SiteMapProps {
  lat: number;
  lon: number;
  name: string;
  className?: string;
}

/** Small locator map for one hospital (site detail page). */
export default function SiteMapInner({ lat, lon, name, className }: SiteMapProps) {
  const attribution = SEARCH[useLang()].map.attribution;
  return (
    <div className={className}>
      <MapContainer className="solera-map h-full w-full" center={[lat, lon]} zoom={14} scrollWheelZoom={false} zoomControl={false} attributionControl>
        <TileLayer url={OSM_TILES} attribution={attribution} maxZoom={19} />
        <MapControls />
        <CircleMarker center={[lat, lon]} radius={18} pathOptions={{ stroke: false, fillColor: "#007775", fillOpacity: 0.15 }} interactive={false} />
        <CircleMarker center={[lat, lon]} radius={8} pathOptions={{ color: "#ffffff", weight: 2.5, fillColor: "#007775", fillOpacity: 1 }}>
          <Tooltip direction="top" offset={[0, -10]} className="solera-tip" opacity={1}>{name}</Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
