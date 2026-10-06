// Sponsor-facing server-action messages (accounts, trial details, questionnaire editing, sending, decisions).
// See ../pro.ts for the glossary. Hospital-facing action messages (submitResponse etc.) stay bilingual in actions.ts.
import type { Lang } from "../pro";

const en = {
  notFound: "Not found",
  alreadyContacted: "Site has already been contacted",
  invalidEmail: "Enter a valid email.",
  enterName: "Enter your name.",
  passwordShort: "Password must be at least 8 characters.",
  emailExists: "An account with this email already exists.",
  badLogin: "Email or password is incorrect.",
  signUpRequired: "Sign up to use questionnaires",
  projectNotFound: "Project not found",
  trialLocked: "Trial details are locked once the questionnaire has been sent.",
  maxItems: "Add at most 8 items to each list.",
  leakDetails: (t: string) => `This mentions something on your "kept out of hospital messages" list (${t}). Rephrase it without it.`,
  noQuestionnaire: "No questionnaire",
  questionnaireLocked: "Questionnaire is locked once sent",
  questionRequired: "This question is required",
  writeQuestion: "Write the question first.",
  leakQuestion: (t: string) => `This question mentions something on your "kept out of hospital messages" list (${t}). Rephrase it without it.`,
  codeQuestion: (c: string) =>
    `This question looks like it names a product code or drug (${c}). Hospitals must not learn the product, so rephrase it in general terms.`,
  alreadyInQuestionnaire: "This question is already in the questionnaire.",
  notInLibrary: "Question not found in the library.",
  questionNotFound: "Question not found.",
  writeSpanish: "Write the Spanish wording (hospitals read it first).",
  leakWording: (t: string) => `This wording mentions something on your "kept out of hospital messages" list (${t}). Rephrase it without it.`,
  codeWording: (c: string) =>
    `This wording looks like it names a product code or drug (${c}). Hospitals must not learn the product, so rephrase it in general terms.`,
  createQuestionnaireFirst: "Create the questionnaire first.",
  alreadySent: "Already sent.",
  confirmInstitutional: "Confirm these are institutional (not personal) addresses.",
  webmail: "This is a personal webmail address. Use the hospital's institutional research mailbox.",
  optedOut: "This address has opted out of Solera emails.",
  leakSend: (t: string) => `Blocked: the questionnaire mentions something on your "kept out of hospital messages" list (${t}). Edit it before sending.`,
  notResponded: "Site has not responded yet",
};

const es: typeof en = {
  notFound: "No encontrado",
  alreadyContacted: "Ya se ha contactado con este centro",
  invalidEmail: "Introduce un correo electrónico válido.",
  enterName: "Introduce tu nombre.",
  passwordShort: "La contraseña debe tener al menos 8 caracteres.",
  emailExists: "Ya existe una cuenta con este correo electrónico.",
  badLogin: "El correo electrónico o la contraseña no son correctos.",
  signUpRequired: "Crea una cuenta para usar los cuestionarios",
  projectNotFound: "Proyecto no encontrado",
  trialLocked: "Los datos del ensayo se bloquean una vez enviado el cuestionario.",
  maxItems: "Añade como máximo 8 elementos a cada lista.",
  leakDetails: (t: string) => `Esto menciona algo de tu lista de términos excluidos (${t}). Reformúlalo sin ello.`,
  noQuestionnaire: "No hay cuestionario",
  questionnaireLocked: "El cuestionario se bloquea una vez enviado",
  questionRequired: "Esta pregunta es obligatoria",
  writeQuestion: "Escribe primero la pregunta.",
  leakQuestion: (t: string) => `Esta pregunta menciona algo de tu lista de términos excluidos (${t}). Reformúlala sin ello.`,
  codeQuestion: (c: string) =>
    `Parece que esta pregunta nombra un código de producto o un fármaco (${c}). Los hospitales no deben conocer el producto: reformúlala en términos generales.`,
  alreadyInQuestionnaire: "Esta pregunta ya está en el cuestionario.",
  notInLibrary: "No se ha encontrado la pregunta en la biblioteca.",
  questionNotFound: "No se ha encontrado la pregunta.",
  writeSpanish: "Escribe la redacción en español (es lo primero que leen los hospitales).",
  leakWording: (t: string) => `Esta redacción menciona algo de tu lista de términos excluidos (${t}). Reformúlala sin ello.`,
  codeWording: (c: string) =>
    `Parece que esta redacción nombra un código de producto o un fármaco (${c}). Los hospitales no deben conocer el producto: reformúlala en términos generales.`,
  createQuestionnaireFirst: "Crea primero el cuestionario.",
  alreadySent: "Ya se ha enviado.",
  confirmInstitutional: "Confirma que son direcciones institucionales (no personales).",
  webmail: "Es una dirección personal de correo web. Usa el buzón institucional de investigación del hospital.",
  optedOut: "Esta dirección se ha dado de baja de los correos de Solera.",
  leakSend: (t: string) => `Bloqueado: el cuestionario menciona algo de tu lista de términos excluidos (${t}). Edítalo antes de enviarlo.`,
  notResponded: "El centro aún no ha respondido",
};

export const ERRORS: Record<Lang, typeof en> = { en, es };
