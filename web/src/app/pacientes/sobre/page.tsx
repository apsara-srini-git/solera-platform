import type { Metadata } from "next";
import { SectionView } from "@/components/patients/Education";
import { ExternalLink } from "@/components/patients/parts";
import { patientSources } from "@/lib/patients/data";
import { ABOUT_SECTIONS, DATA_SOURCES, REPORT_EMAIL, REPORT_EMAIL_BLOCK } from "@/lib/patients/education";
import { dict, fmt, formatDate } from "@/lib/patients/i18n";
import { getLang } from "@/lib/patients/lang";
import type { Registry } from "@/lib/patients/types";

export async function generateMetadata(): Promise<Metadata> {
  const d = dict(await getLang());
  return { title: d.aboutMetaTitle, description: d.aboutMetaDescription };
}

export default async function AboutPage() {
  const lang = await getLang();
  const d = dict(lang);
  const src = patientSources();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-14 sm:px-6">
      <header>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[34px]">{d.aboutTitle}</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{d.aboutIntro}</p>
      </header>
      <div className="mt-8 space-y-6">
        {ABOUT_SECTIONS.map((s) => {
          if (s.id === "de-donde-salen-los-datos") {
            // render the data sources with their links instead of the plain definition list
            return (
              <SectionView key={s.id} section={s} lang={lang} hideBlocks={new Set([0])}>
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                  {DATA_SOURCES.map((ds) => (
                    <li key={ds.id} id={`fuente-${ds.id}`} className="px-4 py-3.5">
                      <p className="text-[15px] font-semibold text-ink">{ds.name}</p>
                      <p className="text-[13px] text-muted">{ds.publisher[lang]}</p>
                      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{ds.use[lang]}</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{ds.terms[lang]}</p>
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
                        <ExternalLink href={ds.url} lang={lang}>{d.website}</ExternalLink>
                        <ExternalLink href={ds.termsUrl} lang={lang}>{d.terms}</ExternalLink>
                      </p>
                    </li>
                  ))}
                  <li className="px-4 py-3.5 text-[14px] text-ink-2">{d.photosNote}</li>
                </ul>
                <div className="rounded-xl bg-subtle/70 px-4 py-3 ring-1 ring-line ring-inset">
                  <h3 className="text-[14px] font-semibold text-ink">{d.registriesFetched}</h3>
                  <ul className="mt-1.5 space-y-1 text-[14px] text-ink-2">
                    {(Object.keys(src.sources) as Registry[]).map((r) => (
                      <li key={r}>
                        {src.sources[r].name}: {fmt(d.fetchedOn, { date: formatDate(src.sources[r].fetchedAt, lang) })}
                      </li>
                    ))}
                  </ul>
                </div>
              </SectionView>
            );
          }
          if (s.id === REPORT_EMAIL_BLOCK.sectionId) {
            const hide = REPORT_EMAIL ? undefined : new Set([REPORT_EMAIL_BLOCK.blockIndex]);
            const section = REPORT_EMAIL
              ? {
                  ...s,
                  blocks: s.blocks.map((b, i) =>
                    i === REPORT_EMAIL_BLOCK.blockIndex && b.type === "p"
                      ? { ...b, text: { es: b.text.es.replace(REPORT_EMAIL_BLOCK.placeholder, REPORT_EMAIL!), en: b.text.en.replace(REPORT_EMAIL_BLOCK.placeholder, REPORT_EMAIL!) } }
                      : b,
                  ),
                }
              : s;
            return <SectionView key={s.id} section={section} lang={lang} hideBlocks={hide} />;
          }
          return <SectionView key={s.id} section={s} lang={lang} />;
        })}
      </div>
    </div>
  );
}
