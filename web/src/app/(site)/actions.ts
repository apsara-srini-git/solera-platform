"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { anonId, currentUser, endSession, ensureAnonId, newToken, ownedProject, startSession } from "@/lib/auth";
import { contactRecord, findPublicContact } from "@/lib/contact-kinds";
import { getHospitalContacts } from "@/lib/contacts";
import { getSite } from "@/lib/data";
import { db } from "@/lib/db";
import { appUrl, complianceFooter, sendEmail } from "@/lib/email";
import {
  type Answers,
  type Question,
  blindedSummary,
  checkAnswer,
  checkNumber,
  findLeaks,
  generateQuestions,
  hospitalFacingTexts,
  regenerateQuestions,
  questionnaireSummaryLabel,
  numberRuleForKey,
  scoreResponse,
  suspiciousTerms,
} from "@/lib/questionnaire";
import { builtinQuestion, institutionalDomain, libraryMeta, normText, parsePrefill, type ReusePolicy } from "@/lib/question-library";
import { checkIndication, parseCriteria, scoreOne, searchSites, type SearchResponse } from "@/lib/search";
import type { IndicationCheck } from "@/lib/spelling";
import { buildPrefill, rememberAnswerOps } from "@/lib/site-answers";
import { PHASES_ES, type ConfidentialInfo, type TrialCriteria } from "@/lib/types";
import { ERRORS } from "@/lib/i18n/pro/errors";
import { getProLang } from "@/lib/i18n/server";

/** Sponsor-facing messages in the sponsor's UI language. */
const msg = async () => ERRORS[await getProLang()];

// ---------- search & shortlist (no account needed) ----------

export type SearchResult = SearchResponse & {
  criteria: TrialCriteria;
  /** Which parts of the indication match registered Madrid trials, with spelling suggestions for those that don't. */
  check?: IndicationCheck;
  /** true = no part of the indication matches any trial and the sponsor has not chosen "Search anyway": nothing was
   *  ranked (a silent fallback to area / all trials would look like a real ranking). */
  needsConfirm?: boolean;
};

/** `anyway`: rank even when the condition matches no registered trial (scores then reflect overall activity only). */
export async function runSearch(input: unknown, opts?: { anyway?: boolean }): Promise<SearchResult> {
  const criteria = parseCriteria(input);
  const empty = { results: [], excluded: { missingEquipment: 0, noTrialHistory: 0, ownership: 0 }, totalSites: 0, criteria };
  if (!criteria.indication) return empty;
  const check = checkIndication(criteria.indication);
  if (check.noneMatch && !opts?.anyway) return { ...empty, check, needsConfirm: true };
  return { ...searchSites(criteria, await getProLang()), criteria, check };
}

/** Adds/removes a site. Creates a project on first add (owned by the user, or by this browser session if anonymous). */
/**
 * `fromProtocol`: details detected in an uploaded protocol. The confidential fields are saved with the
 * project (they power the leak check and are never shown to sites) and the upload is linked to it.
 */
export async function toggleShortlist(
  projectId: string | null,
  criteriaInput: unknown,
  siteId: string,
  fromProtocol?: { uploadId: string; confidential: ConfidentialInfo },
) {
  const incoming = parseCriteria(criteriaInput);
  const user = await currentUser();
  let project = projectId ? await ownedProject(projectId) : null;
  let criteria = incoming;
  if (project) {
    const stored = parseCriteria(JSON.parse(project.criteria));
    const hasQuestionnaire = await db.questionnaire.findUnique({ where: { projectId: project.id } });
    // criteria locked once a questionnaire exists: only the SEARCH fields count (trial details are edited on the project)
    if (hasQuestionnaire && searchKey(stored) !== searchKey(incoming)) project = null;
    else criteria = mergeTrialDetails(stored, incoming);
  }
  if (!project) {
    project = await db.project.create({
      data: {
        name: questionnaireSummaryLabel(criteria),
        criteria: JSON.stringify(criteria),
        ...(user ? { userId: user.id } : { anonId: await ensureAnonId() }),
      },
    });
  } else {
    await applyCriteria(project, criteria);
  }
  if (fromProtocol) await attachProtocol(project, fromProtocol, user?.id ?? null);
  const existing = await db.shortlistItem.findUnique({ where: { projectId_siteId: { projectId: project.id, siteId } } });
  if (existing) {
    if (existing.stage === "shortlisted") await db.shortlistItem.delete({ where: { id: existing.id } });
  } else {
    const score = scoreOne(siteId, criteria)?.score ?? 0;
    await db.shortlistItem.create({ data: { projectId: project.id, siteId, publicScore: score } });
  }
  const items = await db.shortlistItem.findMany({ where: { projectId: project.id }, select: { siteId: true } });
  return { projectId: project.id, siteIds: items.map((i) => i.siteId) };
}

