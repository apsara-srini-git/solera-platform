import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, EmptyState, Icon, SourceBadge } from "@/components/ui";
import { getSite } from "@/lib/data";
import { db } from "@/lib/db";
import { REUSE_CONSENT, institutionalDomain } from "@/lib/question-library";
import { numberRuleForKey, showAnswerEs } from "@/lib/questionnaire";
import { rememberedAnswers } from "@/lib/site-answers";
import { forgetRememberedAnswer, updateRememberedAnswer } from "../../../actions";

export const metadata = { title: { absolute: "Respuestas guardadas · Solera" }, robots: { index: false } };

const POP_ES: Record<string, string> = { adult: "adultos", pediatric: "pediátrica", all: "todas las edades" };

/** "non small cell lung cancer,nsclc|adult|PHASE3" → "non small cell lung cancer, nsclc · población: adultos". */
function scopeEs(scope: string) {
  const [ind, pop] = scope.split("|");
  return `${ind.replaceAll(",", ", ")}${pop ? ` · población: ${POP_ES[pop] ?? pop}` : ""}`;
}

/**
 * The hospital's answer memory for THIS invitation's institutional email domain: every stored answer about the centre,
 * to review, correct or delete. Answers stored for other domains are not shown or editable from here.
 */
export default async function MemoryPage({ params, searchParams }: PageProps<"/q/[token]/memoria">) {
  const { token } = await params;
  const { invalid } = await searchParams;
  const inv = await db.invitation.findUnique({ where: { token }, include: { shortlistItem: { select: { siteId: true } } } });
  if (!inv) notFound();
  const site = getSite(inv.shortlistItem.siteId)!;
  const domain = institutionalDomain(inv.recipientEmail);
  const rows = await rememberedAnswers(site.id, domain);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <Link href={`/q/${token}`} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><Icon name="arrowLeft" size={13} /> Volver al cuestionario</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Respuestas guardadas de su centro</h1>
        <p className="mt-1 text-sm text-ink-2">{site.name} · Saved answers about your site</p>
        {domain ? (
          <p className="mt-2 text-[13px] text-muted">
            Respuestas guardadas para las direcciones <strong className="font-medium text-ink-2">@{domain}</strong>. Solo se usan para
            pre-rellenar cuestionarios enviados a este dominio; los promotores no las ven. {REUSE_CONSENT.es}
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-muted">
            Este cuestionario se envió a una dirección de correo personal, por lo que no se guarda ni se muestra ninguna respuesta del centro.
          </p>
        )}
      </header>
      {rows.length === 0 ? (
        <EmptyState icon="inbox" title="No hay respuestas guardadas" description="Las respuestas sobre su centro que usted escriba o corrija aparecerán aquí si acepta guardarlas al enviar un cuestionario." />
      ) : (
        <Card padding="none" className="divide-y divide-line">
          {rows.map((r) => {
            const rule = numberRuleForKey(r.questionKey);
            const yesNo = r.value === "yes" || r.value === "no";
            return (
              <div key={r.id} id={`a-${r.id}`} className="scroll-mt-24 px-4 py-4 sm:px-5" data-testid="memory-row">
                <div className="text-sm font-medium text-ink">{r.questionEs}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <SourceBadge kind="hospital" lang="es" date={r.confirmedAt.toISOString().slice(0, 10)} />
                  {r.scope && <span>Para: {scopeEs(r.scope)}</span>}
                  <span>Válida hasta {r.expiresAt.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                <p className="mt-1.5 text-sm text-ink-2">
                  Respuesta guardada: <strong className="num font-semibold text-ink" data-testid="memory-value">{showAnswerEs(rule ? { type: "number" } : null, r.value)}</strong>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <form action={updateRememberedAnswer.bind(null, token, r.id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {yesNo ? (
                      <select name="value" defaultValue={r.value} aria-label="Respuesta" className="input h-9 w-32">
                        <option value="yes">Sí</option>
                        <option value="no">No</option>
                      </select>
                    ) : rule ? (
                      <input name="value" type="text" autoComplete="off"
                        inputMode={rule.integer ? "numeric" : "decimal"} defaultValue={r.value} aria-label="Respuesta" className="input h-9 w-36" />
                    ) : (
                      <input name="value" defaultValue={r.value} aria-label="Respuesta" className="input h-9 min-w-0 flex-1 basis-40" />
                    )}
                    <Button size="sm" variant="secondary">Guardar corrección</Button>
                  </form>
                  <form action={forgetRememberedAnswer.bind(null, token, r.id)}>
                    <Button size="sm" variant="ghost">Eliminar</Button>
                  </form>
                </div>
                {invalid === r.id && rule && (
                  <p className="mt-1.5 text-[13px] text-rose-700" role="alert">
                    Valor no válido: escriba {rule.integer ? "un número entero" : "un número con un decimal como máximo"} entre {rule.min} y {new Intl.NumberFormat("es-ES").format(rule.max)}, sin separador de miles.
                  </p>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
