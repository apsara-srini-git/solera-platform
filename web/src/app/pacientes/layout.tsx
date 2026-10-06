import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon, LogoMark } from "@/components/ui";
import { LangToggle, LangToggleForm, type LangToggleLabels } from "@/components/patients/LangToggle";
import { DismissableMenu } from "@/components/patients/DismissableMenu";
import { PortalNav, type PortalNavItem } from "@/components/patients/PortalNav";
import { DICT, dict } from "@/lib/patients/i18n";
import { getLang } from "@/lib/patients/lang";
import { LangProvider } from "@/lib/i18n/context";
import "@/components/patients/portal.css";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const d = dict(lang);
  return {
    title: { template: "%s · Solera", default: d.portalName },
    description: d.searchMetaDescription,
    // indexable on purpose (no robots override)
  };
}

const DATA_LINKS: { name: string; href: string }[] = [
  { name: "REec (AEMPS)", href: "https://reec.aemps.es/reec/public/web.html" },
  { name: "ClinicalTrials.gov", href: "https://clinicaltrials.gov/" },
  { name: "CTIS (EMA)", href: "https://euclinicaltrials.eu/" },
  { name: "Catálogo Nacional de Hospitales", href: "https://www.sanidad.gob.es/ciudadanos/centros.do" },
  { name: "Datos abiertos Comunidad de Madrid", href: "https://datos.comunidad.madrid/" },
  { name: "OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
  { name: "Wikimedia Commons", href: "https://commons.wikimedia.org/" },
];

export default async function PatientPortalLayout({ children }: LayoutProps<"/pacientes">) {
  const lang = await getLang();
  const d = dict(lang);
  const nav: PortalNavItem[] = [
    { href: "/pacientes", label: d.navSearch, also: ["/pacientes/ensayos", "/pacientes/hospitales"] },
    { href: "/pacientes/aprende", label: d.navLearn },
    { href: "/pacientes/sobre", label: d.navAbout },
  ];
  const langLabels: LangToggleLabels = { group: d.langGroup, es: DICT.es.langSwitchTo, en: DICT.en.langSwitchTo };

  return (
    <LangProvider lang={lang}>
    <div className="patient-portal flex min-h-dvh flex-col text-ink" lang={lang}>
      <a href="#main" className="sr-only z-[1200] rounded-lg bg-ink px-3 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        {d.skipToContent}
      </a>
      <header className="portal-noprint sticky top-0 z-[1100] h-(--portal-header-h) border-b border-line bg-surface/95 backdrop-blur-md supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-2 px-4 sm:gap-5 sm:px-6">
          <Link href="/pacientes" className="flex min-w-0 shrink items-center gap-2.5 rounded-lg" aria-label={d.homeAria}>
            <LogoMark size={28} />
            <span className="flex min-w-0 items-baseline gap-1.5 truncate">
              <span className="text-[16.5px] font-semibold tracking-tight text-ink">Solera</span>
              <span className="hidden truncate text-[14px] text-ink-2 min-[400px]:inline">· {d.portalShort}</span>
            </span>
          </Link>
          <PortalNav items={nav} label={d.navLabel} variant="bar" />
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" title={d.forProfessionalsHint} className="hidden h-9 items-center rounded-lg px-2.5 whitespace-nowrap text-[13.5px] text-ink-2 hover:bg-subtle hover:text-ink lg:inline-flex">
              {d.forProfessionals}
            </Link>
            <Suspense fallback={<LangToggleForm lang={lang} labels={langLabels} />}>
              <LangToggle lang={lang} labels={langLabels} />
            </Suspense>
            <DismissableMenu />
            <details data-dismissable className="group relative md:hidden">
              <summary className="no-marker grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-subtle" aria-label={d.menu}>
                <Icon name="menu" size={19} />
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
                <PortalNav items={nav} label={d.navLabel} variant="menu" />
                <Link href="/" className="mt-1 flex items-center rounded-lg border-t border-line px-3 py-2.5 text-sm text-ink-2 hover:bg-subtle hover:text-ink">
                  {d.forProfessionals}
                </Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="max-w-xl space-y-3 text-[13.5px] leading-relaxed text-ink-2">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <LogoMark size={22} /> {d.portalName}
            </p>
            <p>{d.footerDisclaimer}</p>
            <p className="inline-flex items-start gap-1.5 text-muted">
              <Icon name="lock" size={14} className="mt-0.5 shrink-0" /> {d.footerPrivacy}
            </p>
            <p className="portal-noprint flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/pacientes/sobre" className="font-medium text-brand-700 underline-offset-2 hover:underline">
                {d.navAbout}
              </Link>
              <Link href="/pacientes/aprende" className="font-medium text-brand-700 underline-offset-2 hover:underline">
                {d.navLearn}
              </Link>
              <Link href="/" title={d.forProfessionalsHint} className="font-medium text-brand-700 underline-offset-2 hover:underline">
                {d.forProfessionals}
              </Link>
            </p>
          </div>
          <div className="text-[13px] leading-relaxed text-ink-2">
            <h2 className="text-xs font-semibold tracking-wide text-ink-2 uppercase">{d.footerSourcesTitle}</h2>
            <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {DATA_LINKS.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-brand-700">
                    {s.name}
                    <span className="sr-only"> {d.opensNewTab}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">{d.footerEma}</p>
            <p className="mt-2 text-xs text-muted">{d.footerPhotos}</p>
          </div>
        </div>
      </footer>
    </div>
    </LangProvider>
  );
}
