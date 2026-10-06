// Public research contacts of a hospital (professional side): kind badges and source lines shared by the send panel
// on the project page and the "Public research contacts" card on /sites/[id]. See ../pro.ts for the glossary.
import type { ContactKind } from "@/lib/contact-kinds";
import type { Lang } from "../pro";

const en = {
  kinds: {
    clinical_trials_unit: "Clinical trials unit",
    research_foundation: "Research foundation",
    research_institute: "Research institute",
    research_support_office: "Research office",
    ceim_secretariat: "Ethics committee secretariat",
    hospital_general: "Hospital general contact",
  } as Record<ContactKind, string>,
  /** Extra word on the badge of contacts that are not a feasibility route. */
  kindNotes: {
    ceim_secretariat: "regulatory questions, not feasibility",
    hospital_general: "last resort",
  } as Partial<Record<ContactKind, string>>,
  checked: (date: string) => `checked ${date}`,
  sourceAria: (title: string, date: string) => `Source: ${title}, checked ${date} (opens in a new tab)`,
  quoteLabel: "What the page says",
};

const es: typeof en = {
  kinds: {
    clinical_trials_unit: "Unidad de ensayos clínicos",
    research_foundation: "Fundación de investigación",
    research_institute: "Instituto de investigación",
    research_support_office: "Oficina de investigación",
    ceim_secretariat: "Secretaría del comité de ética (CEIm)",
    hospital_general: "Contacto general del hospital",
  },
  kindNotes: {
    ceim_secretariat: "trámites regulatorios, no viabilidad",
    hospital_general: "último recurso",
  },
  checked: (date: string) => `comprobado el ${date}`,
  sourceAria: (title: string, date: string) => `Fuente: ${title}, comprobado el ${date} (se abre en otra pestaña)`,
  quoteLabel: "Lo que dice la página",
};

export const CONTACTS: Record<Lang, typeof en> = { en, es };
