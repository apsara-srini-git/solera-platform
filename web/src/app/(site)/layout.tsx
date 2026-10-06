import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { currentUser } from "@/lib/auth";
import { Badge, Icon, Logo, NavLink, RouteSwitch } from "@/components/ui";
import { LangToggle, LangToggleForm, type LangToggleLabels } from "@/components/patients/LangToggle";
import { COMMON, LANG_TOGGLE_LABELS, type CommonDict } from "@/lib/i18n/pro";
import { LangProvider } from "@/lib/i18n/context";
import { getProLang } from "@/lib/i18n/server";
import { SECTION_HEADER } from "@/lib/section";
import { logout } from "./actions";
import { AuthLinks, MenuLoginLink } from "./(auth)/auth-links";

/** Sponsor and hospital app chrome (header, footer). The patient portal (/pacientes) has its own layout. */

/** Hospital-facing routes: no sponsor navigation, Spanish label. */
const HOSPITAL_ROUTES = ["/q", "/optout"];

const SOURCES: { name: string; href: string; note?: keyof CommonDict["sourceNotes"] }[] = [
  { name: "CTIS", href: "https://euclinicaltrials.eu/", note: "ema" },
  { name: "REec (AEMPS)", href: "https://reec.aemps.es/" },
  { name: "ClinicalTrials.gov", href: "https://clinicaltrials.gov/", note: "nlm" },
  { name: "Catálogo Nacional de Hospitales", href: "https://www.sanidad.gob.es/estadEstudios/estadisticas/sisInfSanSNS/ofertaRecursos/hospitales/home.htm", note: "msan" },
  { name: "Institutos de Investigación Sanitaria", href: "https://www.isciii.es/", note: "isciii" },
  { name: "Datos abiertos SERMAS", href: "https://datos.comunidad.madrid/", note: "cam" },
  { name: "Wikimedia Commons", href: "https://commons.wikimedia.org/", note: "photos" },
  { name: "OpenStreetMap", href: "https://www.openstreetmap.org/copyright", note: "osm" },
];

