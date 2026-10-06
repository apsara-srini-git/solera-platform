import type { ReactNode } from "react";
import { Card, EmptyState, Icon, SourceBadge } from "@/components/ui";
import type { RegistryRecords } from "@/lib/site-answers";
import { registryUrl } from "@/lib/types";
import type { Lang } from "@/lib/i18n/pro";
import type { PROJECTS } from "@/lib/i18n/pro/projects";

/** Sponsor's own language and wording (projects/[id]/preview/registros). Without it the page is the hospital's: Spanish first. */
export type RecordsSponsorView = { lang: Lang; t: (typeof PROJECTS)[Lang]["preview"]["records"] };

const STATUS_ES: Record<string, string> = {
  RECRUITING: "Reclutando",
  NOT_YET_RECRUITING: "Aún no recluta",
  ENROLLING_BY_INVITATION: "Reclutando por invitación",
  ACTIVE_NOT_RECRUITING: "Activo, sin reclutar",
  COMPLETED: "Finalizado",
  TERMINATED: "Interrumpido",
  WITHDRAWN: "Retirado",
  SUSPENDED: "Suspendido",
  UNKNOWN: "Estado desconocido",
};
const PHASE_ES: Record<string, string> = { EARLY_PHASE1: "Fase 0/I", PHASE1: "Fase I", PHASE2: "Fase II", PHASE3: "Fase III", PHASE4: "Fase IV", NA: "Sin fase" };
const MAX = 300;

/**
 * The public registry records behind a pre-filled count (hospital page and the sponsor's "Preview as hospital").
 * Spanish first. Each record links to its registry page (ClinicalTrials.gov or REec).
 */
export function RecordsList({ siteName, question, records, back, sponsor }: {
  siteName: string;
  /** The question as the hospital reads it. */
  question: string;
  records: RegistryRecords | null;
  back: ReactNode;
  sponsor?: RecordsSponsorView;
}) {
  if (sponsor) return <SponsorRecordsList siteName={siteName} question={question} records={records} back={back} {...sponsor} />;
  return (
    <div className="mx-auto max-w-2xl space-y-5" data-testid="registry-records">
      <header className="space-y-2">
        {back}
        <p className="flex items-center gap-1.5 text-[13px] text-muted"><Icon name="building" size={14} /> {siteName}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Registros públicos <span className="font-normal text-muted">/ Public records</span></h1>
        <p className="text-sm text-ink-2">
          Pregunta: <span className="text-ink">{question}</span>
        </p>
      </header>

      {!records ? (
        <EmptyState compact icon="search" title="No hay registros para esta pregunta" description="This answer does not come from the trial registries." />
      ) : (
        <Card padding="none">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">{records.es} <span className="num font-normal text-muted">· {records.trials.length + records.missing.length}</span></h2>
              <p className="text-xs text-muted">{records.en}</p>
            </div>
            <SourceBadge kind="registry" date={records.builtOn} lang="es" />
          </div>
          {records.note && (
            <p className="border-b border-line bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:px-5" data-testid="records-note">
              {records.note.es} <span className="text-amber-800">/ {records.note.en}</span>
            </p>
          )}
          {records.trials.length === 0 && records.missing.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted sm:px-5">Ningún registro. / No records.</p>
          ) : (
            <ol className="divide-y divide-line" data-testid="record-list">
              {records.trials.slice(0, MAX).map((t) => (
                <li key={t.id} className="px-4 py-3 sm:px-5" data-testid="record">
                  <p className="text-sm break-words text-ink">{t.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {t.registryIds.map((id) => (
                      <a key={id} href={registryUrl(id)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-brand-700 hover:underline">
                        {id} <Icon name="external" size={11} />
                      </a>
                    ))}
                    {t.phases.length > 0 && <span>{t.phases.map((p) => PHASE_ES[p] ?? p).join(" / ")}</span>}
                    <span>{STATUS_ES[t.status] ?? t.status}</span>
                    {t.startYear && <span className="num">Inicio {t.startYear}</span>}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {records.missing.length > 0 && (
            <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5" data-testid="records-missing">
              Registros incluidos en la cifra enviada que ya no figuran en los datos actuales / Records counted in the number sent that are no
              longer in the current data: <span className="font-mono">{records.missing.join(", ")}</span>
            </p>
          )}
          {records.trials.length > MAX && (
            <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">Se muestran los {MAX} más recientes. / Showing the {MAX} most recent.</p>
          )}
          <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
            ClinicalTrials.gov y REec (AEMPS), ensayos con un centro en la Comunidad de Madrid asignados a este hospital. Si falta o sobra algún
            ensayo, corrija la cifra en el cuestionario. / ClinicalTrials.gov and REec (AEMPS) trials matched to this hospital; correct the
            number in the questionnaire if a trial is missing or wrong.
          </p>
        </Card>
      )}
    </div>
  );
}

function SponsorRecordsList({ siteName, question, records, back, lang, t }: {
  siteName: string;
  question: string;
  records: RegistryRecords | null;
  back: ReactNode;
} & RecordsSponsorView) {
  return (
    <div className="mx-auto max-w-2xl space-y-5" data-testid="registry-records">
      <header className="space-y-2">
        {back}
        <p className="flex items-center gap-1.5 text-[13px] text-muted"><Icon name="building" size={14} /> {siteName}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.title}</h1>
        <p className="text-sm text-ink-2">
          {t.question} <span className="text-ink">{question}</span>
        </p>
      </header>

      {!records ? (
        <EmptyState compact icon="search" title={t.noRecordsTitle} description={t.noRecordsBody} />
      ) : (
        <Card padding="none">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
            <h2 className="min-w-0 text-sm font-semibold text-ink">{records[lang]} <span className="num font-normal text-muted">· {records.trials.length + records.missing.length}</span></h2>
            <SourceBadge kind="registry" date={records.builtOn} lang={lang} />
          </div>
          {records.note && (
            <p className="border-b border-line bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:px-5" data-testid="records-note">{records.note[lang]}</p>
          )}
          {records.trials.length === 0 && records.missing.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted sm:px-5">{t.none}</p>
          ) : (
            <ol className="divide-y divide-line" data-testid="record-list">
              {records.trials.slice(0, MAX).map((r) => (
                <li key={r.id} className="px-4 py-3 sm:px-5" data-testid="record">
                  <p className="text-sm break-words text-ink">{r.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {r.registryIds.map((id) => (
                      <a key={id} href={registryUrl(id)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-brand-700 hover:underline">
                        {id} <Icon name="external" size={11} />
                      </a>
                    ))}
                    {r.phases.length > 0 && <span>{r.phases.map((p) => t.phases[p] ?? p).join(" / ")}</span>}
                    <span>{t.statuses[r.status] ?? r.status}</span>
                    {r.startYear && <span className="num">{t.started(r.startYear)}</span>}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {records.missing.length > 0 && (
            <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5" data-testid="records-missing">
              {t.missing} <span className="font-mono">{records.missing.join(", ")}</span>
            </p>
          )}
          {records.trials.length > MAX && <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">{t.showing(MAX)}</p>}
          <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">{t.footer}</p>
        </Card>
      )}
    </div>
  );
}
