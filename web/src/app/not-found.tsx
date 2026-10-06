import Link from "next/link";
import { ButtonLink, Logo } from "@/components/ui";
import { COMMON } from "@/lib/i18n/pro";
import { getProLang } from "@/lib/i18n/server";

/** 404 for unmatched URLs (rendered in the bare root layout) and, re-exported from (site)/not-found.tsx, for notFound()
 *  inside the professional site, where the site header and footer (and <main>) wrap it. */
export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <NotFoundContent />
    </main>
  );
}

export async function NotFoundContent() {
  const lang = await getProLang();
  const t = COMMON[lang];
  return (
    <div lang={lang} className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Link href="/" aria-label={t.homeAria}><Logo /></Link>
      <h1 className="text-xl font-semibold text-ink">{t.notFoundTitle}</h1>
      <p className="text-sm text-muted">{t.notFoundBody}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <ButtonLink href="/" variant="secondary">{t.notFoundHome}</ButtonLink>
        <ButtonLink href="/pacientes" variant="secondary">{t.navPatients}</ButtonLink>
      </div>
    </div>
  );
}
