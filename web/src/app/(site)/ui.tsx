"use client";

// Legacy app-level helpers, now thin wrappers over the design system in src/components/ui.
import { Badge, type BadgeTone, ScoreBar as DsScoreBar } from "@/components/ui";
import { useLang } from "@/lib/i18n/context";
import type { Lang } from "@/lib/i18n/pro";

/** 0–100 meter coloured by the shared score scale. `small` = thinner bar. */
export function ScoreBar({ value, small, label }: { value: number; small?: boolean; label?: string }) {
  return <DsScoreBar value={value} size={small ? "sm" : "md"} label={label} />;
}

const STAGES: Record<string, { label: Record<Lang, string>; tone: BadgeTone }> = {
  shortlisted: { label: { en: "Shortlisted", es: "Preseleccionado" }, tone: "neutral" },
  invited: { label: { en: "Questionnaire sent", es: "Cuestionario enviado" }, tone: "info" },
  responded: { label: { en: "Responded", es: "Ha respondido" }, tone: "warning" },
  approved: { label: { en: "Approved", es: "Aprobado" }, tone: "success" },
  rejected: { label: { en: "Rejected", es: "Descartado" }, tone: "danger" },
};

/** Pipeline stage of a site within a project. */
export function StageChip({ stage }: { stage: string }) {
  const lang = useLang();
  const s = STAGES[stage] ?? STAGES.shortlisted;
  return <Badge tone={s.tone} dot>{s.label[lang]}</Badge>;
}
