import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui";
import { ownedProject } from "@/lib/auth";
import { getSite } from "@/lib/data";
import { db } from "@/lib/db";
import type { Question } from "@/lib/questionnaire";
import { registryRecords } from "@/lib/site-answers";
import { RecordsList } from "../../../../q/records-list";
import { PROJECTS } from "@/lib/i18n/pro/projects";
import { getProLang } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: PROJECTS[await getProLang()].preview.recordsMetaTitle, robots: { index: false } };
}

/** Sponsor side: the registry records behind a pre-filled count, for one of this project's shortlisted hospitals. */
export default async function PreviewRecordsPage({ params, searchParams }: PageProps<"/projects/[id]/preview/registros">) {
  const { id } = await params;
  const { site: siteParam, p } = await searchParams;
  const lang = await getProLang();
  const t = PROJECTS[lang].preview;
  const project = await ownedProject(id);
  if (!project) notFound();
  const qn = await db.questionnaire.findUnique({ where: { projectId: id } });
  const item = typeof siteParam === "string" ? await db.shortlistItem.findUnique({ where: { projectId_siteId: { projectId: id, siteId: siteParam } } }) : null;
  if (!qn || !item) notFound();
  const q = (JSON.parse(qn.questions) as Question[]).find((x) => x.id === p);
  if (!q) notFound();
  const site = getSite(item.siteId)!;
  return (
    <RecordsList
      siteName={site.name}
      question={q[lang]}
      sponsor={{ lang, t: t.records }}
      records={registryRecords(q, JSON.parse(project.criteria), site.id)}
      back={<Link href={`/projects/${id}/preview?site=${encodeURIComponent(site.id)}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
        <Icon name="arrowLeft" size={13} /> {t.backToPreview}</Link>}
    />
  );
}
