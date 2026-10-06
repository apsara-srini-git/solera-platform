import Link from "next/link";
import { Icon, cx } from "@/components/ui";
import { phaseOneLiner } from "@/lib/patients/education";
import { dict, fmt, formatDate, plural } from "@/lib/patients/i18n";
import { areaLabel, phasesLabel, pickText } from "@/lib/patients/labels";
import type { Lang, LinkRegistry, PatientTrialView, RegistryAge } from "@/lib/patients/types";
import { AreaBand } from "./AreaVisual";
import { LangTag, MadridStatusPill, SHORT_REGISTRY, SiteStatusPill, StaleNotice } from "./parts";

const AGE_ORDER: RegistryAge[] = ["CHILD", "ADULT", "OLDER_ADULT"];

export function ageShort(a: RegistryAge, lang: Lang): string {
  const t = dict(lang);
  return a === "CHILD" ? t.ageChild : a === "ADULT" ? t.ageAdult : t.ageOlder;
}

export function registriesOf(t: PatientTrialView): LinkRegistry[] {
  const order: LinkRegistry[] = ["reec", "ctgov", "ctis", "euctr"];
  const have = new Set(t.registryLinks.map((l) => l.registry));
  return order.filter((r) => have.has(r));
}

/**
 * Trial result card (server component). Everything trial-specific is registry text; the rest is generic chrome.
 * `siteId` = show the status at that hospital (hospital pages / hospital filter) instead of the trial status.
 */
export function TrialCard({ trial: t, lang, href, siteId }: { trial: PatientTrialView; lang: Lang; href: string; siteId?: string }) {
  const d = dict(lang);
  const title = pickText(t.title, lang);
  const indication = pickText(t.publicIndication, lang);
  const area = t.areas[0];
  const phase = phasesLabel(t.phases, lang);
  const phaseLine = phaseOneLiner(t.phases, lang);
  const ages = AGE_ORDER.filter((a) => t.ages.includes(a));
  const here = siteId ? t.sites.find((s) => s.siteId === siteId) : undefined;
  // the filtered hospital first, then registry order
  const sites = here ? [here, ...t.sites.filter((s) => s !== here)] : t.sites;
  const names = sites.slice(0, 2).map((s) => s.hospital.name);
  const more = t.sites.length - names.length;
  const updated = t.lastUpdated
    ? fmt(t.lastUpdatedBasis === "reec_latest_calendar_date" ? d.updatedReec : d.updatedCtgov, { date: formatDate(t.lastUpdated, lang) })
    : null;
  const headingId = `trial-${t.id}-title`;

  return (
    <article
      aria-labelledby={headingId}
      data-site-ids={t.sites.map((s) => s.siteId).join(",")}
      className="group card-interactive relative flex h-full min-w-0 flex-col overflow-hidden focus-within:ring-2 focus-within:ring-brand-500/40"
    >
      <AreaBand
        area={area}
        label={area ? areaLabel(area, lang) : d.otherArea}
        extra={t.areas.length > 1 ? `+${t.areas.length - 1}` : undefined}
        caption={area ? d.areaClassification : undefined}
        right={here ? undefined : <MadridStatusPill sites={t.sites} lang={lang} />}
      />
      <div className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4">
        {here && <SiteStatusPill status={here.status} lang={lang} className="self-start" />}
        <h3 id={headingId} className="text-[15.5px] leading-snug font-semibold text-ink">
          <Link
            href={href}
            className="line-clamp-4 rounded-sm after:absolute after:inset-0 after:content-[''] hover:text-brand-800 focus-visible:outline-none"
          >
            <span lang={title?.lang} data-registry>{title?.text ?? t.id}</span>
          </Link>
          {title && title.lang !== lang && <LangTag of={title.lang} lang={lang} />}
        </h3>

        {indication && (
          <p className="line-clamp-3 text-[13.5px] leading-snug text-ink-2">
            <span className="font-medium text-ink">{d.indicationLabel}: </span>
            <span lang={indication.lang} data-registry>{indication.text}</span>
          </p>
        )}

        <dl className="grid gap-2 text-[13px] leading-snug">
          {phase && (
            <div>
              <dt className="sr-only">{d.phaseLabel}</dt>
              <dd>
                <span className="font-medium text-ink">{phase}</span>
                {phaseLine && <span className="text-muted"> · {phaseLine}</span>}
              </dd>
            </div>
          )}
          {ages.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <dt className="sr-only">{d.agesLabel}</dt>
              {ages.map((a) => (
                <dd key={a} className="rounded-full bg-subtle px-2 py-0.5 text-[12px] text-ink-2 ring-1 ring-line ring-inset">
                  {ageShort(a, lang)}
                </dd>
              ))}
              {t.eligibility.healthyVolunteers === true && (
                <dd className="rounded-full bg-subtle px-2 py-0.5 text-[12px] text-ink-2 ring-1 ring-line ring-inset">{d.healthyAccepted}</dd>
              )}
            </div>
          )}
          <div className="flex items-start gap-1.5 text-ink-2">
            <dt className="sr-only">{d.sectionHospitals}</dt>
            <Icon name="building" size={15} className="mt-px shrink-0 text-muted" />
            <dd>
              <span className="font-medium text-ink">{plural(t.sites.length, d.hospitalsOne, d.hospitalsOther, lang)}</span>
              <span className="text-ink-2">
                {": "}
                {names.join(" · ")}
                {more > 0 && ` ${fmt(d.andMore, { n: more })}`}
              </span>
            </dd>
          </div>
        </dl>

        {t.stale && <StaleNotice lang={lang} compact />}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-line pt-3 text-[12px] text-muted">
          <span className="inline-flex flex-wrap items-center gap-1">
            <span className="sr-only">{d.registeredIn}: </span>
            {registriesOf(t).map((r) => (
              <span key={r} className="rounded bg-surface px-1.5 py-px font-medium text-ink-2 ring-1 ring-line-strong ring-inset">
                {SHORT_REGISTRY[r]}
              </span>
            ))}
            <span className="num ml-1 text-muted">{t.id}</span>
          </span>
          {updated && <span className={cx("num")}>{updated}</span>}
        </div>
      </div>
    </article>
  );
}