/** The search fields of a project's criteria (what ranks hospitals). Trial details are not part of it. */
function searchKey(c: TrialCriteria): string {
  return JSON.stringify([c.indication, c.area, c.phase, c.population, [...c.equipment].sort(), !!c.equipmentStrict, c.ownership]);
}

/**
 * Search criteria arriving from the search page + the trial details already on the project (patients per site,
 * months, key criteria, other requirements, area / population detail). The project's values win unless the incoming
 * criteria carry their own (e.g. from a protocol upload).
 */
function mergeTrialDetails(stored: TrialCriteria, incoming: TrialCriteria): TrialCriteria {
  const out: TrialCriteria = { ...incoming };
  if (incoming.targetPatientsPerSite === undefined) out.targetPatientsPerSite = stored.targetPatientsPerSite;
  if (incoming.recruitmentMonths === undefined) out.recruitmentMonths = stored.recruitmentMonths;
  if (!incoming.keyCriteria?.length) out.keyCriteria = stored.keyCriteria ?? [];
  if (!incoming.otherRequirements?.length) out.otherRequirements = stored.otherRequirements ?? [];
  if (!incoming.areaOther && stored.areaOther) out.areaOther = stored.areaOther;
  if (!incoming.populationOther && stored.populationOther) out.populationOther = stored.populationOther;
  return parseCriteria(out);
}

/**
 * Saves new criteria on a project. If a questionnaire exists and nothing has been sent, it is regenerated, keeping
 * custom questions, rewordings, removals and order. Once sent, the stored criteria never change.
 */
async function applyCriteria(project: { id: string; criteria: string }, next: TrialCriteria) {
  const stored = parseCriteria(JSON.parse(project.criteria));
  if (JSON.stringify(stored) === JSON.stringify(next)) return;
  const qn = await db.questionnaire.findUnique({ where: { projectId: project.id } });
  if (qn) {
    const sent = await db.invitation.count({ where: { shortlistItem: { projectId: project.id } } });
    if (sent > 0) return;
    const questions = regenerateQuestions(stored, next, JSON.parse(qn.questions) as Question[]);
    await db.questionnaire.update({ where: { id: qn.id }, data: { questions: JSON.stringify(questions) } });
  }
  await db.project.update({ where: { id: project.id }, data: { criteria: JSON.stringify(next), name: questionnaireSummaryLabel(next) } });
}

/**
 * The project's stored kept-out list. `fromUpload` (never shown to hospitals) remembers, per protocol upload, the
 * terms that upload last put on the list, so later attaches apply only the sponsor's changes in the upload panel.
 */
type StoredConfidential = ConfidentialInfo & { fromUpload?: Record<string, string[]> };
const FIELD_KINDS = ["drugName", "sponsorName", "protocolCode"] as const;
const termKey = (s: string) => s.trim().toLowerCase();

/** Every term on a kept-out list, as one flat list (field values + other terms). */
function allTerms(c: ConfidentialInfo): string[] {
  return [...FIELD_KINDS.map((k) => c[k]), ...(c.otherTerms ?? [])].filter((t): t is string => typeof t === "string" && !!t.trim());
}

/**
 * Applies the "Terms kept out of hospital messages" panel of a protocol upload to the project. The panel's list is
 * the full desired list for terms that came from this upload: terms the sponsor removed there are removed from the
 * project (if this upload had added them), new ones are added. Terms the sponsor typed on the project page itself are
 * never dropped, and project-page removals of upload terms stay removed while the panel list is unchanged.
 */
