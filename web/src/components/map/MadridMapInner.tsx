"use client";

import "leaflet/dist/leaflet.css";
import "./map.css";
import L from "leaflet";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useLang } from "@/lib/i18n/context";
import { SEARCH } from "@/lib/i18n/pro/search";
import { scoreColor, scoreRadius } from "@/lib/score-scale";
import { MapControls } from "./MapControls";
import { MADRID_BOUNDS, OSM_TILES, type MapSite, type MarkerState } from "./types";

export interface MadridMapProps {
  sites: MapSite[];
  /** Per-site marker state; a site missing from the map is drawn neutral (before a search). */
  markers?: Map<string, MarkerState> | null;
  hoveredId?: string | null;
  selectedId?: string | null;
  onHover?: (id: string | null) => void;
  /** Marker click (id) or popup closed (null). */
  onSelect?: (id: string | null) => void;
  /** Content of the click popup. */
  renderPopup?: (site: MapSite) => ReactNode;
  /** Overlay drawn on top of the map (legend). */
  overlay?: ReactNode;
  className?: string;
  scrollWheelZoom?: boolean;
}

// every state sets stroke opacity and dashArray explicitly: react-leaflet only calls setStyle with the new options, so a
// key a state leaves out would keep the previous state's value (e.g. an excluded marker's dashes after it becomes ranked)
const NEUTRAL: L.PathOptions = { color: "#ffffff", weight: 1.5, fillColor: "#3d4a52", fillOpacity: 0.88, opacity: 1, dashArray: "" };
const UNRANKED: L.PathOptions = { color: "#ffffff", weight: 1, fillColor: "#9aa5b1", fillOpacity: 0.9, opacity: 1, dashArray: "" };
const EXCLUDED: L.PathOptions = { color: "#9aa5b1", weight: 1, fillColor: "#d5dbe2", fillOpacity: 0.55, opacity: 0.7, dashArray: "2 2" };
const HIGHLIGHT: L.PathOptions = { color: "#0f1d22", weight: 3, opacity: 1 };

function styleFor(state: MarkerState): { radius: number; path: L.PathOptions; order: number } {
  switch (state.kind) {
    case "ranked": {
      const c = scoreColor(state.score);
      return {
        radius: scoreRadius(state.score, { min: 6, max: 16 }),
        path: { color: c.stroke, weight: 1.5, fillColor: c.fill, fillOpacity: 0.95, opacity: 1, dashArray: "" },
        order: 100 + state.score,
      };
    }
    case "excluded":
      return { radius: 5, path: EXCLUDED, order: 1 };
    case "unranked":
      return { radius: 4, path: UNRANKED, order: 0 };
    default:
      return { radius: 7, path: NEUTRAL, order: 50 };
  }
}

function tooltipText(site: MapSite, state: MarkerState, newToTrials: string) {
  if (state.kind === "ranked") return `${state.score} · ${site.name}`;
  if (state.kind === "excluded") return `${site.name}: ${state.reason}`;
  if (state.kind === "unranked") return `${site.name}: ${newToTrials}`;
  return site.name;
}

/** Keeps the map sized to its container (view switches, sticky panes) and fits Madrid once it has a real size.
 *  A map mounted inside a hidden (display:none) pane is 0×0: fitting it then falls back to max zoom, so the fit is
 *  repeated the first time the container gets a size (e.g. tapping "Map" on a phone), and on later resizes until the user
 *  has dragged, zoomed or clicked the map. */
/** Padding / max zoom for the automatic fit: tighter around a ranked result set, looser for all of Madrid. */
type FitOptions = { paddingTopLeft: [number, number]; paddingBottomRight: [number, number]; maxZoom: number };
const FIT_ALL: FitOptions = { paddingTopLeft: [28, 28], paddingBottomRight: [28, 28], maxZoom: 13 };
// extra bottom padding keeps ranked markers clear of the fit-score legend in the bottom-left corner
const FIT_RANKED: FitOptions = { paddingTopLeft: [48, 48], paddingBottomRight: [48, 150], maxZoom: 13 };

