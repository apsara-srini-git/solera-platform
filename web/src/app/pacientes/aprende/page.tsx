import type { Metadata } from "next";
import { SectionView, Toc } from "@/components/patients/Education";
import { PrintButton } from "@/components/patients/PrintButton";
import { EDUCATION_SECTIONS, EDUCATION_SOURCES_CHECKED_AT } from "@/lib/patients/education";
import { dict, fmt, formatDate } from "@/lib/patients/i18n";
import { getLang } from "@/lib/patients/lang";

export async function generateMetadata(): Promise<Metadata> {
  const d = dict(await getLang());
  return { title: d.learnMetaTitle, description: d.learnMetaDescription };
}

export default async function LearnPage() {
  const lang = await getLang();
  const d = dict(lang);
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-14 sm:px-6">
      <header className="max-w-3xl">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[34px]">{d.learnTitle}</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{d.learnIntro}</p>
        <p className="mt-2 text-[13px] text-muted">{fmt(d.sourcesChecked, { date: formatDate(EDUCATION_SOURCES_CHECKED_AT, lang) })}</p>
      </header>
      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[calc(var(--portal-header-h)+24px)] lg:self-start">
          <Toc label={d.toc} items={EDUCATION_SECTIONS.map((s) => ({ id: s.id, title: s.title[lang] }))} />
        </aside>
        <div className="min-w-0 max-w-3xl space-y-6">
          {EDUCATION_SECTIONS.map((s) => (
            <SectionView key={s.id} section={s} lang={lang} actions={s.printable ? <PrintButton label={d.printSection} /> : undefined} />
          ))}
        </div>
      </div>
    </div>
  );
}
