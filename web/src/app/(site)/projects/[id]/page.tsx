import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  ScoreBadge,
  Stepper,
} from "@/components/ui";
import { currentUser, ownedProject } from "@/lib/auth";
import { bestContactIndex, parseContactRecord } from "@/lib/contact-kinds";
import { getHospitalContacts } from "@/lib/contacts";
import { getSite } from "@/lib/data";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { type LibraryItem, builtinLibrary, libraryMeta, parsePrefill, type Prefill, redactForSponsor } from "@/lib/question-library";
import { type MatchResult, type Question, blindedSummary, findLeaks, hospitalFacingTexts, showAnswer } from "@/lib/questionnaire";
import { buildPrefills } from "@/lib/site-answers";
import type { ConfidentialInfo, TrialCriteria } from "@/lib/types";
import { COMMON, LABELS, fmtDate } from "@/lib/i18n/pro";
import { PROJECTS, matchLine, projectName } from "@/lib/i18n/pro/projects";
import { UI } from "@/lib/i18n/pro/ui";
import { getProLang } from "@/lib/i18n/server";
import { createQuestionnaire, removeFromShortlist } from "../../actions";
import { StageChip } from "../../ui";
import DecisionButtons from "./decision-buttons";
import PrefillSummary, { type PrefillRow } from "./prefill-summary";
import HelpTip from "./help-tip";
import KeptOut from "./kept-out";
import QuestionBuilder from "./question-builder";
import QuestionList from "./question-list";
import TrialDetails from "./trial-details";
import SendPanel, { type SendRow } from "./send-panel";