async function attachProtocol(
  project: { id: string; confidential: string; anonId: string | null },
  p: { uploadId: string; confidential: ConfidentialInfo },
  userId: string | null,
) {
  const anon = await anonId();
  const upload = await db.protocolUpload.findUnique({ where: { id: p.uploadId } });
  const owns = upload && (userId ? upload.userId === userId : !!anon && upload.anonId === anon);
  if (!owns) return;
  if (!upload.projectId) await db.protocolUpload.update({ where: { id: upload.id }, data: { projectId: project.id } });
  if (!upload.keepConfidential) return; // detected details are saved only with explicit consent
  const current: StoredConfidential = JSON.parse(project.confidential);
  const clean = (v?: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) || undefined : undefined);
  const panel: ConfidentialInfo = {
    drugName: clean(p.confidential?.drugName),
    sponsorName: clean(p.confidential?.sponsorName),
    protocolCode: clean(p.confidential?.protocolCode),
    otherTerms: cleanTerms(Array.isArray(p.confidential?.otherTerms) ? p.confidential.otherTerms : []),
  };
  const panelTerms = cleanTerms(allTerms(panel));
  const panelKeys = new Set(panelTerms.map(termKey));
  const prevKeys = new Set((current.fromUpload?.[upload.id] ?? []).map(termKey));
  const removed = new Set([...prevKeys].filter((k) => !panelKeys.has(k)));
  const isAdded = (t: string) => !prevKeys.has(termKey(t));

  const next: ConfidentialInfo = {};
  for (const k of FIELD_KINDS) {
    const cur = clean(current[k]);
    if (cur && !removed.has(termKey(cur))) next[k] = cur;
  }
  const others = (current.otherTerms ?? []).filter((t) => !removed.has(termKey(t)));
  const present = () => new Set([...allTerms(next), ...others].map(termKey));
  for (const k of FIELD_KINDS) {
    const t = panel[k];
    if (!t || !isAdded(t) || present().has(termKey(t))) continue;
    if (!next[k]) next[k] = t;
    else others.push(t); // the project already has its own value for this field: keep both
  }
  for (const t of panel.otherTerms ?? []) if (isAdded(t) && !present().has(termKey(t))) others.push(t);
  const terms = cleanTerms(others);
  if (terms.length) next.otherTerms = terms;

  const out: StoredConfidential = { ...next, fromUpload: { ...current.fromUpload, [upload.id]: panelTerms } };
  if (JSON.stringify(out) !== JSON.stringify(current))
    await db.project.update({ where: { id: project.id }, data: { confidential: JSON.stringify(out) } });
}

/** Untrusted list of kept-out terms → trimmed strings of ≤200 chars, case-insensitive duplicates dropped, at most 20. */
function cleanTerms(v: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of v) {
    if (typeof t !== "string") continue;
    const s = t.trim().slice(0, 200).trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= 20) break;
  }
  return out;
}

export async function removeFromShortlist(itemId: string) {
  const item = await db.shortlistItem.findUnique({ where: { id: itemId } });
  if (!item || !(await ownedProject(item.projectId))) throw new Error((await msg()).notFound);
  if (item.stage !== "shortlisted") throw new Error((await msg()).alreadyContacted);
  await db.shortlistItem.delete({ where: { id: itemId } });
  revalidatePath(`/projects/${item.projectId}`);
}

// ---------- accounts ----------

export type FormState = { error?: string } | undefined;

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  const organisation = String(form.get("organisation") ?? "").trim() || null;
  const password = String(form.get("password") ?? "");
  const t = await msg();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: t.invalidEmail };
  if (!name) return { error: t.enterName };
  if (password.length < 8) return { error: t.passwordShort };
  if (await db.user.findUnique({ where: { email } })) return { error: t.emailExists };
  const user = await db.user.create({ data: { email, name, organisation, passwordHash: await bcrypt.hash(password, 10) } });
  await startSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(String(form.get("password") ?? ""), user.passwordHash)))
    return { error: (await msg()).badLogin };
  await startSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await endSession();
  redirect("/");
}

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/projects";
}

