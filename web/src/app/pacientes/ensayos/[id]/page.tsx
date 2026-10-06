import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import { AreaBand } from "@/components/patients/AreaVisual";
import { HospitalPhoto, PhotoCredit } from "@/components/patients/HospitalPhoto";
import PatientMap from "@/components/patients/PatientMap";
import type { PatientMapMarker } from "@/components/patients/PatientMapInner";
import { PrintButton, PrintExpand } from "@/components/patients/PrintButton";
import { ageShort } from "@/components/patients/TrialCard";
import { mapLabels } from "@/components/patients/map-labels";
import {
  ExternalLink,
  LangTag,
  MadridStatusPill,
  OnlyInNote,
  SHORT_REGISTRY,
  SiteStatusPill,
  SourceLine,
  StaleNotice,
  VerbatimText,
} from "@/components/patients/parts";
import { getPatientTrial } from "@/lib/patients/data";
import { NEXT_STEP, TRIAL_PAGE_DISCLAIMER, phaseOneLiner } from "@/lib/patients/education";
import { dict, fmt, formatDate, langName, locale } from "@/lib/patients/i18n";
import { OVERALL_STATUS_LABELS, REGISTRY_LABELS, SEX_LABELS, areaLabel, phasesLabel, pickText } from "@/lib/patients/labels";
import { getLang } from "@/lib/patients/lang";
import type { Lang, PatientTrialView, Registry, RegistryAge, RegistryText } from "@/lib/patients/types";
import { hospitalHref } from "@/lib/patients/urls";

function findTrial(raw: string): PatientTrialView | undefined {
  return getPatientTrial(decodeURIComponent(raw));
}

export async function generateMetadata(props: PageProps<"/pacientes/ensayos/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const lang = await getLang();
  const d = dict(lang);
  const t = findTrial(id);
  if (!t) return { title: d.notFoundTitle };
  return { title: fmt(d.trialMetaTitle, { id: t.id }), description: fmt(d.trialMetaDescription, { id: t.id }) };
}

const AGE_ORDER: RegistryAge[] = ["CHILD", "ADULT", "OLDER_ADULT"];

function sponsorType(cls: string | null, lang: Lang): string {
  const d = dict(lang);
  switch (cls) {
    case "INDUSTRY":
      return d.sponsorIndustry;
    case "NETWORK":
      return d.sponsorNetwork;
    case "OTHER_GOV":
    case "FED":
    case "NIH":
      return d.sponsorPublic;
    case "OTHER":
    case "INDIV":
      return d.sponsorAcademic;
    default:
      return d.sponsorUnknown;
  }
}

function ageText(t: PatientTrialView, lang: Lang): string {
  const d = dict(lang);
  const { minAgeYears: min, maxAgeYears: max } = t.eligibility;
  if (min != null && max != null) return fmt(d.ageRange, { min, max });
  if (min != null) return fmt(d.ageFrom, { min });
  if (max != null) return fmt(d.ageTo, { max });
  return d.ageNoLimit;
}

