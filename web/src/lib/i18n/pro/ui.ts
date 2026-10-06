// Shared UI primitives (components/ui) strings: aria-labels and small chrome. See ../pro.ts for the glossary.
// Kept tiny on purpose: every client page imports it through the generic components.
import type { Lang } from "../pro";

const en = {
  close: "Close",
  remove: "Remove",
  moreInfo: "More information",
  breadcrumb: "Breadcrumb",
  progress: "Progress",
  optional: "(optional)",
  stepOf: (i: number, n: number) => `Step ${i} of ${n}`,
  completed: " (completed)",
  currentStep: " (current step)",
  /** Sponsor workflow steps (Stepper WORKFLOW_STEPS keys). */
  steps: { shortlist: "Shortlist", questionnaire: "Questionnaire", send: "Send", responses: "Responses", decision: "Decision" } as Record<string, string>,
};

const es: typeof en = {
  close: "Cerrar",
  remove: "Quitar",
  moreInfo: "Más información",
  breadcrumb: "Ruta de navegación",
  progress: "Progreso",
  optional: "(opcional)",
  stepOf: (i: number, n: number) => `Paso ${i} de ${n}`,
  completed: " (completado)",
  currentStep: " (paso actual)",
  steps: { shortlist: "Preselección", questionnaire: "Cuestionario", send: "Envío", responses: "Respuestas", decision: "Decisión" },
};

export const UI: Record<Lang, typeof en> = { en, es };