function MapBehaviour({ bounds, fitOptions, selected }: { bounds: L.LatLngBounds | null; fitOptions: FitOptions; selected: L.LatLng | null }) {
  const map = useMap();
  const fitted = useRef(false);
  const userMoved = useRef(false);
  const boundsRef = useRef(bounds);
  const optsRef = useRef(fitOptions);
  useLayoutEffect(() => {
    boundsRef.current = bounds;
    optsRef.current = fitOptions;
  }, [bounds, fitOptions]);
  useEffect(() => {
    const el = map.getContainer();
    const hasSize = () => el.clientWidth > 0 && el.clientHeight > 0;
    const fit = () => {
      map.fitBounds(boundsRef.current ?? L.latLngBounds(MADRID_BOUNDS), { ...optsRef.current, animate: false });
      fitted.current = true;
    };
    const ro = new ResizeObserver(() => {
      if (!hasSize()) return;
      map.invalidateSize({ pan: false });
      // refit while the user has not taken over the view (first real size, or List → Map / Split → Map)
      if (!fitted.current || !userMoved.current) fit();
    });
    ro.observe(el);
    const moved = () => {
      userMoved.current = true;
    };
    // any pointer / wheel interaction with the map means the user has taken over the view
    el.addEventListener("pointerdown", moved, { passive: true });
    el.addEventListener("wheel", moved, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("pointerdown", moved);
      el.removeEventListener("wheel", moved);
    };
  }, [map]);
  useEffect(() => {
    if (selected && !map.getBounds().pad(-0.08).contains(selected)) map.panTo(selected, { animate: true, duration: 0.4 });
  }, [map, selected]);
  // fit on mount and whenever the focus changes (each new result set); only counts once the container has a real size.
  // A new result set hands the view back to the automatic fit, even if the user had moved the previous one.
  useEffect(() => {
    userMoved.current = false;
    const el = map.getContainer();
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      map.invalidateSize({ pan: false });
      map.fitBounds(bounds ?? L.latLngBounds(MADRID_BOUNDS), { ...fitOptions, animate: false });
      fitted.current = true;
    } else {
      fitted.current = false;
    }
  }, [map, bounds, fitOptions]);
  return null;
}

type OrderedLayer = L.CircleMarker & { _soleraOrder?: number; _soleraId?: string };

/** SVG paint order = DOM order. Keep high scores on top after every re-search, and lift the hovered/selected marker
 *  only while it is highlighted (Leaflet's bringToFront is otherwise permanent). */
function MarkerOrder({ ordered, hoveredId, selectedId }: { ordered: { site: MapSite }[]; hoveredId?: string | null; selectedId?: string | null }) {
  const map = useMap();
  useEffect(() => {
    const layers: OrderedLayer[] = [];
    map.eachLayer((l) => {
      const o = l as OrderedLayer;
      if (o._soleraOrder !== undefined) layers.push(o);
    });
    layers.sort((a, b) => a._soleraOrder! - b._soleraOrder!);
    for (const l of layers) l.bringToFront();
    for (const id of [selectedId, hoveredId]) if (id) layers.find((l) => l._soleraId === id)?.bringToFront();
  }, [map, ordered, hoveredId, selectedId]);
  return null;
}

