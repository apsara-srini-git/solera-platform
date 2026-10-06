"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { registryUrl } from "@/lib/types";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";
import { useLang } from "@/lib/i18n/context";
import { joinList } from "@/lib/i18n/pro";
import { SOURCES, SOURCES_ES, fmtDay, trialStatusLabel, type SourceDates, type SourceId, type SourceMeta } from "./sources";

const DatesCtx = createContext<SourceDates>({});

/** Gives every SourceChip below it the real fetch dates / dataset links from the build report. */
export function SourceDatesProvider({ dates, children }: { dates: SourceDates; children: ReactNode }) {
  return <DatesCtx.Provider value={dates}>{children}</DatesCtx.Provider>;
}

export function useSourceDates() {
  return useContext(DatesCtx);
}

export interface TrialRecord {
  id: string;
  title: string;
  status: string;
  startYear: number | null;
  registryIds: string[];
}
export interface TrialRecordList {
  total: number;
  items: TrialRecord[];
}

export interface SourceChipProps {
  /** Where the number comes from. Trial counts: ["reec", "ctgov"]. */
  sources: SourceId | SourceId[];
  /** Popover heading, e.g. "60 trials in your condition". */
  title?: string;
  /** Chip text (default: the source's short name). Ignored when `children` is given. */
  label?: string;
  /** Specific links for this number (record, dataset file, catalogue page…). */
  links?: { label: string; href: string }[];
  /** The registry records behind a trial count (first 10 shown). */
  records?: TrialRecordList;
  /** Loads the records on first open (search results: kept off the page until asked for). */
  loadRecords?: () => Promise<TrialRecordList>;
  /** "View all" target when there are more records than shown. */
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Extra line under the heading (e.g. how the number was counted). */
  note?: ReactNode;
  /** Inline trigger: the number itself opens the popover (dotted underline). */
  children?: ReactNode;
  className?: string;
  /** Accessible name of the trigger (default "Source: …"). */
  ariaLabel?: string;
  /** Interface language of the popover. Default: the page's UI language (useLang). Hospital pages pass "es" / their own. */
  lang?: "en" | "es";
  /** Open "About this source" in a new tab (pages with a form the reader must not lose, e.g. the hospital questionnaire). */
  aboutInNewTab?: boolean;
}

const T = {
  en: {
    source: "Source", close: "Close", loading: "Loading registry records…",
    loadError: "The records could not be loaded. Try again in a moment.", none: "No registered trials to list.",
    loadErrorTu: "The records could not be loaded. Try again in a moment.",
    latest: (n: number, total: string) => <>Latest <span className="num">{n}</span> of <span className="num">{total}</span> registry records</>,
    count: (n: number, s: string) => <><span className="num">{s}</span> registry record{n === 1 ? "" : "s"}</>,
    viewAll: (total: string) => `View all ${total} in the trial list`,
    started: (y: number) => `Started ${y}`, fetched: "fetched", forThis: "For this number",
    about: (short: string | null) => `About ${short ?? "this source"}`, and: "and", newTab: "(opens in a new tab)",
    record: (reg: string, id: string) => `${reg} record ${id} (opens in a new tab)`, dataset: "Dataset", locale: "en",
  },
  es: {
    source: "Fuente", close: "Cerrar", loading: "Cargando registros…",
    loadError: "No se pudieron cargar los registros. Inténtelo de nuevo en un momento.", none: "Ningún ensayo registrado.",
    /** Same message in the "tú" register of the professional side (used when no explicit lang is given). */
    loadErrorTu: "No se han podido cargar los registros. Inténtalo de nuevo en un momento.",
    latest: (n: number, total: string) => <>Últimos <span className="num">{n}</span> de <span className="num">{total}</span> registros</>,
    count: (n: number, s: string) => <><span className="num">{s}</span> registro{n === 1 ? "" : "s"}</>,
    viewAll: (total: string) => `Ver los ${total} en la lista de ensayos`,
    started: (y: number) => `Inicio ${y}`, fetched: "consultado el", forThis: "Para este dato",
    about: (short: string | null) => `Sobre ${short ?? "esta fuente"}`, and: "y", newTab: "(se abre en otra pestaña)",
    record: (reg: string, id: string) => `Registro ${id} en ${reg} (se abre en otra pestaña)`, dataset: "Datos", locale: "es",
  },
};

/** Source metadata in the popover's language (Spanish falls back to English per field). */
function localMeta(id: SourceId, lang: "en" | "es"): SourceMeta {
  const m = SOURCES[id];
  return lang === "es" ? { ...m, ...SOURCES_ES[id] } : m;
}

