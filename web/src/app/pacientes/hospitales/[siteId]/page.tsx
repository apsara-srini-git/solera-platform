import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui";
import { HospitalPhoto } from "@/components/patients/HospitalPhoto";
import PatientMap from "@/components/patients/PatientMap";
import { Pagination } from "@/components/patients/SearchControls";
import { TrialCard } from "@/components/patients/TrialCard";
import { mapLabels } from "@/components/patients/map-labels";
import { getPatientHospital, patientSources } from "@/lib/patients/data";
import { dict, fmt, formatDate, locale, plural } from "@/lib/patients/i18n";
import { REGISTRY_LABELS, SORT_NOTE } from "@/lib/patients/labels";
import type { Registry } from "@/lib/patients/types";
import { getLang } from "@/lib/patients/lang";
import { parsePatientQuery, searchPatientTrials } from "@/lib/patients/search";
import { hospitalHref, searchHref, trialHref } from "@/lib/patients/urls";

export async function generateMetadata(props: PageProps<"/pacientes/hospitales/[siteId]">): Promise<Metadata> {
  const { siteId } = await props.params;
  const d = dict(await getLang());
  const h = getPatientHospital(decodeURIComponent(siteId));
  if (!h) return { title: d.hospitalNotFoundTitle };
  return { title: fmt(d.hospitalMetaTitle, { name: h.name }), description: fmt(d.hospitalMetaDescription, { name: h.name }) };
}

export default async function HospitalPage(props: PageProps<"/pacientes/hospitales/[siteId]">) {
  const { siteId: raw } = await props.params;
  const siteId = decodeURIComponent(raw);
  const lang = await getLang();
  const d = dict(lang);
  const h = getPatientHospital(siteId);
  if (!h) notFound();

  const src = patientSources();
  const fetchedLine = fmt(d.dataFetchedLine, {
    sources: (Object.keys(src.sources) as Registry[])
      .filter((r) => src.sources[r].fetchedAt)
      .map((r) => fmt(d.dataFetchedSource, { registry: REGISTRY_LABELS[r][lang], date: formatDate(src.sources[r].fetchedAt, lang) }))
      .join(" · "),
  });
  const sp = await props.searchParams;
  const parsed = parsePatientQuery(sp, lang);
  const res = searchPatientTrials({ hospital: siteId, includeStale: parsed.includeStale, page: parsed.page, sort: "updated", lang });
  const pages = Math.max(1, Math.ceil(res.total / res.query.pageSize));
  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    if (res.query.includeStale) qs.set("stale", "1");
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return `${hospitalHref(siteId)}${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 pb-14 sm:px-6">
      <nav aria-label={d.breadcrumb} className="portal-noprint text-[13px]">
        <Link href="/pacientes" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
          <Icon name="arrowLeft" size={14} /> {d.navSearch}
        </Link>
      </nav>

      <header className="card mt-4 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <HospitalPhoto
          image={h.image}
          size="full"
          labels={{ credit: d.photoCredit, alt: fmt(d.photoAlt, { name: h.name }), noPhoto: d.noPhoto }}
          className="h-56 w-full sm:h-72 lg:h-full lg:min-h-80"
        />
        <div className="flex flex-col gap-4 p-5 sm:p-7">
          <div>
            <p className="text-[13px] font-medium text-muted">{h.ownership === "public" ? d.hospitalPublic : d.hospitalPrivate}</p>
            <h1 className="mt-1 text-[24px] leading-tight font-semibold tracking-tight text-ink sm:text-[28px]">{h.name}</h1>
          </div>
          <div className="text-[14.5px] text-ink-2">
            <p className="text-[12.5px] font-medium text-muted">{d.address}</p>
            <p className="mt-0.5 flex items-start gap-1.5">
              <Icon name="pin" size={16} className="mt-0.5 shrink-0 text-muted" />
              <span>
                {h.address}
                {h.municipality && `, ${h.municipality}`}
              </span>
            </p>
          </div>
          <p className="text-[15px] font-semibold text-ink">{plural(res.total, d.trialsHereOne, d.trialsHereOther, lang)}</p>
          <p className="text-[13px] leading-relaxed text-ink-2">{d.hospitalNote}</p>
          {h.geo && (
            <PatientMap
              markers={[{ id: h.id, name: h.name, municipality: h.municipality, lat: h.geo.lat, lon: h.geo.lon, image: null, hospitalHref: hospitalHref(h.id) }]}
              labels={mapLabels(lang)}
              mode="single"
              className="portal-noprint h-48 overflow-hidden rounded-xl border border-line"
              locale={locale(lang)}
            />
          )}
          <p className="text-[12px] text-muted">{d.hospitalDataSource}</p>
        </div>
      </header>

      <section aria-labelledby="hospital-trials" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="hospital-trials" className="text-[19px] font-semibold tracking-tight text-ink">
              {d.hospitalTrialsTitle}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted">{SORT_NOTE[lang]}</p>
            <p className="mt-0.5 text-[12.5px] text-muted">{fetchedLine}</p>
          </div>
          <Link href={searchHref({ hospital: h.id })} className="btn-secondary">
            <Icon name="filter" size={15} /> {d.searchInHospital}
          </Link>
        </div>
        {res.hiddenStale > 0 && !res.query.includeStale && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 rounded-lg bg-surface px-3.5 py-2.5 text-[13px] text-ink-2 ring-1 ring-line ring-inset">
            <Icon name="info" size={15} className="text-muted" />
            {plural(res.hiddenStale, d.hiddenStaleOne, d.hiddenStaleOther, lang)}
            <Link href={`${hospitalHref(siteId)}?stale=1`} className="font-medium text-brand-700 underline underline-offset-2">
              {d.showThem}
            </Link>
          </p>
        )}
        {res.items.length === 0 ? (
          <p className="mt-4 text-[14px] text-muted">{d.hospitalNoTrials}</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {res.items.map((t) => (
              <li key={t.id} className="min-w-0">
                <TrialCard trial={t} lang={lang} href={trialHref(t.id)} siteId={h.id} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8">
          <Pagination page={res.query.page} pages={pages} lang={lang} hrefFor={pageHref} />
        </div>
      </section>
    </div>
  );
}
