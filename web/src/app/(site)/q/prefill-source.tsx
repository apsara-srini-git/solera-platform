"use client";

import { SourceBadge, SourceChip, type SourceId } from "@/components/ui";
import { type PrefillSource, SOURCE_URL, sourceHref } from "@/lib/question-library";

const IDS: Record<Exclude<PrefillSource["kind"], "hospital">, SourceId[]> = {
  registry: ["reec", "ctgov"],
  catalogue: ["catalogue"],
  sermas: ["sermas"],
  ceim: ["ceim"],
  isciii: ["isciii"],
};

function fmtDate(d: string, lang: "en" | "es") {
  const t = Date.parse(d);
  if (Number.isNaN(t) || !/^\d{4}-\d{2}/.test(d)) return d;
  return new Date(t).toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Source of a pre-filled answer or hint (hospital questionnaire, sponsor preview, pre-fill drawer). Public sources open
 * a popover with what the source is, the link for this answer (registry counts: the records counted at the hospital,
 * in a new tab so the form is never lost) and "About this source" (/data-sources). Answers confirmed by the hospital
 * have no public source page and keep the plain badge.
 */
export function PrefillSourceChip({ source, q, recordsHref, lang, className }: {
  source: PrefillSource;
  q: { id: string; role?: string };
  recordsHref?: string | null;
  lang: "en" | "es";
  className?: string;
}) {
  const es = lang === "es";
  const label = es ? source.label : source.labelEn;
  const href = sourceHref(source, q, recordsHref);
  if (source.kind === "hospital") {
    return <SourceBadge kind="hospital" label={label} date={source.date} href={href} lang={lang} className={className} />;
  }
  const date = source.date ? fmtDate(source.date, lang) : null;
  const links = href
    ? [{
        href,
        label: source.kind === "registry"
          ? es ? "Ver los registros contados en este centro" : "See the records counted at this hospital"
          : es ? "Fuente de este dato" : "Source of this answer",
      }]
    : [];
  return (
    <SourceChip
      sources={IDS[source.kind]}
      lang={lang}
      aboutInNewTab
      label={date ? `${label} · ${date}` : label}
      title={label}
      note={date ? (es ? `Datos de ${date}` : `Data as of ${date}`) : undefined}
      // the dataset page is already listed under the source; only repeat a link that is specific to this answer
      links={links.filter((l) => l.href !== SOURCE_URL[source.kind as keyof typeof SOURCE_URL])}
      className={className}
    />
  );
}