export async function generateMetadata(): Promise<Metadata> {
  const t = COMMON[await getProLang()];
  return { title: { template: "%s · Solera", default: t.metaTitle }, description: t.metaDescription };
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  const insights = user?.plan === "insights";
  // Hospital pages (/q, /optout) are Spanish-first whatever the visitor's cookie or browser says (section from proxy.ts).
  const lang = (await headers()).get(SECTION_HEADER) === "hospital" ? "es" : await getProLang();
  const t = COMMON[lang];
  const langLabels: LangToggleLabels = { group: t.langGroup, es: LANG_TOGGLE_LABELS.es, en: LANG_TOGGLE_LABELS.en };
  const toggle = (
    <Suspense fallback={<LangToggleForm lang={lang} labels={langLabels} />}>
      <LangToggle lang={lang} labels={langLabels} />
    </Suspense>
  );

  const sponsorRight = user ? (
    <div className="flex items-center gap-2">
      {insights ? (
        <Badge tone="premium" icon="sparkle" title={t.planInsights}>Insights</Badge>
      ) : (
        <Badge tone="outline" title={t.planFree}>{t.planFree}</Badge>
      )}
      <details className="group relative">
        <summary className="no-marker flex h-9 cursor-pointer items-center gap-2 rounded-lg pr-2 pl-1 text-sm text-ink-2 hover:bg-subtle">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
            {(user.name || "?").trim().charAt(0).toUpperCase()}
          </span>
          <span className="hidden max-w-36 truncate font-medium md:inline">{user.name}</span>
          <Icon name="chevronDown" size={14} className="text-muted transition group-open:rotate-180" />
        </summary>
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          <div className="border-b border-line px-2.5 pt-1.5 pb-2.5">
            <div className="truncate text-sm font-medium text-ink">{user.name}</div>
            <div className="text-xs text-muted">{insights ? t.planInsights : t.planFree}</div>
          </div>
          <Link href="/projects" className="mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-2 hover:bg-subtle hover:text-ink">
            <Icon name="inbox" size={15} /> {t.navProjects}
          </Link>
          <form action={logout}>
            <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink-2 hover:bg-subtle hover:text-ink">
              <Icon name="arrowRight" size={15} /> {t.logOut}
            </button>
          </form>
        </div>
      </details>
    </div>
  ) : (
    <AuthLinks />
  );

  return (
    <LangProvider lang={lang}>
      <div lang={lang} className="contents">
        <a href="#main" className="sr-only z-[100] rounded-lg bg-ink px-3 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          {t.skipToContent}
        </a>
        <header className="sticky top-0 z-40 h-(--header-h) border-b border-line bg-surface/90 backdrop-blur-md supports-[backdrop-filter]:bg-surface/80">
          <div className="mx-auto flex h-full max-w-7xl items-center gap-2 px-4 sm:gap-6 sm:px-6">
            <RouteSwitch
              prefixes={HOSPITAL_ROUTES}
              fallback={
                <>
                  <Logo />
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-muted">
                    <Icon name="shield" size={15} /> {t.hospitalBar}
                  </span>
                </>
              }
            >
              <Link href="/" className="shrink-0 rounded-lg" aria-label={t.homeAria}>
                <Logo sub="Madrid" />
              </Link>
              <nav aria-label={t.navMain} className="hidden items-center gap-1 md:flex">
                <NavLink href="/" also={["/sites"]}>{t.navFindSites}</NavLink>
                <NavLink href="/projects">{t.navProjects}</NavLink>
                <NavLink href="/pacientes">{t.navPatients}</NavLink>
              </nav>
              <div className="ml-auto flex items-center gap-2">
                <div className="hidden sm:block">{toggle}</div>
                {sponsorRight}
                {/* Phone menu */}
                <details className="group relative md:hidden">
                  <summary className="no-marker grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-subtle" aria-label={t.menu}>
                    <Icon name="menu" size={18} />
                  </summary>
                  <nav aria-label={t.navMain} className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
                    <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-subtle">
                      <Icon name="search" size={15} /> {t.navFindSites}
                    </Link>
                    <Link href="/projects" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-subtle">
                      <Icon name="inbox" size={15} /> {t.navProjects}
                    </Link>
                    <Link href="/pacientes" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-subtle">
                      <Icon name="user" size={15} /> {t.navPatients}
                    </Link>
                    {!user && <MenuLoginLink />}
                    <div className="mt-1 flex items-center justify-between gap-2 border-t border-line px-3 pt-2.5 pb-1 sm:hidden">
                      <span className="text-sm text-ink-2">{t.langGroup}</span>
                      {toggle}
                    </div>
                  </nav>
                </details>
              </div>
            </RouteSwitch>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>

        <footer className="border-t border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="max-w-xs">
                <Logo />
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  {t.footerAbout}
                </p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  <Link href="/terms" className="text-ink-2 hover:text-ink">{t.footerTerms}</Link>
                  <Link href="/how-scoring-works" className="text-ink-2 hover:text-ink">{t.footerHow}</Link>
                  <Link href="/data-sources" className="text-ink-2 hover:text-ink">{t.footerSources}</Link>
                  <Link href="/pacientes" className="text-ink-2 hover:text-ink">{t.navPatients}</Link>
                  <span className="inline-flex items-center gap-1 text-muted"><Icon name="lock" size={13} /> {t.footerNoPersonal}</span>
                </div>
              </div>
              <div>
                <h2 className="text-xs font-semibold tracking-wide text-ink-2 uppercase">
                  <Link href="/data-sources" className="hover:text-brand-700 hover:underline">{t.footerCredits}</Link>
                </h2>
                <ul className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                  {SOURCES.map((s) => (
                    <li key={s.name} className="leading-snug">
                      <a href={s.href} target="_blank" rel="noopener noreferrer" className="font-medium text-ink-2 hover:text-brand-700 hover:underline">
                        {s.name}
                      </a>
                      {s.note && <span className="text-muted"> ({t.sourceNotes[s.note]})</span>}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-xs leading-relaxed text-muted">
                  {t.footerEma}
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </LangProvider>
  );
}
