import { notFound } from "next/navigation";
import { getSite } from "@/lib/data";
import { db } from "@/lib/db";
import { parsePrefill } from "@/lib/question-library";
import type { Question } from "@/lib/questionnaire";
import { registryRecords } from "@/lib/site-answers";
import { CloseTab } from "../../close-tab";
import { RecordsList } from "../../records-list";

export const metadata = { title: { absolute: "Registros públicos · Solera" }, robots: { index: false } };

/** The registry records behind a pre-filled count on the hospital's questionnaire (opened from its source badge). */
export default async function RecordsPage({ params, searchParams }: PageProps<"/q/[token]/registros">) {
  const { token } = await params;
  const { p } = await searchParams;
  const inv = await db.invitation.findUnique({
    where: { token },
    include: { shortlistItem: { include: { project: { include: { questionnaire: true } } } } },
  });
  if (!inv || !inv.shortlistItem.project.questionnaire) notFound();
  const questions: Question[] = JSON.parse(inv.shortlistItem.project.questionnaire.questions);
  const q = questions.find((x) => x.id === p);
  if (!q) notFound();
  const site = getSite(inv.shortlistItem.siteId)!;
  return (
    <RecordsList
      siteName={site.name}
      question={q.es}
      records={registryRecords(q, JSON.parse(inv.shortlistItem.project.criteria), site.id, parsePrefill(inv.prefill))}
      // opened in a new tab from the questionnaire: closing it returns to the form with its unsaved answers
      back={<CloseTab />}
    />
  );
}
