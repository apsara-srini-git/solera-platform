import type { SiteImage } from "@/lib/types";

/** Client-safe hospital summary for maps and result cards (no personal data). */
export interface MapSite {
  id: string;
  name: string;
  municipality: string;
  ownership: "public" | "private";
  beds: number;
  lat: number | null;
  lon: number | null;
  image: SiteImage | null;
  institute: string | null;
  accreditedIIS: boolean;
  trialCount: number;
}

/** How a hospital is drawn on the search map. */
export type MarkerState =
  | { kind: "neutral" }
  | { kind: "ranked"; score: number; rank: number }
  | { kind: "excluded"; reason: string }
  | { kind: "unranked" };

/** Madrid region fallback view when no hospital has coordinates yet. */
export const MADRID_BOUNDS: [[number, number], [number, number]] = [
  [40.25, -3.95],
  [40.6, -3.5],
];

export const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
