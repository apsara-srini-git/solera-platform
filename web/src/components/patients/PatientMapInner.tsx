"use client";

import "leaflet/dist/leaflet.css";
import "@/components/map/map.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { MADRID_BOUNDS, OSM_ATTRIBUTION, OSM_TILES } from "@/components/map/types";
import type { PatientHospital } from "@/lib/patients/types";
import { HospitalPhoto } from "./HospitalPhoto";

export interface PatientMapMarker {
  id: string;
  name: string;
  municipality: string;
  lat: number;
  lon: number;
  image: PatientHospital["image"];
  /** Matching open trials at this hospital (search mode). */
  total?: number;
  recruiting?: number;
  notYet?: number;
  unknown?: number;
  /** Search results filtered to this hospital. */
  listHref?: string;
  hospitalHref: string;
  /** Per-site status label (trial page). */
  statusLabel?: string;
}

export interface PatientMapLabels {
  aria: string;
  loading: string;
  legendTitle: string;
  legendText: string;
  legendSingle: string;
  /** Button that shows / hides the legend on phones. */
  legendToggle: string;
  countOne: string;
  countOther: string;
  recruiting: string;
  notYet: string;
  unknown: string;
  seeTrials: string;
  hospital: string;
  showAll: string;
  photoCredit: string;
  photoAlt: string; // with {name}
  noPhoto: string;
}

export interface PatientMapProps {
  markers: PatientMapMarker[];
  labels: PatientMapLabels;
  /** search = size by count + legend; sites = equal markers (a trial's hospitals); single = one hospital. */
  mode: "search" | "sites" | "single";
  className?: string;
  /** Highlight markers of the card under the pointer / keyboard focus (elements with data-site-ids). */
  linkCards?: boolean;
  locale: string;
}

// One neutral colour for every marker: size alone encodes the number of trials (never a quality scale).
const FILL = "#2f5d66";
const STROKE = "#ffffff";
const HILITE = "#0f1d22";

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

function radiusFor(n: number, max: number): number {
  if (max <= 0) return 7;
  return 5 + 15 * Math.sqrt(Math.max(0, n) / max);
}

function Fit({ bounds, single }: { bounds: L.LatLngBounds | null; single: L.LatLng | null }) {
  const map = useMap();
  const moved = useRef(false);
  useEffect(() => {
    const el = map.getContainer();
    const fit = () => {
      if (single) map.setView(single, 14, { animate: false });
      else map.fitBounds(bounds ?? L.latLngBounds(MADRID_BOUNDS), { padding: [36, 36], maxZoom: 13, animate: false });
    };
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === 0 || el.clientHeight === 0) return;
      map.invalidateSize({ pan: false });
      if (!moved.current) fit();
    });
    ro.observe(el);
    const stop = () => (moved.current = true);
    el.addEventListener("pointerdown", stop, { passive: true });
    el.addEventListener("wheel", stop, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("pointerdown", stop);
      el.removeEventListener("wheel", stop);
    };
  }, [map, bounds, single]);
  return null;
}

function ShowAll({ bounds, label }: { bounds: L.LatLngBounds | null; label: string }) {
  const map = useMap();
  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control leaflet-bar">
        <a
          href="#"
          role="button"
          title={label}
          aria-label={label}
          onClick={(e) => {
            e.preventDefault();
            map.flyToBounds(bounds ?? L.latLngBounds(MADRID_BOUNDS), { padding: [36, 36], maxZoom: 13, duration: 0.5 });
          }}
          className="grid! place-items-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
          </svg>
        </a>
      </div>
    </div>
  );
}

/** Lifts highlighted markers above the others (SVG paint order = DOM order). */
function Lift({ ids }: { ids: Set<string> }) {
  const map = useMap();
  useEffect(() => {
    if (ids.size === 0) return;
    map.eachLayer((l) => {
      const m = l as L.CircleMarker & { _pid?: string };
      if (m._pid && ids.has(m._pid)) m.bringToFront();
    });
  }, [map, ids]);
  return null;
}