const subscribeMq = (cb: () => void) => {
  const m = window.matchMedia("(max-width: 639px)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useIsPhone = () =>
  useSyncExternalStore(
    subscribeMq,
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false,
  );

const PANEL_W = 360;

/**
 * Clickable provenance for a number: opens a small popover (a bottom sheet on phones) with the source, what it is,
 * the specific record / dataset links, the date fetched and "About this source". Keyboard: Enter/Space opens, focus
 * moves into the popover, Tab stays inside, Esc closes and returns focus.
 */
export function SourceChip({
  sources,
  title,
  label,
  links,
  records,
  loadRecords,
  viewAllHref,
  viewAllLabel,
  note,
  children,
  className,
  ariaLabel,
  lang: langProp,
  aboutInNewTab = false,
}: SourceChipProps) {
  const pageLang = useLang();
  const lang = langProp ?? pageLang;
  const t = T[lang];
  const ids = Array.isArray(sources) ? sources : [sources];
  const metas = ids.map((id) => localMeta(id, lang));
  const dates = useSourceDates();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<TrialRecordList | null>(records ?? null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  // the popover renders inside the nearest open <dialog> (Modal / Drawer): a showModal() dialog makes the rest of the
  // page inert, so a popover portalled to <body> could not be clicked or focused
  const [host, setHost] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggle = () => {
    setHost(triggerRef.current?.closest<HTMLElement>("dialog[open]") ?? document.body);
    setOpen((o) => !o);
  };
  const phone = useIsPhone();
  const uid = useId();

  const list = records ?? loaded;

  const close = useCallback((restore = true) => {
    setOpen(false);
    if (restore) triggerRef.current?.focus();
  }, []);

  // position next to the trigger (desktop); recomputed on scroll / resize
  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const h = panelRef.current?.offsetHeight ?? 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(12, Math.min(r.left, vw - PANEL_W - 12));
    const below = vh - r.bottom;
    const above = below < h + 16 && r.top > below;
    setPos({ top: above ? Math.max(12, r.top - h - 8) : Math.min(r.bottom + 8, vh - h - 12), left, above });
  }, []);

  useLayoutEffect(() => {
    if (!open || phone) return;
    place();
  }, [open, phone, place, list, loadState]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault(); // inside a dialog: close the popover only, not the dialog
        close();
      }
    };
    const onMove = () => !phone && place();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, phone, place, close]);

  const loadingRef = useRef(false);
  useEffect(() => {
    if (!open || list || !loadRecords || loadingRef.current) return;
    loadingRef.current = true;
    setLoadState("loading");
    loadRecords()
      .then((l) => {
        setLoaded(l);
        setLoadState("idle");
      })
      .catch(() => setLoadState("error"))
      .finally(() => {
        loadingRef.current = false;
      });
  }, [open, list, loadRecords]);

  // keep Tab inside the popover
  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const f = [...panelRef.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])")];
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const chipText = label ?? metas.map((m) => m.short).join(" + ");
  const triggerName = ariaLabel ?? `${t.source}: ${joinList(metas.map((m) => m.short), lang)}${title ? `, ${title}` : ""}`;

  const trigger = children ? (
    <button
      ref={triggerRef}
      type="button"
      onClick={toggle}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? `${uid}-p` : undefined}
      aria-label={triggerName}
      className={cx(
        "cursor-pointer rounded-sm text-left text-inherit underline decoration-current/35 decoration-dotted decoration-1 underline-offset-[3px] hover:decoration-current hover:decoration-solid",
        className,
      )}
    >
      {children}
    </button>
  ) : (
    <button
      ref={triggerRef}
      type="button"
      onClick={toggle}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? `${uid}-p` : undefined}
      aria-label={triggerName}
      className={cx(
        "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] leading-4 font-medium text-ink-2 transition hover:border-line-strong hover:text-ink",
        open && "border-brand-400 text-ink",
        className,
      )}
    >
      <span className="inline-flex shrink-0 -space-x-0.5" aria-hidden>
        {metas.map((m) => (
          <span key={m.id} className="h-1.5 w-1.5 rounded-full ring-1 ring-surface" style={{ background: m.dot }} />
        ))}
      </span>
      <span className="truncate">{chipText}</span>
      <Icon name="chevronDown" size={11} className={cx("shrink-0 text-muted transition", open && "rotate-180")} />
    </button>
  );

  const shown = list?.items.slice(0, 10) ?? [];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{t.source}</p>
          <h2 id={`${uid}-t`} className="mt-0.5 text-sm leading-snug font-semibold text-ink">
            {title ?? metas.map((m) => m.name).join(" + ")}
          </h2>
          {note && <p className="mt-1 text-xs leading-snug text-ink-2">{note}</p>}
        </div>
        <button
          type="button"
          onClick={() => close()}
          aria-label={t.close}
          className="-mt-0.5 -mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
        >
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {(list || loadRecords) && (
          <div className="border-b border-line px-4 py-3">
            {loadState === "loading" && !list ? (
              <p className="flex items-center gap-2 text-xs text-muted">
                <Spinner size={13} /> {t.loading}
              </p>
            ) : loadState === "error" && !list ? (
              <p className="text-xs text-muted">{langProp ? t.loadError : t.loadErrorTu}</p>
            ) : list && list.total === 0 ? (
              <p className="text-xs text-muted">{t.none}</p>
            ) : list ? (
              <>
                <p className="text-xs font-medium text-ink-2">
                  {list.total > shown.length ? t.latest(shown.length, list.total.toLocaleString(t.locale)) : t.count(list.total, list.total.toLocaleString(t.locale))}
                </p>
                <ul className="mt-2 space-y-2">
                  {shown.map((r) => (
                    <li key={r.id} className="text-xs leading-snug">
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {r.registryIds.map((rid) => {
                          const reg = rid.startsWith("NCT") ? "ClinicalTrials.gov" : "REec";
                          return (
                            <a
                              key={rid}
                              href={registryUrl(rid)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[11.5px] font-medium text-brand-700 hover:underline"
                              aria-label={t.record(reg, rid)}
                            >
                              <span className="font-sans text-[10.5px] font-normal text-muted">{reg === "REec" ? "REec" : "CT.gov"}</span>
                              {rid}
                            </a>
                          );
                        })}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-ink-2">{r.title}</div>
                      <div className="mt-0.5 text-[11px] text-muted">
                        {[r.startYear ? t.started(r.startYear) : null, trialStatusLabel(r.status, lang)]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </li>
                  ))}
                </ul>
                {list.total > shown.length && viewAllHref && (
                  <Link href={viewAllHref} onClick={() => close(false)} className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                    {viewAllLabel ?? t.viewAll(list.total.toLocaleString(t.locale))} <Icon name="arrowRight" size={12} />
                  </Link>
                )}
              </>
            ) : null}
          </div>
        )}

        <ul className="divide-y divide-line">
          {metas.map((m) => {
            const d = dates[m.id];
            const official = d?.url ?? m.url;
            const dataset = d?.datasetUrl && d.datasetUrl !== official ? d.datasetUrl : m.datasetUrl;
            return (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: m.dot }} />
                  {m.name}
                </div>
                <p className="mt-1 text-xs leading-snug text-ink-2">{m.what}</p>
                <p className="mt-1 text-[11.5px] text-muted">
                  {m.publisher}
                  {d?.fetchedAt ? (
                    <>
                      {" · "}{t.fetched} <span className="num">{fmtDay(d.fetchedAt, { lang })}</span>
                    </>
                  ) : null}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {official && <ExtLink href={official} newTab={t.newTab}>{m.urlLabel}</ExtLink>}
                  {dataset && dataset !== official && <ExtLink href={dataset} newTab={t.newTab}>{m.datasetLabel ?? t.dataset}</ExtLink>}
                </div>
              </li>
            );
          })}
        </ul>
        {links && links.length > 0 && (
          <div className="border-t border-line px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{t.forThis}</p>
            <ul className="mt-1.5 space-y-1 text-xs">
              {links.map((l) => (
                <li key={l.href + l.label}>
                  <ExtLink href={l.href} newTab={t.newTab}>{l.label}</ExtLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-subtle/60 px-4 py-2.5 text-xs">
        {metas.map((m) => (
          <Link
            key={m.id}
            href={`/data-sources#${m.id}`}
            onClick={() => close(false)}
            {...(aboutInNewTab ? { target: "_blank", rel: "noopener" } : {})}
            className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
          >
            {t.about(metas.length > 1 ? m.short : null)} <Icon name={aboutInNewTab ? "external" : "arrowRight"} size={12} />
            {aboutInNewTab && <span className="sr-only">{t.newTab}</span>}
          </Link>
        ))}
      </div>
    </>
  );

  return (
    <>
      {trigger}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          phone ? (
            <div className="fixed inset-0 z-[1200]">
              <div className="absolute inset-0 bg-ink/40" aria-hidden onClick={() => close()} />
              <div
                ref={panelRef}
                id={`${uid}-p`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${uid}-t`}
                tabIndex={-1}
                onKeyDown={onPanelKey}
                className="absolute animate-[ui-pop_180ms_ease-out] inset-x-0 bottom-0 flex max-h-[82dvh] flex-col rounded-t-2xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] text-left font-normal text-ink shadow-pop outline-none"
              >
                <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong" aria-hidden />
                {body}
              </div>
            </div>
          ) : (
            <div
              ref={panelRef}
              id={`${uid}-p`}
              role="dialog"
              aria-modal="false"
              aria-labelledby={`${uid}-t`}
              tabIndex={-1}
              onKeyDown={onPanelKey}
              style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: PANEL_W }}
              className="fixed animate-[ui-pop_140ms_ease-out] z-[1200] flex max-h-[min(520px,calc(100dvh-24px))] flex-col overflow-hidden rounded-xl border border-line bg-surface text-left font-normal text-ink shadow-pop outline-none"
            >
              {body}
            </div>
          ),
          host ?? document.body,
        )}
    </>
  );
}

function ExtLink({ href, children, newTab = "(opens in new tab)" }: { href: string; children: ReactNode; newTab?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
      {children}
      <Icon name="external" size={11} />
      <span className="sr-only">{newTab}</span>
    </a>
  );
}
