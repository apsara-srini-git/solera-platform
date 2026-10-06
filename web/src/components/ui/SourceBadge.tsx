"use client";

import { useLang } from "@/lib/i18n/context";
import { cx } from "./cx";
import { splitSource } from "./sources";
import { Tooltip } from "./Tooltip";

export type SourceKind = "registry" | "catalogue" | "sermas" | "ceim" | "isciii" | "hospital" | "protocol";

const META: Record<SourceKind, { en: string; es: string; longEn: string; longEs: string; dot: string }> = {
  registry: {
    en: "Public registry", es: "Registro público",
    longEn: "ClinicalTrials.gov, REec (AEMPS) and CTIS (© EMA) public registrations",
    longEs: "Registros públicos ClinicalTrials.gov, REec (AEMPS) y CTIS (© EMA)",
    dot: "#2f6fb0",
  },
  catalogue: {
    en: "Hospital catalogue", es: "Catálogo de hospitales",
    longEn: "Catálogo Nacional de Hospitales, Ministerio de Sanidad",
    longEs: "Catálogo Nacional de Hospitales, Ministerio de Sanidad",
    dot: "#6b5bb5",
  },
  sermas: {
    en: "SERMAS open data", es: "Datos abiertos SERMAS",
    longEn: "Servicio Madrileño de Salud: annual activity open data",
    longEs: "Servicio Madrileño de Salud: datos abiertos de actividad anual",
    dot: "#b4553a",
  },
  ceim: {
    en: "AEMPS CEIm directory", es: "Directorio CEIm (AEMPS)",
    longEn: "AEMPS directory of accredited research ethics committees (CEIm)",
    longEs: "Directorio de CEIm acreditados de la AEMPS",
    dot: "#8a6d1e",
  },
  isciii: {
    en: "ISCIII institute list", es: "Listado ISCIII de IIS",
    longEn: "Instituto de Salud Carlos III: list of accredited health research institutes (IIS)",
    longEs: "Instituto de Salud Carlos III: listado de institutos de investigación sanitaria (IIS) acreditados",
    dot: "#1f7a8c",
  },
  hospital: {
    en: "Confirmed by hospital", es: "Confirmado por el hospital",
    longEn: "Answer confirmed by the hospital's research unit in a feasibility questionnaire",
    longEs: "Respuesta confirmada por la unidad de investigación del hospital",
    dot: "#0c8a4f",
  },
  protocol: {
    en: "From protocol", es: "Del protocolo",
    longEn: "Extracted from the sponsor's protocol and reviewed by the sponsor",
    longEs: "Extraído del protocolo del promotor",
    dot: "#58616a",
  },
};

export interface SourceBadgeProps {
  kind: SourceKind;
  /** Override the short label (e.g. "ClinicalTrials.gov"). */
  label?: string;
  /** ISO date or display date, shown as "· Mar 2026". */
  date?: string;
  /** Link to the source record / dataset. */
  href?: string;
  /** Extra tooltip detail (appended). */
  detail?: string;
  /** Interface language. Default: the page's UI language (useLang). Hospital pages pass their own. */
  lang?: "en" | "es";
  className?: string;
}

function fmtDate(d: string, lang: "en" | "es") {
  const t = Date.parse(d);
  if (Number.isNaN(t) || !/^\d{4}-\d{2}/.test(d)) return d;
  return new Date(t).toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Provenance tag for a fact: every pre-filled or displayed fact carries one.
 * <SourceBadge kind="catalogue" date="2025-01-01" />
 */
export function SourceBadge({ kind, label, date, href, detail, lang: langProp, className }: SourceBadgeProps) {
  const pageLang = useLang();
  const lang = langProp ?? pageLang;
  const m = META[kind];
  // defensive: a source string with a trailing note must not corrupt the link
  const src = href ? splitSource(href) : null;
  if (src) {
    href = src.href;
    if (src.note && !detail) detail = src.note;
  }
  const short = label ?? (lang === "es" ? m.es : m.en);
  const long = [lang === "es" ? m.longEs : m.longEn, detail].filter(Boolean).join(". ");
  const body = (
    <>
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.dot }} />
      <span className="truncate">{short}</span>
      {date && <span className="num shrink-0 whitespace-nowrap text-muted">· {fmtDate(date, lang)}</span>}
    </>
  );
  const cls = cx(
    "inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] leading-4 font-medium text-ink-2",
    href && "hover:border-line-strong hover:text-ink",
    className,
  );
  const sr = `${lang === "es" ? "Fuente" : "Source"}: ${long}`;
  return (
    <Tooltip content={<><span className="font-semibold">{lang === "es" ? "Fuente" : "Source"}</span><br />{long}</>}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls} aria-label={sr}>{body}</a>
      ) : (
        <span className={cls} tabIndex={0} aria-label={sr}>{body}</span>
      )}
    </Tooltip>
  );
}
