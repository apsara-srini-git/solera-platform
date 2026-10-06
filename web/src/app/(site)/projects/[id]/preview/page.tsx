import { notFound } from "next/navigation";
import { Button, ButtonLink, Icon, Select } from "@/components/ui";
import { ownedProject } from "@/lib/auth";
import { getSite } from "@/lib/data";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import type { Prefill } from "@/lib/question-library";
import { type Question, blindedSummary, checkAnswer } from "@/lib/questionnaire";
import { buildPrefill } from "@/lib/site-answers";
import type { TrialCriteria } from "@/lib/types";
import { PROJECTS } from "@/lib/i18n/pro/projects";
import { getProLang } from "@/lib/i18n/server";
import { HospitalHeader, HospitalShell } from "../../../q/hospital-view";
import ResponseForm from "../../../q/[token]/response-form";

export async function generateMetadata() {
  return { title: PROJECTS[await getProLang()].preview.metaTitle, robots: { index: false } };
}

/**
 * "Preview as hospital": the exact hospital page (summary + questions, Spanish first), read-only. Without a hospital it
 * shows no pre-fills; with one of this project's shortlisted hospitals it adds that hospital's PUBLIC pre-fills only.
 * Stored hospital answers are never loaded here (no recipient domain), so nothing from other projects can show.
 */
export default async function PreviewPage({ params, searchParams }: PageProps<"/projects/[id]/preview">) {
  const { id } = await params;
  const { site: siteParam } = await searchParams;
  const t = PROJECTS[await getProLang()].preview;
  const project = await ownedProject(id);
  if (!project) notFound();
  const qn = await db.questionnaire.findUnique({ where: { projectId: id } });
  if (!qn) notFound();
  const items = await db.shortlistItem.findMany({ where: { projectId: id }, orderBy: { publicScore: "desc" }, select: { siteId: true } });
  const criteria: TrialCriteria = JSON.parse(project.criteria);
  const questions: Question[] = JSON.parse(qn.questions);
  const summary = blindedSummary(criteria, questions);

  const siteId = typeof siteParam === "string" && items.some((i) => i.siteId === siteParam) ? siteParam : null;
  const site = siteId ? getSite(siteId) : null;
  const prefill: Prefill = { v: 2, answers: {}, hints: {} };
  if (site) {
    const raw = await buildPrefill(questions, criteria, site.id, null); // null domain = public data only
    prefill.hints = raw.hints;
    for (const q of questions) {
      const a = raw.answers[q.id];
      if (!a || a.source.kind === "hospital") continue;
      const r = checkAnswer(q, a.value, { uncapped: true });
      if (r.ok && r.value) prefill.answers[q.id] = { ...a, value: r.value };
    }
  }

  return (
    <div className="space-y-5">
      <div className="mx-auto max-w-2xl rounded-xl bg-ink p-4 text-white shadow-card" data-testid="preview-banner">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold"><Icon name="eyeOff" size={15} /> {t.title}</p>
            <p className="mt-0.5 text-[13px] text-white/75">
              {t.intro}{" "}
              {site ? t.withSite : t.withoutSite}
            </p>
          </div>
          <ButtonLink href={`/projects/${id}#questionnaire`} variant="secondary" size="sm" icon="arrowLeft">{t.backToProject}</ButtonLink>
        </div>
        {items.length > 0 && (
          <form method="get" className="mt-3 flex gap-2">
            <Select name="site" defaultValue={siteId ?? ""} aria-label={t.hospitalAria} className="h-9 min-w-0 flex-1 bg-surface text-ink">
              <option value="">{t.noHospital}</option>
              {items.map((i) => (
                <option key={i.siteId} value={i.siteId}>{getSite(i.siteId)?.name ?? i.siteId}</option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" size="sm" className="h-9">{t.show}</Button>
          </form>
        )}
      </div>

      <HospitalShell>
        <HospitalHeader siteName={site?.name ?? "Nombre del hospital"} summary={summary} />
        <ResponseForm token="" questions={questions} prefill={prefill} domain={null} preview
          recordsHref={site ? `${appUrl()}/projects/${id}/preview/registros?site=${encodeURIComponent(site.id)}` : null} />
      </HospitalShell>
    </div>
  );
}