/** Placeholder for Stripe checkout: flips the plan so the paid UI can be built and tested. */
export async function unlockInsights(returnTo: string) {
  const user = await currentUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(returnTo)}`);
  await db.user.update({ where: { id: user.id }, data: { plan: "insights" } });
  redirect(safeNext(returnTo));
}

// ---------- questionnaire (account required) ----------

async function requireOwnedProject(projectId: string) {
  const user = await currentUser();
  if (!user) throw new Error((await msg()).signUpRequired);
  const project = await ownedProject(projectId);
  if (!project) throw new Error((await msg()).projectNotFound);
  return { user, project };
}

export async function saveConfidential(projectId: string, form: FormData) {
  const { project } = await requireOwnedProject(projectId);
  const text = (k: string) => String(form.get(k) ?? "").trim().slice(0, 200) || undefined;
  const conf: ConfidentialInfo = { drugName: text("drugName"), sponsorName: text("sponsorName"), protocolCode: text("protocolCode") };
  const terms = cleanTerms(form.getAll("otherTerm"));
  if (terms.length) conf.otherTerms = terms;
  const { fromUpload } = JSON.parse(project.confidential) as StoredConfidential;
  await db.project.update({ where: { id: projectId }, data: { confidential: JSON.stringify(fromUpload ? { ...conf, fromUpload } : conf) } });
  revalidatePath(`/projects/${projectId}`);
}

export interface TrialDetailsInput {
  /** null = not set (no silent default). */
  targetPatientsPerSite: number | null;
  recruitmentMonths: number | null;
  keyCriteria: { en: string; es: string }[];
  otherRequirements: { en: string; es: string }[];
  areaOther: string;
  populationOther: string;
}

/**
 * Trial details for hospitals (shown in the trial summary and asked as questions). Editable until the questionnaire is
 * sent; if a questionnaire exists, it is updated (custom questions, rewordings, removals and order are kept).
 */
export async function saveTrialDetails(projectId: string, input: TrialDetailsInput): Promise<FormState & { saved?: boolean }> {
  const { project } = await requireOwnedProject(projectId);
  const sent = await db.invitation.count({ where: { shortlistItem: { projectId } } });
  const t = await msg();
  if (sent > 0) return { error: t.trialLocked };
  const stored = parseCriteria(JSON.parse(project.criteria));
  const o = (input ?? {}) as Partial<TrialDetailsInput>;
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  if (list(o.keyCriteria).length > 8 || list(o.otherRequirements).length > 8) return { error: t.maxItems };
  const next = parseCriteria({
    ...stored,
    targetPatientsPerSite: o.targetPatientsPerSite ?? undefined,
    recruitmentMonths: o.recruitmentMonths ?? undefined,
    keyCriteria: o.keyCriteria,
    otherRequirements: o.otherRequirements,
    areaOther: o.areaOther,
    populationOther: o.populationOther,
  });
  const typed = [
    ...(next.keyCriteria ?? []).flatMap((k) => [k.en, k.es]),
    ...(next.otherRequirements ?? []).flatMap((k) => [k.en, k.es]),
    next.areaOther ?? "",
    next.populationOther ?? "",
  ];
  const leaks = findLeaks(typed, JSON.parse(project.confidential));
  if (leaks.length) return { error: t.leakDetails(leaks.join(", ")) };
  await applyCriteria(project, next);
  revalidatePath(`/projects/${projectId}`);
  return { saved: true };
}

export async function createQuestionnaire(projectId: string) {
  const { project } = await requireOwnedProject(projectId);
  const questions = generateQuestions(JSON.parse(project.criteria));
  await db.questionnaire.upsert({
    where: { projectId },
    create: { projectId, questions: JSON.stringify(questions) },
    update: {},
  });
  revalidatePath(`/projects/${projectId}`);
}

async function editableQuestionnaire(projectId: string) {
  await requireOwnedProject(projectId);
  const q = await db.questionnaire.findUnique({ where: { projectId } });
  if (!q) throw new Error((await msg()).noQuestionnaire);
  const sent = await db.invitation.count({ where: { shortlistItem: { projectId } } });
  if (sent > 0) throw new Error((await msg()).questionnaireLocked);
  return { q, questions: JSON.parse(q.questions) as Question[] };
}

export async function removeQuestion(projectId: string, questionId: string) {
  const { q, questions } = await editableQuestionnaire(projectId);
  if (questionId === "interest") throw new Error((await msg()).questionRequired);
  await db.questionnaire.update({ where: { id: q.id }, data: { questions: JSON.stringify(questions.filter((x) => x.id !== questionId)) } });
  revalidatePath(`/projects/${projectId}`);
}

function insertBeforeComments(questions: Question[], q: Question) {
  const at = questions.findIndex((x) => x.id === "comments");
  questions.splice(at === -1 ? questions.length : at, 0, q);
}

/**
 * Adds a sponsor's own question. Either picks an existing library entry (`libraryKey`), or creates a new one with
 * the reuse scope the sponsor chose: "site" (about the hospital in general - the hospital's answer may pre-fill this
 * sponsor's later questionnaires) or "trial" (specific to this trial - never reused). Default: trial.
 * Sponsor-written entries are private to their author: never suggested to other sponsors.
 */
export async function addCustomQuestion(projectId: string, _: FormState, form: FormData): Promise<FormState> {
  const { user, project } = await requireOwnedProject(projectId);
  const { q, questions } = await editableQuestionnaire(projectId);
  const libraryKey = String(form.get("libraryKey") ?? "").trim();
  if (libraryKey) return addLibraryQuestion(projectId, libraryKey);

  const t = await msg();
  const text = String(form.get("text") ?? "").trim().slice(0, 300);
  if (!text) return { error: t.writeQuestion };
  const type = form.get("type") === "yesno" ? "yesno" : form.get("type") === "number" ? "number" : "text";
  const policy: ReusePolicy = form.get("scope") === "site" ? "site" : "trial";
  const leaks = findLeaks([text], JSON.parse(project.confidential));
  if (leaks.length) return { error: t.leakQuestion(leaks.join(", ")) };
  const codes = suspiciousTerms(text);
  if (codes.length) return { error: t.codeQuestion(codes.join(", ")) };

  // same wording already in this sponsor's own library → reuse that entry instead of duplicating it
  const norm = normText(text);
  const visible = await db.libraryQuestion.findMany({ where: { createdByUserId: user.id }, take: 500, orderBy: { uses: "desc" } });
  let entry = visible.find((e) => normText(e.es) === norm && e.type === type && e.policy === policy);
  if (entry) {
    entry = await db.libraryQuestion.update({ where: { id: entry.id }, data: { uses: { increment: 1 } } });
  } else {
    entry = await db.libraryQuestion.create({
      data: { key: `lib:${newToken(9)}`, es: text, en: text, type, policy, createdByUserId: user.id },
    });
  }
  if (questions.some((x) => x.key === entry.key)) return { error: t.alreadyInQuestionnaire };
  insertBeforeComments(questions, { id: `custom_${newToken(6)}`, key: entry.key, policy, type, es: entry.es, en: entry.en, custom: true });
  await db.questionnaire.update({ where: { id: q.id }, data: { questions: JSON.stringify(questions) } });
  revalidatePath(`/projects/${projectId}`);
  return undefined;
}

/** Adds an existing library question (built-in hospital fact, or one of this sponsor's own entries) by its key. */
export async function addLibraryQuestion(projectId: string, key: string): Promise<FormState> {
  const { user } = await requireOwnedProject(projectId);
  const { q, questions } = await editableQuestionnaire(projectId);
  const t = await msg();
  if (questions.some((x) => x.key === key)) return { error: t.alreadyInQuestionnaire };
  let question: Question | null = builtinQuestion(key);
  if (question) {
    if (questions.some((x) => x.id === question!.id)) return { error: t.alreadyInQuestionnaire };
  } else {
    const entry = await db.libraryQuestion.findUnique({ where: { key } });
    if (!entry || entry.createdByUserId !== user.id) return { error: t.notInLibrary };
    await db.libraryQuestion.update({ where: { id: entry.id }, data: { uses: { increment: 1 } } });
    const type = entry.type === "yesno" || entry.type === "number" ? entry.type : "text";
    question = { id: `custom_${newToken(6)}`, key: entry.key, policy: entry.policy === "site" ? "site" : "trial", type, es: entry.es, en: entry.en, custom: true };
  }
  insertBeforeComments(questions, question);
  await db.questionnaire.update({ where: { id: q.id }, data: { questions: JSON.stringify(questions) } });
  revalidatePath(`/projects/${projectId}`);
  return undefined;
}

/**
 * Rewords a question (Spanish + English). For a reusable question (hospital fact / same condition):
 *   sameQuestion = true  → "same question, clearer wording": keeps its library key, so answers stay reusable;
 *   sameQuestion = false → it becomes a question for this trial only (new id, never reused, not scored or pre-filled).
 * Trial-only questions simply get the new wording. The kept-out list and product-code check run on the new text.
 */
export async function editQuestion(
  projectId: string,
  questionId: string,
  input: { es: string; en: string; sameQuestion: boolean },
): Promise<FormState> {
  const { project } = await requireOwnedProject(projectId);
  const { q, questions } = await editableQuestionnaire(projectId);
  const at = questions.findIndex((x) => x.id === questionId);
  const t = await msg();
  if (at === -1) return { error: t.questionNotFound };
  const cur = questions[at];
  const es = String(input?.es ?? "").trim().replace(/\s+/g, " ").slice(0, 300);
  const en = String(input?.en ?? "").trim().replace(/\s+/g, " ").slice(0, 300) || es;
  if (!es) return { error: t.writeSpanish };
  if (es === cur.es && en === cur.en) return undefined;
  const leaks = findLeaks([es, en], JSON.parse(project.confidential));
  if (leaks.length) return { error: t.leakWording(leaks.join(", ")) };
  const before = new Set(suspiciousTerms(`${cur.es} ${cur.en}`).map((t) => t.toLowerCase()));
  const codes = suspiciousTerms(`${es} ${en}`).filter((t) => !before.has(t.toLowerCase()));
  if (codes.length) return { error: t.codeWording(codes.join(", ")) };
  const { policy } = libraryMeta(cur);
  if (policy === "trial" || input?.sameQuestion) {
    questions[at] = { ...cur, es, en, edited: true };
  } else {
    const id = `custom_${newToken(6)}`;
    questions[at] = { id, key: `edit:${id}`, policy: "trial", type: cur.type, es, en, custom: true };
  }
  await db.questionnaire.update({ where: { id: q.id }, data: { questions: JSON.stringify(questions) } });
  revalidatePath(`/projects/${projectId}`);
  return undefined;
}

/** Moves a question one place up or down. The first question (interest) stays first. */
export async function moveQuestion(projectId: string, questionId: string, dir: -1 | 1) {
  const { q, questions } = await editableQuestionnaire(projectId);
  const at = questions.findIndex((x) => x.id === questionId);
  const to = at + (dir === -1 ? -1 : 1);
  if (at <= 0 || to <= 0 || to >= questions.length) return;
  [questions[at], questions[to]] = [questions[to], questions[at]];
  await db.questionnaire.update({ where: { id: q.id }, data: { questions: JSON.stringify(questions) } });
  revalidatePath(`/projects/${projectId}`);
}

export async function sendInvitation(itemId: string, _: FormState, form: FormData): Promise<FormState> {
  const item = await db.shortlistItem.findUnique({ where: { id: itemId }, include: { project: { include: { questionnaire: true } } } });
  const t = await msg();
  if (!item) return { error: t.notFound };
  const { project } = await requireOwnedProject(item.projectId);
  const qn = item.project.questionnaire;
  if (!qn) return { error: t.createQuestionnaireFirst };
  if (item.stage !== "shortlisted") return { error: t.alreadySent };

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return { error: t.invalidEmail };
  if (form.get("institutional") !== "on") return { error: t.confirmInstitutional };
  const domain = institutionalDomain(email);
  if (!domain) return { error: t.webmail };
  if (await db.suppression.findUnique({ where: { email } })) return { error: t.optedOut };

  const criteria: TrialCriteria = JSON.parse(project.criteria);
  const questions: Question[] = JSON.parse(qn.questions);
  const summary = blindedSummary(criteria, questions);
  const leaks = findLeaks(hospitalFacingTexts(criteria, questions), JSON.parse(project.confidential));
  if (leaks.length) return { error: t.leakSend(leaks.join(", ")) };

  const site = getSite(item.siteId)!;
  const prefill = await buildPrefill(questions, criteria, site.id, domain);
  const token = newToken();
  // record which listed public contact was used (matched on the server, never trusted from the form); null = typed
  const listed = findPublicContact(getHospitalContacts(site.id), email);
  await db.invitation.create({
    data: {
      token, shortlistItemId: item.id, recipientEmail: email, prefill: JSON.stringify(prefill),
      recipientContact: listed ? JSON.stringify(contactRecord(listed)) : null,
    },
  });
  await db.shortlistItem.update({ where: { id: item.id }, data: { stage: "invited" } });

  const link = `${appUrl()}/q/${token}`;
  const body = [
    `Estimado equipo de investigación de ${site.name}:`,
    "",
    `Un promotor busca centros en Madrid para un ensayo clínico y le invita a completar un breve cuestionario de viabilidad (unos 5 minutos). Algunas respuestas ya están pre-rellenadas con datos públicos o con respuestas confirmadas anteriormente por su centro, cada una con su fuente; por favor, confírmelas o corríjalas.`,
    "",
    ...summary.map((s) => `• ${s.es}`),
    "",
    `Cuestionario: ${link}`,
    "",
    "Los detalles del producto y del promotor se compartirán tras la firma de un acuerdo de confidencialidad.",
    "",
    "English version:",
    "A sponsor is looking for Madrid sites for a clinical trial and invites you to complete a short feasibility questionnaire (~5 min). Some answers are pre-filled from public data or from answers your site confirmed before, each with its source; please confirm or correct them. Product and sponsor details are shared after a confidentiality agreement.",
    "",
    VIA_LINE,
    "",
    complianceFooter(`${appUrl()}/optout/${token}`),
  ].join("\n");
  await sendEmail({ to: email, subject: `Viabilidad de ensayo clínico / Trial feasibility: ${PHASES_ES[criteria.phase]} · ${criteria.indication}`, body, kind: "invitation", projectId: project.id });
  revalidatePath(`/projects/${project.id}`);
  return undefined;
}

const VIA_LINE = "Enviado a través de Solera en nombre de un promotor / Sent via Solera on behalf of a sponsor.";

// ---------- site response (public, token-based) ----------

export async function submitResponse(token: string, _: FormState, form: FormData): Promise<FormState> {
  const inv = await db.invitation.findUnique({ where: { token }, include: { shortlistItem: { include: { project: { include: { questionnaire: true } } } } } });
  if (!inv) return { error: "This link is not valid." };
  if (inv.submittedAt) return { error: "This questionnaire has already been submitted." };
  const project = inv.shortlistItem.project;
  const questions: Question[] = JSON.parse(project.questionnaire!.questions);
  const sentPrefill = parsePrefill(inv.prefill);
  const answers: Answers = {};
  const invalid: string[] = [];
  questions.forEach((q, n) => {
    const raw = String(form.get(q.id) ?? "").trim();
    if (!raw) return;
    // confirming a public-data pre-fill (e.g. 378 recruiting trials from the registries) is never blocked by a cap
    const pre = sentPrefill.answers[q.id];
    const r = checkAnswer(q, raw, { uncapped: !!pre && pre.source.kind !== "hospital" && pre.value === raw });
    if (r.ok) answers[q.id] = r.value;
    else invalid.push(`${n + 1} (${r.es})`);
  });
  if (invalid.length) return { error: `Revise la${invalid.length > 1 ? "s preguntas" : " pregunta"} ${invalid.join("; ")}. / Please check the highlighted answers.` };
  if (!answers.interest) return { error: "Por favor, responda a la primera pregunta. / Please answer the first question." };
  const criteria: TrialCriteria = JSON.parse(project.criteria);
  const domain = institutionalDomain(inv.recipientEmail);
  const consent = form.get("reuse_consent") === "on" && !!domain;
  const memoryOps = consent
    ? await rememberAnswerOps({
        siteId: inv.shortlistItem.siteId, domain, invitationId: inv.id, questions, criteria, answers, prefill: sentPrefill,
      })
    : [];
  const match = scoreResponse(questions, answers, criteria, inv.shortlistItem.publicScore);
  const now = new Date();
  try {
    // one transaction: the response, its stage, and (only with the hospital's consent, never for trial-specific
    // questions) the hospital's answer memory. The submittedAt: null filter makes a double submit fail cleanly.
    await db.$transaction([
      db.invitation.update({
        where: { id: inv.id, submittedAt: null },
        data: {
          submittedAt: now,
          consentAt: consent ? now : null,
          answers: JSON.stringify(answers),
          responseScore: match.responseScore,
          matchScore: match.matchScore,
          matchDetail: JSON.stringify(match),
        },
      }),
      db.shortlistItem.update({ where: { id: inv.shortlistItemId }, data: { stage: "responded" } }),
      ...memoryOps,
    ]);
  } catch {
    return { error: "Este cuestionario ya se ha enviado. / This questionnaire has already been submitted." };
  }
  revalidatePath(`/q/${token}`);
  revalidatePath(`/projects/${project.id}`);
  return undefined;
}

// ---------- hospital answer memory (review & correct, token-based) ----------

/** A stored answer reachable from this invitation: same hospital AND same institutional recipient domain. */
async function rememberedFor(token: string, answerId: string) {
  const inv = await db.invitation.findUnique({ where: { token }, include: { shortlistItem: { select: { siteId: true } } } });
  if (!inv) throw new Error("Not found");
  const domain = institutionalDomain(inv.recipientEmail);
  const a = domain ? await db.siteAnswer.findUnique({ where: { id: answerId } }) : null;
  if (!a || a.siteId !== inv.shortlistItem.siteId || a.domain !== domain) throw new Error("Not found");
  return { inv, a };
}

/** The hospital corrects a stored answer: a changed value becomes a fresh confirmation (new validity). */
export async function updateRememberedAnswer(token: string, answerId: string, form: FormData) {
  const { inv, a } = await rememberedFor(token, answerId);
  let value = String(form.get("value") ?? "").trim().slice(0, 2000);
  if (!value) return;
  const rule = numberRuleForKey(a.questionKey);
  if (rule) {
    const r = checkNumber(value, rule);
    if (!r.ok) redirect(`/q/${token}/memoria?invalid=${a.id}#a-${a.id}`); // never store an invalid count
    value = r.value;
  }
  if (value === a.value) return; // unchanged: keep the original date and expiry
  const now = new Date();
  const ttl = a.expiresAt.getTime() - a.confirmedAt.getTime();
  await db.siteAnswer.update({ where: { id: a.id }, data: { value, confirmedAt: now, expiresAt: new Date(now.getTime() + ttl), sourceInvitationId: inv.id } });
  revalidatePath(`/q/${token}/memoria`);
}

