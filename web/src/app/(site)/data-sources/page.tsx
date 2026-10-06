import Link from "next/link";
import { Card, Icon, PageHeader, SOURCE_ORDER, SOURCES, fmtDay, type SourceDates, type SourceId } from "@/components/ui";
import { RefreshControl } from "@/components/search/RefreshControl";
import { currentUser } from "@/lib/auth";
import { contactsSummary } from "@/lib/contacts";
import { dataset } from "@/lib/data";
import { refreshStatus, sourceDates } from "@/lib/refresh";
import { fmtNum } from "@/lib/i18n/pro";
import { PAGES } from "@/lib/i18n/pro/pages";
import { getProLang } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = PAGES[await getProLang()].dataSources;
  return { title: t.metaTitle, description: t.metaDescription };
}

type Fresh = (typeof PAGES)["en"]["dataSources"]["fresh"];

interface Report {
  trials: number;
  hospitals: number;
  hospitalsWithTrials?: number;
  trialsBySource?: Record<string, number>;
  reec?: Record<string, number>;
  enrichment?: {
    coverage?: Record<string, string>;
    geo?: { crossChecked?: number; byMethod?: Record<string, number> };
    images?: { withImage?: number };
  };
}

const ANNUAL = new Set<SourceId>(["catalogue", "isciii", "sermas", "geo", "commons", "osm"]);
/** Hand-checked sources (public contacts): "up to date" for about three months. */
const QUARTERLY = new Set<SourceId>(["contacts"]);

/** Freshness of a source from its fetch date: up to date (≤ 14 days), ageing (≤ 60 days), old, or unknown. */
function freshness(iso: string | null | undefined, id: SourceId, l: Fresh) {
  if (!iso) return { label: l.unknown, dot: "bg-slate-400", text: "text-muted" };
  // yearly publications (catalogue, ISCIII list, SERMAS reports, register) are "up to date" for a year
  const days = (Date.now() - Date.parse(iso)) / 86400_000 / (ANNUAL.has(id) ? 26 : QUARTERLY.has(id) ? 6 : 1);
  if (days <= 14) return { label: l.ok, dot: "bg-emerald-500", text: "text-emerald-800" };
  if (days <= 60) return { label: l.soon, dot: "bg-amber-500", text: "text-amber-800" };
  return { label: l.old, dot: "bg-rose-500", text: "text-rose-800" };
}

export default async function DataSourcesPage() {
  const lang = await getProLang();
  const t = PAGES[lang].dataSources;
  const n = (v: number | undefined) => fmtNum(v ?? 0, lang);
  const { report: raw, sites } = dataset();
  const r = raw as unknown as Report;
  const contacts = contactsSummary();
  const dates: SourceDates = { ...sourceDates(), contacts: { fetchedAt: contacts.checkedOn || null } };
  const user = await currentUser();
  const by = r.trialsBySource ?? {};
  const cov = r.enrichment?.coverage ?? {};
  const inReec = (by["reec"] ?? 0) + (by["ctgov+reec"] ?? 0);
  const inCtgov = (by["ctgov"] ?? 0) + (by["ctgov+reec"] ?? 0);
  const accredited = sites.filter((s) => s.researchUnit?.accreditedIIS).length;
  const withInstitute = sites.filter((s) => s.researchUnit).length;
  const lead = (s: string | undefined) => (s ?? "").split(" ")[0];

  const coverage = t.coverageLines({
    inReec,
    reecOnly: by["reec"] ?? 0,
    reecMatched: r.reec?.matched ?? 0,
    reecRows: r.reec?.madrid_site_rows ?? 0,
    inCtgov,
    both: by["ctgov+reec"] ?? 0,
    ctisLinked: r.reec?.merged_via_ctis_link ?? 0,
    hospitals: r.hospitals ?? 0,
    withTrials: r.hospitalsWithTrials ?? 0,
    accredited,
    withInstitute,
    activity: lead(cov.activity),
    ceim: cov.ceim,
    geo: lead(cov.geo),
    geoAddress: r.enrichment?.geo?.byMethod?.address ?? 0,
    images: lead(cov.image),
    crossChecked: r.enrichment?.geo?.crossChecked ?? 0,
    contactHospitals: contacts.withContacts,
    contactMailboxes: contacts.mailboxes,
    contactChecked: contacts.hospitals,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumb={[{ label: t.crumbHome, href: "/" }, { label: t.title }]}
        title={t.title}
        subtitle={t.subtitle}
        actions={<RefreshControl initial={refreshStatus()} loggedIn={!!user} align="end" className="sm:text-right" />}
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-2 shadow-xs">
        <span>
          <span className="num font-semibold text-ink">{n(r.trials)}</span> {t.trials}
        </span>
        <span>
          <span className="num font-semibold text-ink">{n(r.hospitals)}</span> {t.hospitals}
        </span>
        <span className="flex items-center gap-3 text-xs text-muted">
          <Dot cls="bg-emerald-500" /> {t.fresh.ok}
          <Dot cls="bg-amber-500" /> {t.fresh.soon}
          <Dot cls="bg-rose-500" /> {t.fresh.old}
        </span>
        <Link href="/how-scoring-works" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
          {t.howScoring} <Icon name="arrowRight" size={12} />
        </Link>
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {SOURCE_ORDER.map((id) => {
          const m = { ...SOURCES[id], ...t.cards[id] };
          const d = dates[id];
          const f = freshness(d?.fetchedAt, id, t.fresh);
          const official = d?.url ?? m.url;
          const datasetUrl = d?.datasetUrl && d.datasetUrl !== official ? d.datasetUrl : m.datasetUrl;
          return (
            <li key={id} id={id} className="scroll-mt-24">
              <Card className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-[15px] leading-snug font-semibold text-ink">
                      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.dot }} />
                      {m.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">{m.publisher}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${f.text}`}>
                    <Dot cls={f.dot} />
                    {f.label}
                  </span>
                </div>
                <dl className="mt-3 space-y-2.5 text-[13px] leading-snug">
                  <div>
                    <dt className="text-xs font-medium text-muted">{t.contains}</dt>
                    <dd className="mt-0.5 text-ink-2">{m.contains}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted">{t.usedFor}</dt>
                    <dd className="mt-0.5 text-ink-2">{m.usedFor}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted">{t.coverage}</dt>
                    <dd className="mt-0.5">
                      <ul className="space-y-0.5 text-ink-2">
                        {coverage[id].map((line) => (
                          <li key={line} className="num flex items-start gap-1.5">
                            <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-line-strong" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted">{t.licence}</dt>
                    <dd className="mt-0.5 text-ink-2">{m.licence}</dd>
                  </div>
                </dl>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-xs">
                  {official ? (
                    <a href={official} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                      {m.urlLabel} <Icon name="external" size={11} />
                      <span className="sr-only">{t.opensNewTab}</span>
                    </a>
                  ) : (
                    <span className="text-muted">{m.urlLabel}</span>
                  )}
                  {datasetUrl && datasetUrl !== official && (
                    <a href={datasetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                      {m.datasetLabel ?? t.dataset} <Icon name="external" size={11} />
                      <span className="sr-only">{t.opensNewTab}</span>
                    </a>
                  )}
                  <span className="ml-auto text-muted">
                    {t.lastUpdated} <span className="num text-ink-2">{d?.fetchedAt ? fmtDay(d.fetchedAt, { lang }) : t.unknown}</span>
                  </span>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-muted">{t.footnote}</p>
    </div>
  );
}

function Dot({ cls }: { cls: string }) {
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}