export default function PatientMapInner({ markers, labels, mode, className, linkCards, locale }: PatientMapProps) {
  const [hover, setHover] = useState<Set<string>>(() => new Set());
  const [legendOpen, setLegendOpen] = useState(false);
  const max = useMemo(() => markers.reduce((m, x) => Math.max(m, x.total ?? 0), 0), [markers]);
  const bounds = useMemo(() => (markers.length ? L.latLngBounds(markers.map((m) => [m.lat, m.lon] as [number, number])) : null), [markers]);
  const single = useMemo(() => (mode === "single" && markers[0] ? L.latLng(markers[0].lat, markers[0].lon) : null), [mode, markers]);
  // big markers first so small ones stay clickable on top
  const ordered = useMemo(() => [...markers].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)), [markers]);
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  useEffect(() => {
    if (!linkCards) return;
    let last = "";
    const update = (target: EventTarget | null) => {
      const el = target instanceof Element ? target.closest<HTMLElement>("[data-site-ids]") : null;
      const v = el?.dataset.siteIds ?? "";
      if (v === last) return;
      last = v;
      setHover(new Set(v ? v.split(",") : []));
    };
    const over = (e: Event) => update(e.target);
    document.addEventListener("pointerover", over, { passive: true });
    document.addEventListener("focusin", over);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("focusin", over);
    };
  }, [linkCards]);

  const legendSizes = useMemo(() => {
    if (mode !== "search" || max <= 0) return [];
    const vals = [...new Set([1, Math.max(1, Math.round(max / 4)), max])].filter((v) => v <= max);
    return vals.map((v) => ({ v, r: radiusFor(v, max) }));
  }, [mode, max]);

  return (
    <div className={className} role="region" aria-label={labels.aria}>
      <MapContainer
        className="solera-map h-full w-full"
        bounds={bounds ?? L.latLngBounds(MADRID_BOUNDS)}
        boundsOptions={{ padding: [36, 36], maxZoom: mode === "single" ? 14 : 13 }}
        minZoom={8}
        maxZoom={18}
        zoomSnap={0.5}
        scrollWheelZoom={mode === "search"}
        attributionControl
      >
        <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} />
        <Fit bounds={bounds} single={single} />
        {mode !== "single" && <ShowAll bounds={bounds} label={labels.showAll} />}
        <Lift ids={hover} />
        {ordered.map((m) => {
          const lit = hover.has(m.id);
          const r = mode === "search" ? radiusFor(m.total ?? 0, max) : mode === "single" ? 9 : 8;
          return (
            <CircleMarker
              key={m.id}
              ref={(ref) => {
                if (ref) (ref as L.CircleMarker & { _pid?: string })._pid = m.id;
              }}
              center={[m.lat, m.lon]}
              radius={lit ? r + 2 : r}
              pathOptions={{
                color: lit ? HILITE : STROKE,
                weight: lit ? 3 : 1.5,
                fillColor: FILL,
                fillOpacity: lit ? 0.95 : 0.78,
                opacity: 1,
              }}
              bubblingMouseEvents={false}
            >
              <Tooltip direction="top" offset={[0, -r - 2]} className="solera-tip" opacity={1}>
                {m.name}
                {mode === "search" && m.total != null ? ` · ${nf.format(m.total)}` : ""}
              </Tooltip>
              <Popup offset={[0, -4]} autoPanPadding={[24, 24]} maxWidth={264} minWidth={264}>
                <div>
                  <HospitalPhoto
                    image={m.image}
                    labels={{ credit: labels.photoCredit, alt: fill(labels.photoAlt, { name: m.name }), noPhoto: labels.noPhoto }}
                    className="h-28 w-full"
                  />
                  <div className="space-y-1.5 px-3.5 pt-2.5 pb-3">
                    <p className="text-[14px] leading-snug font-semibold text-ink">{m.name}</p>
                    <p className="text-[12px] text-muted">{m.municipality}</p>
                    {m.statusLabel && <p className="text-[12.5px] text-ink-2">{m.statusLabel}</p>}
                    {mode === "search" && m.total != null && (
                      <>
                        <p className="text-[13px] font-medium text-ink">
                          {fill(m.total === 1 ? labels.countOne : labels.countOther, { n: nf.format(m.total) })}
                        </p>
                        <ul className="text-[12px] text-ink-2">
                          {!!m.recruiting && <li>{fill(labels.recruiting, { n: nf.format(m.recruiting) })}</li>}
                          {!!m.notYet && <li>{fill(labels.notYet, { n: nf.format(m.notYet) })}</li>}
                          {!!m.unknown && <li>{fill(labels.unknown, { n: nf.format(m.unknown) })}</li>}
                        </ul>
                      </>
                    )}
                    <p className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[13px]">
                      {m.listHref && (
                        <Link href={m.listHref} className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
                          {labels.seeTrials}
                        </Link>
                      )}
                      <Link href={m.hospitalHref} className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
                        {labels.hospital}
                      </Link>
                    </p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      {mode === "search" && legendSizes.length > 0 && (
        <button
          type="button"
          onClick={() => setLegendOpen((o) => !o)}
          aria-expanded={legendOpen}
          aria-controls="patient-map-legend"
          className="absolute bottom-6 left-2 z-[501] inline-flex h-9 items-center rounded-full border border-line bg-surface/95 px-3 text-[12.5px] font-medium text-ink-2 shadow-card sm:hidden"
        >
          {labels.legendToggle}
        </button>
      )}
      {mode === "search" && legendSizes.length > 0 && (
        <div
          id="patient-map-legend"
          className={`pointer-events-none absolute bottom-16 left-2 z-[500] max-w-[11.5rem] rounded-xl border border-line bg-surface/95 px-2.5 py-2 text-[11px] sm:bottom-6 sm:left-2.5 sm:block sm:max-w-[15rem] sm:px-3 sm:py-2.5 sm:text-[12px] text-ink-2 shadow-card ${legendOpen ? "block" : "hidden"}`}
        >
          <p className="font-semibold text-ink">{labels.legendTitle}</p>
          <div className="mt-1.5 flex items-end gap-3" aria-hidden>
            {legendSizes.map(({ v, r }) => (
              <span key={v} className="flex flex-col items-center gap-1">
                <svg width={r * 2 + 4} height={r * 2 + 4}>
                  <circle cx={r + 2} cy={r + 2} r={r} fill={FILL} fillOpacity={0.78} stroke={STROKE} strokeWidth={1.5} />
                </svg>
                <span className="num text-[11px] text-muted">{nf.format(v)}</span>
              </span>
            ))}
          </div>
          <p className="mt-1.5 leading-snug">{labels.legendText}</p>
        </div>
      )}
    </div>
  );
}
