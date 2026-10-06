import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Icon } from "@/components/ui";
import { HospitalHeader, HospitalShell } from "../hospital-view";
import { getSite } from "@/lib/data";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { type Prefill, institutionalDomain, parsePrefill } from "@/lib/question-library";
import { type Question, blindedSummary, checkAnswer } from "@/lib/questionnaire";
import ResponseForm from "./response-form";

export const metadata = { title: { absolute: "Cuestionario de viabilidad · Solera" }, robots: { index: false } };

export default async function QuestionnairePage({ params }: PageProps<"/q/[token]">) {
  const { token } = await params;
  const inv = await db.invitation.findUnique({
    where: { token },
    include: { shortlistItem: { include: { project: { include: { questionnaire: true } } } } },
  });
  if (!inv || !inv.shortlistItem.project.questionnaire) notFound();
  if (!inv.openedAt) await db.invitation.update({ where: { id: inv.id }, data: { openedAt: new Date() } });

  const project = inv.shortlistItem.project;
  const site = getSite(inv.shortlistItem.siteId)!;
  const questions: Question[] = JSON.parse(project.questionnaire!.questions);
  const summary = blindedSummary(JSON.parse(project.criteria), questions);
  const domain = institutionalDomain(inv.recipientEmail);
  const stored = inv.consentAt && domain ? await db.siteAnswer.count({ where: { siteId: site.id, domain, sourceInvitationId: inv.id } }) : 0;
  // pre-fills saved before validation existed may hold values that fail it (e.g. "7.256" patients / month): drop them.
  // Public-data values are never capped: a registry count above the typo cap is still the true value.
  const raw = parsePrefill(inv.prefill);
  const prefill: Prefill = { v: 2, answers: {}, hints: raw.hints }; // record ids stay on the server
  for (const q of questions) {
    const a = raw.answers[q.id];
    const r = a ? checkAnswer(q, a.value, { uncapped: a.source.kind !== "hospital" }) : null;
    if (a && r?.ok && r.value) prefill.answers[q.id] = { ...a, value: r.value };
  }

  return (
    <HospitalShell>
      <HospitalHeader siteName={site.name} summary={summary} />

      {inv.submittedAt ? (
        <Card className="border-emerald-200 bg-emerald-50 text-center" data-testid="thanks">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Icon name="check" size={20} /></div>
          <p className="mt-3 font-medium text-emerald-900">Gracias. Hemos recibido sus respuestas.</p>
          <p className="text-sm text-emerald-800">Thank you. Your answers have been received.</p>
          {stored > 0 ? (
            <p className="mt-3 text-sm text-emerald-900" data-testid="stored-note">
              Hemos guardado {stored} respuesta{stored === 1 ? "" : "s"} sobre las capacidades de su centro para pre-rellenar futuras solicitudes.{" "}
              <Link href={`/q/${token}/memoria`} className="font-medium underline">Revisar o corregir</Link>
            </p>
          ) : (
            <p className="mt-3 text-xs text-emerald-800">
              No se ha guardado ninguna respuesta nueva para futuras solicitudes (los datos públicos que confirmó no se guardan).
              {domain && inv.consentAt && <> <Link href={`/q/${token}/memoria`} className="font-medium underline">Ver respuestas guardadas</Link></>}
            </p>
          )}
        </Card>
      ) : (
        <ResponseForm token={token} questions={questions} prefill={prefill} domain={domain} recordsHref={`${appUrl()}/q/${token}/registros`} />
      )}
    </HospitalShell>
  );
}