/** The hospital removes a stored answer: it will be asked again next time. */
export async function forgetRememberedAnswer(token: string, answerId: string) {
  const { a } = await rememberedFor(token, answerId);
  await db.siteAnswer.delete({ where: { id: a.id } });
  revalidatePath(`/q/${token}/memoria`);
}

export async function optOut(token: string) {
  const inv = await db.invitation.findUnique({ where: { token } });
  if (!inv) return;
  await db.suppression.upsert({ where: { email: inv.recipientEmail }, create: { email: inv.recipientEmail }, update: {} });
  redirect(`/optout/${token}?done=1`);
}

// ---------- decisions ----------

export async function decide(itemId: string, decision: "approved" | "rejected") {
  const item = await db.shortlistItem.findUnique({ where: { id: itemId }, include: { invitation: true } });
  if (!item) throw new Error((await msg()).notFound);
  const { project } = await requireOwnedProject(item.projectId);
  if (item.stage !== "responded" || !item.invitation) throw new Error((await msg()).notResponded);
  await db.shortlistItem.update({ where: { id: itemId }, data: { stage: decision, decidedAt: new Date() } });

  const site = getSite(item.siteId)!;
  const criteria: TrialCriteria = JSON.parse(project.criteria);
  const summary = `${criteria.indication} (${PHASES_ES[criteria.phase]})`;
  const body =
    decision === "approved"
      ? [
          `Estimado equipo de ${site.name}:`,
          "",
          `Gracias por completar el cuestionario de viabilidad para el ensayo de ${summary}. Nos complace comunicarle que su centro ha sido preseleccionado. El promotor se pondrá en contacto para los siguientes pasos (acuerdo de confidencialidad y documentación del estudio).`,
          "",
          `Thank you for completing the feasibility questionnaire. Your site has been shortlisted; the sponsor will contact you about next steps (confidentiality agreement and study documents).`,
        ]
      : [
          `Estimado equipo de ${site.name}:`,
          "",
          `Gracias por completar el cuestionario de viabilidad para el ensayo de ${summary}. En esta ocasión el promotor no continuará con su centro para este estudio. Agradecemos su tiempo y esperamos contar con ustedes en futuros proyectos.`,
          "",
          `Thank you for completing the feasibility questionnaire. On this occasion the sponsor will not be proceeding with your site for this study. We appreciate your time.`,
        ];
  await sendEmail({
    to: item.invitation.recipientEmail,
    subject: decision === "approved" ? "Centro preseleccionado / Site shortlisted" : "Resultado de viabilidad / Feasibility outcome",
    body: [...body, "", VIA_LINE, "", complianceFooter(`${appUrl()}/optout/${item.invitation.token}`)].join("\n"),
    kind: decision === "approved" ? "decision_approved" : "decision_rejected",
    projectId: project.id,
  });
  revalidatePath(`/projects/${project.id}`);
}