function Section({ id, title, children, icon }: { id: string; title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="card p-5 sm:p-6">
      <h2 id={id} className="flex items-center gap-2 text-[18px] font-semibold tracking-tight text-ink">
        {icon}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Criteria({ summary, text, lang, open }: { summary: string; text: RegistryText; lang: Lang; open?: boolean }) {
  const has = text.es || text.en;
  if (!has) return null;
  return (
    <details className="group rounded-xl border border-line bg-surface" open={open}>
      <summary className="portal-summary flex cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 text-[15px] font-medium text-ink hover:bg-subtle">
        {summary}
        <Icon name="chevronDown" size={17} className="portal-chevron shrink-0 text-muted transition" />
      </summary>
      <div className="border-t border-line px-4 pt-3 pb-4 text-[14px]">
        <VerbatimText text={text} lang={lang} textClassName="registry-text" />
      </div>
    </details>
  );
}

export default async function TrialPage(props: PageProps<"/pacientes/ensayos/[id]">) {
  const { id } = await props.params;
  const lang = await getLang();
  const d = dict(lang);
  const t = findTrial(id);
  if (!t) notFound();

  const title = pickText(t.title, lang);
  const other: Lang = title?.lang === "es" ? "en" : "es";
  const otherTitle = title ? t.title[other] : undefined;
  const phase = phasesLabel(t.phases, lang);
  const phaseLine = phaseOneLiner(t.phases, lang);
  const ages = AGE_ORDER.filter((a) => t.ages.includes(a));
  const registries = (Object.keys(t.fetchedAt) as Registry[]).filter((r) => t.fetchedAt[r]);
  const contactLinks = t.registryLinks.filter((l) => l.registry === "reec" || l.registry === "ctgov");
  const primaryId = t.nctId ?? t.primaryReecId ?? t.id;
  const el = t.eligibility;
  const sponsorName = t.sponsor === "Investigator-initiated" ? d.sponsorInvestigator : t.sponsor;

  const markers: PatientMapMarker[] = t.sites
    .filter((s) => s.hospital.geo)
    .map((s) => ({
      id: s.siteId,
      name: s.hospital.name,
      municipality: s.hospital.municipality,
      lat: s.hospital.geo!.lat,
      lon: s.hospital.geo!.lon,
      image: s.hospital.image,
      hospitalHref: hospitalHref(s.siteId),
      statusLabel: undefined,
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 pb-14 sm:px-6">
      <PrintExpand />
      <nav aria-label={d.breadcrumb} className="portal-noprint text-[13px]">
        <Link href="/pacientes" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
          <Icon name="arrowLeft" size={14} /> {d.navSearch}
        </Link>
      </nav>

      {/* header */}
      <header className="card mt-4 overflow-hidden">
        <AreaBand
          size="lg"
          area={t.areas[0]}
          label={t.areas.length ? t.areas.map((a) => areaLabel(a, lang)).join(" · ") : d.otherArea}
          caption={t.areas.length ? d.areaClassification : undefined}
          right={<MadridStatusPill sites={t.sites} lang={lang} />}
        />
        <div className="px-5 pt-4 pb-5 sm:px-7">
          <h1 className="text-[22px] leading-snug font-semibold tracking-tight text-ink sm:text-[27px]">
            <span lang={title?.lang} data-registry>{title?.text ?? t.id}</span>
            {title && title.lang !== lang && <LangTag of={title.lang} lang={lang} />}
          </h1>
          {title && <SourceLine source={t.title.source[title.lang]} lang={lang} />}
          <p className="mt-2 text-[13px] text-muted">{fmt(d.statusAccordingTo, { registry: SHORT_REGISTRY[t.statusSource], status: OVERALL_STATUS_LABELS[t.status][lang] })}</p>

          <div className="mt-4">
            <h2 className="text-[13px] font-semibold text-ink-2">{d.registryIds}</h2>
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[14px]">
              {t.registryLinks.map((l) => (
                <li key={`${l.registry}-${l.id}`}>
                  <ExternalLink href={l.url} lang={lang} className="print-url num">
                    {l.id}
                  </ExternalLink>
                  <span className="text-[12.5px] text-muted"> · {SHORT_REGISTRY[l.registry]}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="mt-3 space-y-0.5 text-[12.5px] text-ink-2">
            {registries.map((r) => (
              <li key={r}>{fmt(d.dataFrom, { registry: REGISTRY_LABELS[r][lang], date: formatDate(t.fetchedAt[r], lang) })}</li>
            ))}
          </ul>
          {t.stale && <StaleNotice lang={lang} className="mt-4" />}
          <div className="mt-4 flex flex-wrap gap-2">
            <PrintButton label={d.printPage} />
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* next steps: right column on desktop, right after the header on phones */}
        <aside className="portal-print-full lg:col-start-2 lg:row-start-1" aria-labelledby="next-title">
          <div className="space-y-4 lg:sticky lg:top-[calc(var(--portal-header-h)+16px)]">
            <section className="rounded-2xl border border-brand-200 bg-brand-50/70 p-5">
              <h2 id="next-title" className="text-[17px] font-semibold text-brand-900">
                {d.whatYouCanDo}
              </h2>
              <ol className="mt-3 space-y-3 text-[14px] leading-snug text-ink">
                {NEXT_STEP.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-[12px] font-semibold text-brand-800 ring-1 ring-brand-200">
                      {i + 1}
                    </span>
                    <span>{s[lang]}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 rounded-xl bg-surface p-3.5 ring-1 ring-brand-200">
                <p className="text-[12.5px] font-medium text-ink-2">{d.takeId}</p>
                <p className="num mt-1 text-[19px] font-semibold tracking-wide text-ink select-all">{primaryId}</p>
                <p className="mt-1 text-[12px] text-muted">{d.copyHint}</p>
              </div>
              <ul className="mt-4 space-y-2 text-[14px]">
                {contactLinks.map((l) => (
                  <li key={l.url}>
                    <ExternalLink href={l.url} lang={lang} className="print-url">
                      {fmt(d.contactOnRegistry, { registry: SHORT_REGISTRY[l.registry] })}
                    </ExternalLink>
                  </li>
                ))}
                <li>
                  <Link href="/pacientes/aprende#hablar-con-tu-medico" className="inline-flex items-center gap-1 font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800">
                    {d.printQuestions}
                  </Link>
                </li>
              </ul>
            </section>
            <section aria-labelledby="disclaimer-title" className="rounded-2xl border border-line bg-surface p-4 text-[13px] leading-relaxed text-ink-2">
              <h2 id="disclaimer-title" className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <Icon name="info" size={15} /> {d.disclaimerTitle}
              </h2>
              <p className="mt-1.5">{TRIAL_PAGE_DISCLAIMER[lang]}</p>
              <Link href="/pacientes/sobre" className="portal-noprint mt-2 inline-block font-medium text-brand-700 underline-offset-2 hover:underline">
                {d.aboutLink}
              </Link>
            </section>
          </div>
        </aside>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          <Section id="about" title={d.sectionAbout}>
            <p className="mb-4 flex items-start gap-1.5 text-[12.5px] text-muted">
              <Icon name="doc" size={14} className="mt-px shrink-0" /> {d.sectionAboutNote}
            </p>
            <div className="space-y-5 text-[15px] leading-relaxed">
              <div>
                <h3 className="text-[13px] font-semibold tracking-wide text-ink-2 uppercase">{d.publicIndication}</h3>
                <VerbatimText text={t.publicIndication} lang={lang} className="mt-1.5" textClassName="registry-text" />
              </div>
              {t.summary.en && (
                <div>
                  <h3 className="text-[13px] font-semibold tracking-wide text-ink-2 uppercase">{d.summary}</h3>
                  <div className="mt-1.5">
                    {lang !== "en" && <OnlyInNote of="en" lang={lang} />}
                    <p lang="en" data-registry className="registry-text text-ink">
                      {t.summary.en}
                    </p>
                    <SourceLine source={t.summary.source} lang={lang} />
                  </div>
                </div>
              )}
              {otherTitle && (
                <div>
                  <h3 className="text-[13px] font-semibold tracking-wide text-ink-2 uppercase">{fmt(d.otherTitle, { lang: langName(other, lang) })}</h3>
                  <p lang={other} data-registry className="mt-1.5 text-ink">
                    {otherTitle}
                  </p>
                  <SourceLine source={t.title.source[other]} lang={lang} />
                </div>
              )}
              {t.conditions.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold tracking-wide text-ink-2 uppercase">{d.conditions}</h3>
                  <ul className="mt-2 flex flex-wrap gap-1.5" data-registry>
                    {t.conditions.map((c) => (
                      <li key={c} className="rounded-full bg-subtle px-2.5 py-0.5 text-[13px] text-ink-2 ring-1 ring-line ring-inset">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {t.rareDisease && <p className="text-[13.5px] text-ink-2">{d.rareDisease}</p>}
            </div>
          </Section>

          <Section id="who" title={d.sectionWho}>
            <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3.5 py-2.5 text-[14px] leading-snug text-sky-900 ring-1 ring-sky-200 ring-inset">
              <Icon name="info" size={16} className="mt-0.5 shrink-0" />
              {d.whoNote}
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Fact label={d.age} value={ageText(t, lang)} />
              <Fact label={d.sex} value={el.sex ? SEX_LABELS[el.sex][lang] : d.notStated} />
              <Fact label={d.healthy} value={el.healthyVolunteers === true ? d.healthyYes : el.healthyVolunteers === false ? d.healthyNo : d.notStated} />
              <Fact label={d.ageGroups} value={ages.length ? ages.map((a) => ageShort(a, lang)).join(" · ") : d.notStated} />
            </dl>
            <div className="mt-5 space-y-3">
              {el.criteriaSplit ? (
                <>
                  <Criteria summary={d.inclusion} text={el.inclusion} lang={lang} />
                  <Criteria summary={d.exclusion} text={el.exclusion} lang={lang} />
                </>
              ) : (
                <>
                  <p className="text-[13px] text-muted">{d.criteriaUnsplit}</p>
                  <Criteria summary={d.criteriaAll} text={el.inclusion} lang={lang} />
                </>
              )}
              {!el.inclusion.es && !el.inclusion.en && !el.exclusion.es && !el.exclusion.en && <p className="text-[14px] text-muted">{d.noCriteria}</p>}
            </div>
          </Section>

          <Section id="hospitals" title={d.sectionHospitals}>
            <p className="text-[14px] text-ink-2">{d.hospitalsIntro}</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {t.sites.map((s) => (
                <li key={s.siteId} className="flex overflow-hidden rounded-xl border border-line bg-surface">
                  <HospitalPhoto
                    image={s.hospital.image}
                    labels={{ credit: d.photoCredit, alt: fmt(d.photoAlt, { name: s.hospital.name }), noPhoto: d.noPhoto }}
                    credit="none"
                    className="portal-noprint w-24 shrink-0 self-stretch sm:w-28"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                    <Link href={hospitalHref(s.siteId)} className="text-[14.5px] leading-snug font-semibold text-ink hover:text-brand-700 hover:underline">
                      {s.hospital.name}
                    </Link>
                    <span className="text-[12.5px] text-muted">{s.hospital.municipality}</span>
                    <SiteStatusPill status={s.status} lang={lang} className="self-start" />
                    {s.hospital.image && <PhotoCredit image={s.hospital.image} label={d.photoCredit} className="portal-noprint text-muted" />}
                  </div>
                </li>
              ))}
            </ul>
            {markers.length > 0 && (
              <PatientMap
                markers={markers}
                labels={mapLabels(lang)}
                mode={markers.length === 1 ? "single" : "sites"}
                className="portal-noprint mt-4 h-64 overflow-hidden rounded-xl border border-line sm:h-72"
                locale={locale(lang)}
              />
            )}
          </Section>

          <div className="grid gap-6 md:grid-cols-2">
            <Section id="phase" title={d.sectionPhase}>
              {phase ? (
                <>
                  <p className="text-[16px] font-semibold text-ink">{phase}</p>
                  {phaseLine && <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{phaseLine}</p>}
                </>
              ) : (
                <p className="text-[14px] text-muted">{d.phaseNotStated}</p>
              )}
              <Link href="/pacientes/aprende#fases" className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-brand-700 underline decoration-brand-300 underline-offset-2">
                {d.learnPhases} <Icon name="arrowRight" size={14} />
              </Link>
            </Section>
            <Section id="sponsor" title={d.sectionSponsor}>
              <p className="text-[16px] font-semibold text-ink" data-registry>{sponsorName ?? d.sponsorUnknown}</p>
              <p className="mt-1 text-[13.5px] text-ink-2">
                <span className="text-muted">{d.sponsorType}: </span>
                {sponsorType(t.sponsor === "Investigator-initiated" ? "INDIV" : t.sponsorClass, lang)}
              </p>
              <p className="mt-3 text-[13px] text-muted">{d.sponsorNote}</p>
            </Section>
          </div>

          <Section id="dates" title={d.sectionDates}>
            <ul className="space-y-1.5 text-[14px] text-ink-2">
              {t.lastUpdatedBySource.ctgov && <li>{fmt(d.lastUpdatedCtgov, { date: formatDate(t.lastUpdatedBySource.ctgov, lang) })}</li>}
              {t.lastUpdatedBySource.reec && (
                <li>
                  {fmt(t.reecUpdatedKind === "calendar" ? d.lastUpdatedReecCalendar : d.lastUpdatedReec, {
                    date: formatDate(t.lastUpdatedBySource.reec, lang),
                  })}
                </li>
              )}
              {registries.map((r) => (
                <li key={r}>{fmt(d.dataFrom, { registry: REGISTRY_LABELS[r][lang], date: formatDate(t.fetchedAt[r], lang) })}</li>
              ))}
            </ul>
            {t.stale && <StaleNotice lang={lang} className="mt-3" />}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-subtle/70 px-3.5 py-2.5 ring-1 ring-line ring-inset">
      <dt className="text-[12.5px] font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-[14.5px] text-ink">{value}</dd>
    </div>
  );
}