function FitButton({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  const t = SEARCH[useLang()].map;
  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control leaflet-bar">
        <a
          href="#"
          role="button"
          title={t.showAll}
          aria-label={t.showAll}
          onClick={(e) => {
            e.preventDefault();
            map.flyToBounds(bounds ?? L.latLngBounds(MADRID_BOUNDS), { ...FIT_ALL, duration: 0.6 });
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

interface MarkerProps {
  site: MapSite;
  state: MarkerState;
  highlighted: boolean;
  showTooltip: boolean;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string | null) => void;
}

const SiteMarker = memo(function SiteMarker({ site, state, highlighted, showTooltip, onHover, onSelect }: MarkerProps) {
  const ref = useRef<L.CircleMarker>(null);
  const t = SEARCH[useLang()].map;
  const s = styleFor(state);
  const path = highlighted ? { ...s.path, ...HIGHLIGHT } : s.path;
  useEffect(() => {
    const m = ref.current as OrderedLayer | null;
    if (!m) return;
    m._soleraOrder = s.order;
    m._soleraId = site.id;
  }, [s.order, site.id]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    if (highlighted) {
      if (showTooltip) m.openTooltip();
    } else {
      m.closeTooltip();
    }
  }, [highlighted, showTooltip]);
  const handlers = useMemo<L.LeafletEventHandlerFnMap>(
    () => ({
      mouseover: () => onHover?.(site.id),
      mouseout: () => onHover?.(null),
      click: () => onSelect?.(site.id),
    }),
    [onHover, onSelect, site.id],
  );
  return (
    <CircleMarker
      ref={ref}
      center={[site.lat!, site.lon!]}
      radius={highlighted ? s.radius + 2 : s.radius}
      pathOptions={path}
      eventHandlers={handlers}
      bubblingMouseEvents={false}
    >
      {showTooltip && (
        <Tooltip direction="top" offset={[0, -s.radius - 2]} className="solera-tip" opacity={1}>
          {tooltipText(site, state, t.newToTrials)}
        </Tooltip>
      )}
    </CircleMarker>
  );
});

function MadridMapInner({
  sites,
  markers,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  renderPopup,
  overlay,
  className,
  scrollWheelZoom = true,
}: MadridMapProps) {
  const t = SEARCH[useLang()].map;
  const placed = useMemo(() => sites.filter((s) => s.lat != null && s.lon != null), [sites]);
  const bounds = useMemo(
    () => (placed.length ? L.latLngBounds(placed.map((s) => [s.lat!, s.lon!] as [number, number])) : null),
    [placed],
  );
  // after a search, frame the ranked hospitals (not the whole Comunidad) so their markers don't pile up;
  // recomputed only when a new result set arrives (markers), so hover / selection never refits
  const focus = useMemo(() => {
    const ranked = markers ? placed.filter((s) => markers.get(s.id)?.kind === "ranked") : [];
    if (!ranked.length) return { bounds, options: FIT_ALL };
    return { bounds: L.latLngBounds(ranked.map((s) => [s.lat!, s.lon!] as [number, number])), options: FIT_RANKED };
  }, [placed, markers, bounds]);
  // draw low-priority markers first so high scores sit on top
  const ordered = useMemo(() => {
    const withState = placed.map((site) => ({ site, state: markers?.get(site.id) ?? ({ kind: "neutral" } as MarkerState) }));
    return withState.sort((a, b) => styleFor(a.state).order - styleFor(b.state).order);
  }, [placed, markers]);
  const selected = selectedId ? placed.find((s) => s.id === selectedId) ?? null : null;
  const selectedLatLng = useMemo(() => (selected ? L.latLng(selected.lat!, selected.lon!) : null), [selected]);
  // Leaflet fires "remove" on the old popup when the selection moves to another marker; only a real close clears it.
  const selectedRef = useRef(selectedId);
  useLayoutEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  return (
    <div className={className} style={{ position: "relative" }}>
      <MapContainer
        className="solera-map h-full w-full"
        bounds={focus.bounds ?? L.latLngBounds(MADRID_BOUNDS)}
        boundsOptions={focus.options}
        minZoom={9}
        maxZoom={18}
        zoomSnap={0.5}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={90}
        scrollWheelZoom={scrollWheelZoom}
        attributionControl
        zoomControl={false}
      >
        <TileLayer url={OSM_TILES} attribution={t.attribution} maxZoom={19} />
        <MapControls />
        <MapBehaviour bounds={focus.bounds} fitOptions={focus.options} selected={selectedLatLng} />
        <FitButton bounds={bounds} />
        {ordered.map(({ site, state }) => (
          <SiteMarker
            key={site.id}
            site={site}
            state={state}
            highlighted={site.id === hoveredId || site.id === selectedId}
            showTooltip={site.id !== selectedId}
            onHover={onHover}
            onSelect={onSelect}
          />
        ))}
        <MarkerOrder ordered={ordered} hoveredId={hoveredId} selectedId={selectedId} />
        {selected && renderPopup && (
          <Popup
            key={selected.id}
            position={[selected.lat!, selected.lon!]}
            offset={[0, -6]}
            autoPanPadding={[24, 24]}
            maxWidth={264}
            minWidth={264}
            eventHandlers={{
              remove: () => {
                if (selectedRef.current === selected.id) onSelect?.(null);
              },
            }}
          >
            {renderPopup(selected)}
          </Popup>
        )}
      </MapContainer>
      {overlay}
    </div>
  );
}

export default MadridMapInner;
