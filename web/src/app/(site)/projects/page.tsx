import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, type BadgeTone, ButtonLink, Card, EmptyState, Icon, PageHeader } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { COMMON, fmtDate, type Lang } from "@/lib/i18n/pro";
import { PROJECTS, projectName } from "@/lib/i18n/pro/projects";
import { getProLang } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: PROJECTS[await getProLang()].list.metaTitle };
}

// same examples as the search form (opened through ?c=, which pre-fills the search)
const EXAMPLES = [
  { c: { indication: "non-small cell lung cancer, NSCLC", area: "oncology", phase: "PHASE3", equipment: ["pet"] } },
  { c: { indication: "multiple sclerosis", area: "neurology", phase: "PHASE2", equipment: ["mri"] } },
  { c: { indication: "acute lymphoblastic leukaemia", area: "hematology", phase: "PHASE2", population: "pediatric" } },
  { c: { indication: "heart failure", area: "cardiovascular", phase: "PHASE2_3" } },
];

/** Where the project stands in the workflow, as a short badge: the next thing to do. */
function nextStep(p: { items: { stage: string }[]; questionnaire: { id: string } | null }, lang: Lang): { label: string; tone: BadgeTone } {
  const t = PROJECTS[lang].list.next;
  const n = p.items.length;
  const count = (...s: string[]) => p.items.filter((i) => s.includes(i.stage)).length;
  const contacted = n - count("shortlisted");
  const responded = count("responded", "approved", "rejected");
  const decided = count("approved", "rejected");
  if (n === 0) return { label: t.noSites, tone: "neutral" };
  if (!p.questionnaire) return { label: t.createQuestionnaire, tone: "brand" };
  if (contacted === 0) return { label: t.send(n), tone: "brand" };
  if (responded === 0) return { label: t.waitingContacted(contacted, n), tone: "info" };
  if (count("responded") > 0) return { label: t.decide(count("responded")), tone: "warning" };
  if (decided === n) return { label: t.allDecided, tone: "success" };
  return { label: t.waitingResponded(responded, contacted), tone: "info" };
}

export default async function ProjectsPage() {
  const lang = await getProLang();
  const t = PROJECTS[lang].list;
  const user = await currentUser();
  if (!user) redirect("/login?next=/projects");
  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { items: { select: { stage: true } }, questionnaire: { select: { id: true } } },
  });
  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={<ButtonLink href="/" icon="search">{t.newSearch}</ButtonLink>}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon="search"
          title={t.emptyTitle}
          description={t.emptyDescription}
          action={
            <div className="flex flex-col items-center gap-4">
              <ButtonLink href="/" icon="search">{COMMON[lang].navFindSites}</ButtonLink>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="mr-0.5 text-xs font-medium text-muted">{t.try}</span>
                {EXAMPLES.map((e, i) => (
                  <Link
                    key={i}
                    href={`/?c=${encodeURIComponent(JSON.stringify(e.c))}`}
                    className="chip h-7 border border-line bg-surface text-ink-2 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                  >
                    {t.examples[i]}
                  </Link>
                ))}
              </div>
            </div>
          }
        />
      ) : (
        <ul className="space-y-3" data-testid="project-list">
          {projects.map((p) => {
            const count = (...s: string[]) => p.items.filter((i) => s.includes(i.stage)).length;
            const step = nextStep(p, lang);
            return (
              <Card key={p.id} as="li" interactive padding="none">
                <Link href={`/projects/${p.id}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <div className="font-medium break-words text-ink">{projectName(p.criteria, p.name, lang)}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge tone={step.tone} dot>{step.label}</Badge>
                      <span>{t.updated(fmtDate(p.updatedAt, lang))}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <dl className="grid flex-1 grid-cols-2 gap-2 sm:w-[26rem] sm:flex-none sm:grid-cols-4">
                      <Mini n={p.items.length} l={t.shortlisted} />
                      <Mini n={p.items.length - count("shortlisted")} l={t.contacted} />
                      <Mini n={count("responded", "approved", "rejected")} l={t.responded} />
                      <Mini n={count("approved")} l={t.approved} />
                    </dl>
                    <Icon name="chevronRight" size={16} className="hidden shrink-0 text-muted sm:block" />
                  </div>
                </Link>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Mini({ n, l }: { n: number; l: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse rounded-lg bg-subtle px-2 py-1.5 text-center sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
      <dt className="text-[11px] leading-tight break-words hyphens-auto text-muted">{l}</dt>
      <dd className="num text-base font-semibold text-ink">{n}</dd>
    </div>
  );
}
