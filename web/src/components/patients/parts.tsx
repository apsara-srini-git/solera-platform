import type { ReactNode } from "react";
import { Badge, Icon, cx } from "@/components/ui";
import { dict, fmt, langName } from "@/lib/patients/i18n";
import { MADRID_STATUS_LABELS, REGISTRY_LABELS, SITE_STATUS_LABELS, STALE_NOTE, madridStatus } from "@/lib/patients/labels";
import type { Lang, LinkRegistry, Registry, RegistryText, SiteStatus, TextSource } from "@/lib/patients/types";

// Small server-safe building blocks shared by the patient portal pages.

export const SHORT_REGISTRY: Record<LinkRegistry, string> = {
  reec: "REec",
  ctgov: "ClinicalTrials.gov",
  ctis: "CTIS",
  euctr: "EU CTR",
};

/** Status across the trial's Madrid hospitals. Green only when at least one Madrid hospital is confirmed recruiting. */
export function MadridStatusPill({ sites, lang, className }: { sites: readonly { status: SiteStatus }[]; lang: Lang; className?: string }) {
  const st = madridStatus(sites);
  return (
    <Badge tone={SITE_TONE[st]} dot size="md" className={cx("h-auto min-h-6 bg-white/90 py-0.5 whitespace-normal", className)}>
      {MADRID_STATUS_LABELS[st][lang]}
    </Badge>
  );
}

const SITE_TONE: Record<SiteStatus, "success" | "info" | "neutral"> = { recruiting: "success", not_yet: "info", unknown: "neutral" };

export function SiteStatusPill({ status, lang, className }: { status: SiteStatus; lang: Lang; className?: string }) {
  return (
    <Badge tone={SITE_TONE[status]} dot size="md" className={cx("h-auto min-h-6 py-0.5 whitespace-normal", className)}>
      {SITE_STATUS_LABELS[status][lang]}
    </Badge>
  );
}

/** Link to an external official page; announces the new tab to screen readers. */
export function ExternalLink({ href, lang, children, className }: { href: string; lang: Lang; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cx("inline-flex items-center gap-1 font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800 hover:decoration-brand-600", className)}>
      {children}
      <Icon name="external" size={13} className="shrink-0" />
      <span className="sr-only"> {dict(lang).opensNewTab}</span>
    </a>
  );
}

export function StaleNotice({ lang, className, compact }: { lang: Lang; className?: string; compact?: boolean }) {
  return (
    <p className={cx("flex items-start gap-2 rounded-lg bg-amber-50 text-amber-900 ring-1 ring-amber-200 ring-inset", compact ? "px-2.5 py-1.5 text-[12.5px]" : "px-3.5 py-2.5 text-sm", className)}>
      <Icon name="alert" size={compact ? 14 : 16} className="mt-0.5 shrink-0" />
      <span>{STALE_NOTE[lang]}</span>
    </p>
  );
}

export function registryName(r: LinkRegistry, lang: Lang, long = false): string {
  return long ? REGISTRY_LABELS[r][lang] : SHORT_REGISTRY[r];
}

/** "Fuente: REec · 2025-…" line under a verbatim text. */
export function SourceLine({ source, lang, className }: { source: TextSource | null | undefined; lang: Lang; className?: string }) {
  if (!source) return null;
  return (
    <p className={cx("mt-2 inline-flex items-center gap-1.5 text-xs text-muted", className)}>
      <Icon name="database" size={12} />
      {fmt(dict(lang).sourceLine, { registry: SHORT_REGISTRY[source.registry], id: source.id })}
    </p>
  );
}

/** Verbatim registry text in the UI language when the registry has it, else the other language with a note.
 *  The text keeps the registry's line breaks and is marked with its language for screen readers. */
export function VerbatimText({
  text,
  lang,
  className,
  textClassName,
  showSource = true,
}: {
  text: RegistryText;
  lang: Lang;
  className?: string;
  textClassName?: string;
  showSource?: boolean;
}) {
  const t = dict(lang);
  const shown: Lang | null = text[lang] ? lang : text[lang === "es" ? "en" : "es"] ? (lang === "es" ? "en" : "es") : null;
  if (!shown) return <p className={cx("text-sm text-muted italic", className)}>{t.noText}</p>;
  return (
    <div className={className}>
      {shown !== lang && <OnlyInNote of={shown} lang={lang} />}
      <p lang={shown} data-registry className={cx("whitespace-pre-line text-ink", textClassName)}>
        {text[shown]}
      </p>
      {showSource && <SourceLine source={text.source[shown]} lang={lang} />}
    </div>
  );
}

export function OnlyInNote({ of, lang, className }: { of: Lang; lang: Lang; className?: string }) {
  return (
    <p className={cx("mb-1.5 inline-flex items-center gap-1.5 rounded-md bg-subtle px-2 py-0.5 text-xs text-ink-2 ring-1 ring-line ring-inset", className)}>
      <Icon name="info" size={12} />
      {fmt(dict(lang).onlyIn, { lang: langName(of, lang) })}
    </p>
  );
}

export function LangTag({ of, lang }: { of: Lang; lang: Lang }) {
  const t = dict(lang);
  return (
    <span className="ml-1.5 inline-flex translate-y-[-1px] items-center rounded bg-subtle px-1.5 py-px align-middle text-[11px] font-medium text-ink-2 ring-1 ring-line ring-inset" lang={lang}>
      {of === "es" ? t.inLangEs : t.inLangEn}
    </span>
  );
}

export function SectionHeading({ id, children, icon }: { id: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
      {icon}
      {children}
    </h2>
  );
}

export type { Registry };