export async function generateMetadata({ params }: PageProps<"/projects/[id]">) {
  const lang = await getProLang();
  const project = await ownedProject((await params).id);
  return { title: project ? projectName(project.criteria, project.name, lang) : PROJECTS[lang].list.metaTitle };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const project = await ownedProject(id);
  if (!project) notFound();
  const user = await currentUser();
  const lang = await getProLang();
  const T = PROJECTS[lang];
  const t = T.page;
  const L = LABELS[lang];
  const criteria: TrialCriteria = JSON.parse(project.criteria);
  const name = projectName(project.criteria, project.name, lang);
  const conf: ConfidentialInfo & { fromUpload?: unknown } = JSON.parse(project.confidential);
  delete conf.fromUpload; // which terms came from a protocol upload: server-side bookkeeping, not sent to the browser
  const items = await db.shortlistItem.findMany({ where: { projectId: id }, include: { invitation: true }, orderBy: { publicScore: "desc" } });
  const qn = await db.questionnaire.findUnique({ where: { projectId: id } });
  const questions: Question[] = qn ? JSON.parse(qn.questions) : [];
  const summary = blindedSummary(criteria, questions);
  const locked = items.some((i) => i.invitation);
  const leaks = qn ? findLeaks(hospitalFacingTexts(criteria, questions), conf) : [];
  const target = [
    criteria.targetPatientsPerSite ? t.patientsPerSite(criteria.targetPatientsPerSite) : null,
    criteria.recruitmentMonths ? t.months(criteria.recruitmentMonths) : null,
  ].filter(Boolean).join(" · ");
  const responded = items
    .filter((i) => i.invitation?.submittedAt)
    .sort((a, b) => (b.invitation!.matchScore ?? 0) - (a.invitation!.matchScore ?? 0));
  const approved = items.filter((i) => i.stage === "approved");
  const sent = items.filter((i) => i.invitation).length;
  const decided = items.filter((i) => i.stage === "approved" || i.stage === "rejected").length;
  const pendingDecisions = items.length - decided;

  // ---- pre-fill per hospital: what was sent (locked), or computed live from PUBLIC DATA ONLY ----
  // Before sending, the recipient domain is unknown, and counting the hospital's stored answers would overstate the
  // pre-fill and reveal that the hospital answered Solera before. After sending, a row shows what that invitation
  // carried, with hospital-sourced answers redacted on the server (counts only, never the value or date).
  let prefillRows: PrefillRow[] = [];
  let library: LibraryItem[] = [];
  if (user && qn) {
    const live = await buildPrefills(questions, criteria, items.filter((i) => !i.invitation).map((i) => i.siteId), null);
    prefillRows = items.map((i) => ({
      itemId: i.id,
      siteId: i.siteId,
      siteName: getSite(i.siteId)?.name ?? i.siteId,
      sent: !!i.invitation,
      prefill: redactForSponsor((i.invitation ? parsePrefill(i.invitation.prefill) : live.get(i.siteId)) ?? ({ v: 2, answers: {}, hints: {} } as Prefill)),
    }));
    if (!locked) {
      // the built-in library is shared; sponsor-written questions are private to their author
      const custom = await db.libraryQuestion.findMany({
        where: { createdByUserId: user.id },
        orderBy: { uses: "desc" },
        take: 300,
      });
      library = [
        ...builtinLibrary(),
        ...custom.map((e) => ({
          key: e.key, es: e.es, en: e.en, origin: "custom" as const,
          type: (e.type === "yesno" || e.type === "number" ? e.type : "text") as LibraryItem["type"],
          policy: (e.policy === "site" ? "site" : "trial") as LibraryItem["policy"],
        })),
      ];
    }
  }

  // ---- stepper ----
  const current =
    items.length === 0 ? "shortlist"
    : !qn ? "questionnaire"
    : sent === 0 ? "send"
    : responded.length === 0 ? "responses"
    : "decision";
  // Stepper.tsx is a client module, so its WORKFLOW_STEPS can't be read here; same keys, labels in the page language.
  const order = Object.keys(UI[lang].steps);
  const completed = order.slice(0, order.indexOf(current));
  if (items.length > 0 && decided === items.length) completed.push("decision");
  const hints: Record<string, string> = {
    shortlist: t.hints.sites(items.length),
    questionnaire: qn ? t.hints.questions(questions.length) : t.hints.notCreated,
    send: t.hints.sent(sent, items.length),
    responses: t.hints.received(responded.length),
    decision: t.hints.approved(approved.length),
  };
  const steps = order.map((key) => ({ key, label: UI[lang].steps[key], hint: hints[key], href: `#${key}` }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: user ? COMMON[lang].navProjects : t.search, href: user ? "/projects" : "/" }, { label: name }]}
        title={name}
        meta={
          <>
            <Badge tone="brand">{L.phases[criteria.phase] ?? criteria.phase}</Badge>
            <Badge>{L.populations[criteria.population]}</Badge>
            {target && <Badge>{target}</Badge>}
            <Badge tone="outline" icon="pin">Madrid</Badge>
          </>
        }
        actions={!locked && <ButtonLink href={`/?project=${id}`} variant="secondary" icon="search">{t.addMoreSites}</ButtonLink>}
      />

      <Card padding="md">
        <Stepper current={current} completed={completed} steps={steps} />
      </Card>

      {!user && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            {t.anonNotice}
          </p>
          <ButtonLink href={`/signup?next=/projects/${id}`}>{t.anonSignUp}</ButtonLink>
        </Card>
      )}

      {/* 1. Shortlist */}
      <Section id="shortlist" n={1} title={t.shortlistTitle} sub={t.shortlistSub}>
        {items.length === 0 ? (
          <EmptyState compact icon="search" title={t.noSitesTitle} description={t.noSitesDescription}
            action={<ButtonLink href={`/?project=${id}`} variant="secondary" icon="search">{t.searchSites}</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((i) => {
              const site = getSite(i.siteId)!;
              return (
                <li key={i.id} className="flex items-start gap-3 py-3 sm:items-center" data-testid="shortlist-row">
                  <ScoreBadge score={Math.round(i.publicScore)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/sites/${site.id}?c=${encodeURIComponent(project.criteria)}`} className="font-medium text-ink hover:text-brand-700 hover:underline">{site.name}</Link>
                    <div className="truncate text-xs text-muted">{site.researchUnit?.institute ?? site.municipality}</div>
                    {i.stage !== "shortlisted" && <div className="mt-1.5 sm:hidden"><StageChip stage={i.stage} /></div>}
                  </div>
                  {i.stage !== "shortlisted" && <div className="hidden shrink-0 sm:block"><StageChip stage={i.stage} /></div>}
                  {i.stage === "shortlisted" && (
                    <form action={removeFromShortlist.bind(null, i.id)} className="shrink-0">
                      <Button variant="ghost" size="sm" icon="x" aria-label={t.removeAria(site.name)}>
                        <span className="hidden sm:inline">{COMMON[lang].remove}</span>
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {user && items.length > 0 && (
        <>
          {/* 2. Questionnaire (with the confidential details that power the leak check) */}
          <Section id="questionnaire" n={2} title={t.questionnaireTitle} sub={t.questionnaireSub}>
            <div className="space-y-5">
              <TrialDetails
                projectId={id}
                locked={locked}
                hasQuestionnaire={!!qn}
                areaLabel={criteria.area ? L.areas[criteria.area] ?? criteria.area : t.anyArea}
                populationLabel={L.populations[criteria.population]}
                initial={{
                  targetPatientsPerSite: criteria.targetPatientsPerSite ?? null,
                  recruitmentMonths: criteria.recruitmentMonths ?? null,
                  keyCriteria: criteria.keyCriteria ?? [],
                  otherRequirements: criteria.otherRequirements ?? [],
                  areaOther: criteria.areaOther ?? "",
                  populationOther: criteria.populationOther ?? "",
                }}
              />

              <KeptOut projectId={id} conf={conf} />

              {!qn ? (
                <form action={createQuestionnaire.bind(null, id)} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <Button icon="sparkle" size="lg">{t.generate}</Button>
                  <p className="text-[13px] text-muted">{t.generateNote}</p>
                </form>
              ) : (
                <>
                  <div className="rounded-xl bg-subtle p-4 text-sm" data-testid="hospital-summary">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-medium text-ink">
                        <Icon name="doc" size={15} className="text-muted" /> {t.trialSummary} <span className="font-normal text-muted">{t.trialSummaryNote}</span>
                      </div>
                      <ButtonLink href={`/projects/${id}/preview`} target="_blank" variant="secondary" size="sm" icon="external" data-testid="preview-as-hospital">
                        {t.previewAsHospital}
                      </ButtonLink>
                    </div>
                    <dl className="mt-3 divide-y divide-line/70">
                      {summary.map((s) => {
                        const [labelEn, ...en] = s.en.split(": ");
                        const valueEn = en.join(": ");
                        const valueEs = s.es.slice(s.es.indexOf(": ") + 2);
                        const label = lang === "es" ? s.es.slice(0, s.es.indexOf(": ")) : labelEn;
                        return (
                          <div key={s.en} className="grid gap-0.5 py-1.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
                            <dt className="text-xs text-muted sm:text-[13px]">{label}</dt>
                            <dd className="min-w-0 break-words text-ink">
                              <span lang="es">{valueEs}</span>
                              {lang === "en" && valueEn !== valueEs && <span className="block text-xs text-muted">{valueEn}</span>}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                    <p className="mt-2 text-xs text-muted">{t.summaryFooter}</p>
                  </div>
                  {leaks.length > 0 && (
                    <p className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200" role="alert" data-testid="leak-alert">
                      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                      <span>{t.leakBefore}<strong>{leaks.join(", ")}</strong>{t.leakAfter}</span>
                    </p>
                  )}

                  <PrefillSummary recordsBase={`${appUrl()}/projects/${id}/preview/registros`} questions={questions} rows={prefillRows} />

                  <div>
                    <h3 className="text-sm font-semibold text-ink">{t.questions} <span className="num font-normal text-muted">· {questions.length}</span></h3>
                    {!locked && <p className="mt-0.5 text-[13px] text-muted">{t.questionsNote}</p>}
                    <QuestionList projectId={id} locked={locked} rows={questions.map((q) => ({ q, policy: libraryMeta(q).policy }))} />
                  </div>
                  {locked ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted"><Icon name="lock" size={13} /> {t.locked}</p>
                  ) : (
                    <QuestionBuilder projectId={id} library={library} existingKeys={questions.map((q) => libraryMeta(q).key)} />
                  )}
                </>
              )}
            </div>
          </Section>

          {/* 3. Send */}
          {qn && (
            <Section id="send" n={3} title={t.sendTitle}
              sub={<>{t.sendSub}{" "}
                <HelpTip label={t.sendTipLabel}>{t.sendTip}</HelpTip></>}>
              <SendPanel deliveryConfigured={!!process.env.RESEND_API_KEY} disabled={leaks.length > 0}
                targetMissing={!criteria.targetPatientsPerSite || !criteria.recruitmentMonths} rows={items.map((i): SendRow => {
                const site = getSite(i.siteId)!;
                const inv = i.invitation;
                const contacts = inv ? [] : getHospitalContacts(site.id);
                return {
                  itemId: i.id,
                  siteName: site.name,
                  institute: site.researchUnit?.institute ?? null,
                  contacts,
                  best: bestContactIndex(contacts),
                  sent: inv
                    ? {
                        email: inv.recipientEmail,
                        date: fmtDate(inv.sentAt, lang),
                        status: inv.submittedAt ? "responded" : inv.openedAt ? "opened" : "sent",
                        contact: parseContactRecord(inv.recipientContact),
                      }
                    : null,
                };
              })} />
            </Section>
          )}

          {/* 4. Responses */}
          {locked && (
            <Section id="responses" n={4} title={t.responsesTitle}
              sub={<>{t.responsesSub}{" "}
                <HelpTip label={t.responsesTipLabel} align="start">{t.responsesTip}</HelpTip>{" "}{t.responsesEmails}</>}>
              {responded.length === 0 ? (
                <EmptyState compact icon="inbox" title={t.waitingTitle} description={t.waitingDescription} />
              ) : (
                <ol className="space-y-3">
                  {responded.map((i, rank) => {
                    const site = getSite(i.siteId)!;
                    const m: MatchResult = JSON.parse(i.invitation!.matchDetail!);
                    const answers: Record<string, string> = JSON.parse(i.invitation!.answers!);
                    const pre = parsePrefill(i.invitation!.prefill);
                    return (
                      <li key={i.id} className="rounded-xl border border-line p-4" data-testid="response">
                        <div className="flex items-start gap-3">
                          <div className="num w-5 shrink-0 pt-1 text-muted">{rank + 1}</div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-ink">{site.name}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                              <StageChip stage={i.stage} />
                              <span>{t.scores(i.invitation!.responseScore ?? 0, Math.round(i.publicScore))}</span>
                            </div>
                          </div>
                          <div className="shrink-0 text-center">
                            <ScoreBadge score={i.invitation!.matchScore ?? 0} size="lg" />
                            <div className="mt-1 text-[10px] tracking-wide text-muted uppercase">{t.match}</div>
                          </div>
                        </div>
                        <div className="mt-3 sm:pl-8">
                          <ul className="space-y-0.5 text-xs">
                            {m.reasons.map((r) => <li key={r} className="flex items-start gap-1.5 text-ink-2"><Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-600" /> {matchLine(r, lang)}</li>)}
                            {m.flags.map((f) => <li key={f} className="flex items-start gap-1.5 text-amber-800"><Icon name="alert" size={12} className="mt-0.5 shrink-0" /> {matchLine(f, lang)}</li>)}
                          </ul>
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer font-medium text-brand-700">{t.viewAnswers}</summary>
                            <dl className="mt-2 space-y-2 sm:space-y-1">
                              {questions.map((q) => {
                                const confirmedPrefill = pre.answers[q.id] && pre.answers[q.id].value === answers[q.id];
                                return (
                                  <div key={q.id} className="grid gap-0.5 sm:grid-cols-[1fr_minmax(120px,200px)] sm:gap-3">
                                    <dt className="text-muted">{q[lang]}</dt>
                                    <dd className="min-w-0 break-words font-medium text-ink">
                                      {answers[q.id] === undefined ? "-" : showAnswer(q, answers[q.id], lang)}
                                      {confirmedPrefill && <span className="ml-1 font-normal text-muted">{t.prefillConfirmed}</span>}
                                    </dd>
                                  </div>
                                );
                              })}
                            </dl>
                          </details>
                        </div>
                        {i.stage === "responded" && (
                          <div className="mt-3 flex justify-end border-t border-line pt-3">
                            <DecisionButtons itemId={i.id} siteName={site.name} declined={m.declined} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Section>
          )}

          {/* 5. Decision */}
          {approved.length > 0 && (
            <section id="decision" className="card scroll-mt-24 border-emerald-200 bg-emerald-50 p-5">
              <h2 className="flex items-center gap-2 font-semibold text-emerald-900"><Icon name="check" size={16} /> {t.finalShortlist(approved.length)}</h2>
              <p className="mt-1 text-sm text-emerald-900">{approved.map((i) => getSite(i.siteId)!.name).join(" · ")}</p>
              <p className="mt-2 text-xs text-emerald-800">
                {pendingDecisions > 0 ? t.stillPending(pendingDecisions) : t.allDecided}{" "}
                {t.nextWorkflow}
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ id, n, title, sub, children }: { id: string; n: number; title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">{n}</span>
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {sub && <div className="mt-0.5 text-[13px] text-muted">{sub}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}
