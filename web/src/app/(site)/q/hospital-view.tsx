import type { ReactNode } from "react";
import { Card, Icon } from "@/components/ui";

/**
 * The top of the hospital questionnaire (header + trial summary), shared by the real hospital page (/q/[token]) and the
 * sponsor's "Preview as hospital", so the preview is exactly what hospitals see. Spanish first.
 */
export function HospitalHeader({ siteName, summary }: { siteName: string; summary: { es: string; en: string }[] }) {
  return (
    <>
      <header>
        <p className="flex items-center gap-1.5 text-[13px] text-muted"><Icon name="building" size={14} /> {siteName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">Cuestionario de viabilidad</h1>
        <p className="text-sm text-muted">Feasibility questionnaire · Madrid</p>
      </header>

      <Card data-testid="hospital-trial-summary">
        <div className="text-sm font-semibold text-ink">Resumen del estudio <span className="font-normal text-muted">/ Study summary</span></div>
        <ul className="mt-2 space-y-1 text-sm text-ink-2">
          {summary.map((s) => <li key={s.es} className="flex gap-2"><span className="text-muted">·</span>{s.es}</li>)}
        </ul>
        <p className="mt-3 flex items-start gap-1.5 border-t border-line pt-3 text-xs text-muted">
          <Icon name="eyeOff" size={13} className="mt-0.5 shrink-0" />
          <span>El nombre del producto y del promotor se comparten tras la firma de un acuerdo de confidencialidad. / Product and sponsor are disclosed after a confidentiality agreement.</span>
        </p>
      </Card>
    </>
  );
}

export function HospitalShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-2xl space-y-5">{children}</div>;
}
