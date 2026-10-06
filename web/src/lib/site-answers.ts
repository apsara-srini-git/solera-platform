import "server-only";
// Pre-fill engine + hospital answer memory (the questionnaire flywheel).
//
// Every pre-filled answer is a FACT WITH A SOURCE that the hospital confirms - never an estimate:
//   public registries (ClinicalTrials.gov + REec), the national hospital catalogue, the AEMPS CEIm directory,
//   the ISCIII institute list, and answers the hospital itself gave in an earlier questionnaire (which win).
// Hospital memory is scoped to the recipient's institutional email domain, and only answers the hospital typed or
// corrected are stored (never unchanged public values). Sponsors only ever get redactForSponsor() views of it.
// SERMAS activity is shown only as context under the patients-per-month question, never as an answer.

import { dataset, getSite } from "./data";
import { db } from "./db";
import {
  type Prefill,
  type PrefillHint,
  type PrefillSource,
  REGISTRY_ROLES,
  SOURCE_URL,
  answerScope,
  libraryMeta,
} from "./question-library";
import { type Answers, type Question, checkAnswer } from "./questionnaire";
import { experienceBasis, indicationMatcher, siteCounts } from "./search";
import type { Site, Trial, TrialCriteria } from "./types";

const CATALOGUE_DATE = "2024-12-31"; // Catálogo Nacional de Hospitales 2025, data as of 31 Dec 2024

function registrySource(): PrefillSource {
  return { kind: "registry", label: "ClinicalTrials.gov + REec", labelEn: "ClinicalTrials.gov + REec", date: dataset().report.builtOn };
}
const CATALOGUE: PrefillSource = {
  kind: "catalogue", label: "Catálogo Nacional de Hospitales", labelEn: "Hospital catalogue", date: CATALOGUE_DATE, href: SOURCE_URL.catalogue,
};

/** SERMAS specialty names (Spanish, accent-insensitive prefix match) relevant to each therapeutic area. */
const SERMAS_SPECIALTIES: Record<string, string[]> = {
  oncology: ["oncologia medica", "oncologia"],
  hematology: ["hematologia"],
  cardiovascular: ["cardiologia"],
  neurology: ["neurologia"],
  psychiatry: ["psiquiatria"],
  infectious: ["enfermedades infecciosas", "medicina interna"],
  respiratory: ["neumologia"],
  gastro_hepatology: ["aparato digestivo", "digestivo"],
  endocrine_metabolic: ["endocrinologia"],
  immunology_rheumatology: ["reumatologia", "inmunologia"],
  dermatology: ["dermatologia"],
  nephrology_urology: ["nefrologia", "urologia"],
  womens_health: ["obstetricia", "ginecologia"],
  ophthalmology: ["oftalmologia"],
  rare_genetic: ["genetica"],
};
const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const thousandsEs = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const thousandsEn = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function activityHint(site: Site, c: TrialCriteria): PrefillHint | null {
  const act = site.activity;
  if (!act?.firstVisitsBySpecialty) return null;
  const wanted = c.population === "pediatric" ? ["pediatria"] : SERMAS_SPECIALTIES[c.area] ?? [];
  for (const w of wanted) {
    const hit = Object.entries(act.firstVisitsBySpecialty).find(([name, n]) => fold(name).startsWith(w) && n > 0);
    if (hit) {
      const [name, n] = hit;
      return {
        es: `Dato público: ${thousandsEs(n)} primeras consultas de ${name} (${act.year})`,
        en: `Public data: ${thousandsEn(n)} first outpatient visits in ${name} (${act.year})`,
        source: { kind: "sermas", label: "Datos abiertos SERMAS", labelEn: "SERMAS open data", date: `${act.year}-12-31`, href: act.source || SOURCE_URL.sermas },
      };
    }
  }
  return null;
}

interface PublicContext {
  matches: (t: Trial) => boolean;
}

function publicContext(c: TrialCriteria): PublicContext {
  return { matches: indicationMatcher(c.indication) };
}

type RegistryRole = (typeof REGISTRY_ROLES)[number];

/** The registry records behind each registry pre-fill, from the same sets the search score counts (search.ts
 *  siteCounts): trials in the condition, the ones recruiting now, and the phase / paediatric subsets. */
function registryLists(site: Site, c: TrialCriteria, matches: (t: Trial) => boolean): Record<RegistryRole, Trial[]> {
  const k = siteCounts(site, dataset().trialsBySite.get(site.id) ?? [], c, matches);
  return { experience: k.indication, competing: k.competing, phaseExperience: k.phase, pediatric: k.pediatric };
}

/** Pre-fill from public data only (no stored hospital answers). */
function publicPrefill(questions: Question[], c: TrialCriteria, site: Site, ctx: PublicContext): Prefill {
  const p: Prefill = { v: 2, answers: {}, hints: {}, records: {} };
  const hasTrials = (dataset().trialsBySite.get(site.id) ?? []).length > 0;
  // phase experience covers combined designs: a Phase II/III trial counts phase II or phase III experience
  const lists = registryLists(site, c, ctx.matches);
  const reg = registrySource();

  for (const q of questions) {
    const set = (value: string, source: PrefillSource) => (p.answers[q.id] = { value, source });
    // registry answers keep the ids they were counted from, so the hospital's record list matches the sent value
    const setRegistry = (value: string, role: RegistryRole) => {
      set(value, reg);
      p.records![q.id] = lists[role].map((t) => t.id);
    };
    switch (q.role) {
      case "experience":
        if (hasTrials) setRegistry(String(lists.experience.length), "experience");
        break;
      case "phaseExperience":
        if (lists.phaseExperience.length > 0) setRegistry("yes", "phaseExperience");
        break;
      case "competing":
        if (hasTrials) setRegistry(String(lists.competing.length), "competing");
        break;
      case "pediatric":
        if (lists.pediatric.length > 0) setRegistry("yes", "pediatric");
        break;
      case "equipment":
        if (q.equipmentKey && (site.equipment[q.equipmentKey] ?? 0) > 0) set("yes", CATALOGUE);
        break;
      case "ethics": {
        const ce = site.ceim;
        if (!ce?.name) break;
        // only an assignment the AEMPS directory states is a fact: its own committee ("own"), or a committee shared by a
        // hospital complex ("complex"); legacy records without a basis only when they list the hospital's own committee.
        const stated = ce.basis === "own" || ce.basis === "complex" || (!ce.basis && ce.ownCommittee);
        if (stated) {
          set(ce.ownCommittee ? `Sí: ${ce.name}` : `No, el centro está adscrito a: ${ce.name}`, {
            kind: "ceim", label: "Directorio CEIm (AEMPS)", labelEn: "AEMPS CEIm directory",
            date: ce.slots?.checkedOn ?? undefined, href: ce.source || SOURCE_URL.ceim,
          });
        } else {
          // "default" = INFERRED (no committee of its own in the directory → probably the regional CEIm): context to
          // check, never an answer
          p.hints[q.id] = {
            es: `No confirmado: el centro no figura con CEIm propio en el directorio de la AEMPS; podría estar adscrito a ${ce.name}.`,
            en: `Not confirmed: the hospital has no committee of its own in the AEMPS directory; it may be served by ${ce.name}.`,
            source: { kind: "ceim", label: "Directorio CEIm (AEMPS) · no confirmado", labelEn: "AEMPS CEIm directory · not confirmed" },
          };
        }
        break;
      }
      case "institute": {
        const ru = site.researchUnit;
        if (ru?.institute) {
          set(`Sí: ${ru.institute}${ru.accreditedIIS ? " (IIS acreditado por el ISCIII)" : ""}`, {
            kind: "isciii", label: "Listado ISCIII de IIS", labelEn: "ISCIII institute list",
            date: ru.verifiedOn ?? undefined, href: SOURCE_URL.isciii,
          });
        }
        break;
      }
      case "eligiblePerMonth": {
        const h = activityHint(site, c);
        if (h) p.hints[q.id] = h;
        break;
      }
    }
  }
  return p;
}

const HOSPITAL = (date: Date): PrefillSource => ({
  kind: "hospital", label: "Confirmado por el hospital", labelEn: "Confirmed by hospital", date: date.toISOString().slice(0, 10),
});

/**
 * Pre-fill for several hospitals at once (one DB query, one set of search reference values).
 * Hospital answers (latest unexpired, same key and scope, valid for the question) override public data, but only those
 * stored for `domain`: the recipient's institutional email domain. null (webmail / unknown) = public data only -
 * which is also what the sponsor's pre-send preview uses: the recipient domain is not known before sending, and
 * counting stored answers there would reveal that a hospital answered Solera before.
 */
export async function buildPrefills(
  questions: Question[],
  c: TrialCriteria,
  siteIds: string[],
  domain: string | null,
): Promise<Map<string, Prefill>> {
  const out = new Map<string, Prefill>();
  if (!siteIds.length || !questions.length) return out;
  const ctx = publicContext(c);
  const metas = questions.map((q) => ({ q, ...libraryMeta(q), scope: answerScope(q, c) }));
  const reusable = metas.filter((m) => m.policy !== "trial");
  const now = new Date();
  const stored = reusable.length && domain
    ? await db.siteAnswer.findMany({
        where: {
          siteId: { in: siteIds },
          domain,
          questionKey: { in: [...new Set(reusable.map((m) => m.key))] },
          expiresAt: { gt: now },
        },
        orderBy: { confirmedAt: "desc" },
      })
    : [];
  for (const siteId of siteIds) {
    const site = getSite(siteId);
    if (!site) continue;
    const p = publicPrefill(questions, c, site, ctx);
    for (const m of reusable) {
      const hit = stored.find((s) => s.siteId === siteId && s.questionKey === m.key && s.scope === m.scope);
      // per-question freshness (e.g. competing trials: 90 days) on top of the stored expiry; never reuse a stored value
      // that fails today's validation (e.g. "7.256" patients per month)
      if (!hit || now.getTime() - hit.confirmedAt.getTime() > m.maxAgeDays * 86400_000) continue;
      const v = checkAnswer(m.q, hit.value);
      if (v.ok && v.value) {
        p.answers[m.q.id] = { value: v.value, source: HOSPITAL(hit.confirmedAt) };
        delete p.records?.[m.q.id];
      }
    }
    out.set(siteId, p);
  }
  return out;
}

export async function buildPrefill(questions: Question[], c: TrialCriteria, siteId: string, domain: string | null): Promise<Prefill> {
  return (await buildPrefills(questions, c, [siteId], domain)).get(siteId) ?? { v: 2, answers: {}, hints: {}, records: {} };
}

/**
 * Upserts of the hospital's own answers for reuse (run them in the caller's transaction). Call only after the hospital
 * ticked the consent notice, with already-validated answers. Stored only when ALL of:
 *   - the recipient domain is institutional (never webmail),
 *   - the question's policy is "site" or "indication" (trial-specific answers never are),
 *   - the hospital provided the value: a question without public data, or a public pre-fill it changed - unchanged
 *     registry / catalogue / CEIm / ISCIII values are never stored as hospital facts,
 *   - the value differs from what is already stored (an unchanged stored answer keeps its date and expiry).
 */
export async function rememberAnswerOps(opts: {
  siteId: string;
  domain: string | null;
  invitationId: string;
  questions: Question[];
  criteria: TrialCriteria;
  answers: Answers;
  /** The pre-fill the hospital received (Invitation.prefill). */
  prefill: Prefill;
}) {
  if (!opts.domain) return [];
  const domain = opts.domain;
  const now = new Date();
  const metas = opts.questions
    .map((q) => ({ q, ...libraryMeta(q), scope: answerScope(q, opts.criteria), value: (opts.answers[q.id] ?? "").trim() }))
    .filter((m) => m.value && m.policy !== "trial");
  const existing = metas.length
    ? await db.siteAnswer.findMany({ where: { siteId: opts.siteId, domain, questionKey: { in: metas.map((m) => m.key) }, expiresAt: { gt: now } } })
    : [];
  const ops = [];
  for (const m of metas) {
    const pre = opts.prefill.answers[m.q.id];
    if (pre && pre.value === m.value) continue; // confirmed as pre-filled: public data, or the hospital's own stored answer
    if (existing.some((e) => e.questionKey === m.key && e.scope === m.scope && e.value === m.value)) continue;
    const data = {
      value: m.value.slice(0, 2000),
      questionEs: m.q.es.slice(0, 500),
      sourceInvitationId: opts.invitationId,
      confirmedAt: now,
      expiresAt: new Date(now.getTime() + m.maxAgeDays * 86400_000),
    };
    ops.push(
      db.siteAnswer.upsert({
        where: { siteId_domain_questionKey_scope: { siteId: opts.siteId, domain, questionKey: m.key, scope: m.scope } },
        create: { siteId: opts.siteId, domain, questionKey: m.key, scope: m.scope, ...data },
        update: data,
      }),
    );
  }
  return ops;
}

/** The hospital's stored answers (unexpired) for one institutional domain, for its review page. */
export async function rememberedAnswers(siteId: string, domain: string | null) {
  if (!domain) return [];
  return db.siteAnswer.findMany({ where: { siteId, domain, expiresAt: { gt: new Date() } }, orderBy: [{ scope: "asc" }, { questionEs: "asc" }] });
}

// ---------- registry records behind a pre-filled count ----------

export interface RegistryRecords {
  role: RegistryRole;
  /** What the list is, in Spanish and English. */
  es: string;
  en: string;
  trials: Trial[];
  /** Date of the registry data the list comes from. */
  builtOn: string;
  /** Records in the list as sent that are no longer in the current registry data (shown by id only). */
  missing: string[];
  /** Shown above the list when it may not match the pre-filled answer the hospital received. */
  note?: { es: string; en: string };
}

const fmtDateEs = (d: string) => {
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};
const fmtDateEn = (d: string) => {
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

/**
 * The registry records a pre-filled answer was counted from, at one hospital (the sets search.ts siteCounts scores).
 * `sent`: the pre-fill the hospital received (Invitation.prefill). Its saved record ids win, so the list matches the
 * number the hospital is asked to confirm even after a data refresh. Invitations sent before ids were saved get the
 * current list with a note giving the number that was sent. Without `sent` (sponsor preview) the list is current.
 */
export function registryRecords(q: Pick<Question, "id" | "role">, c: TrialCriteria, siteId: string, sent?: Prefill): RegistryRecords | null {
  const role = q.role as RegistryRole;
  if (!REGISTRY_ROLES.includes(role)) return null;
  const site = getSite(siteId);
  if (!site) return null;
  const { matches } = publicContext(c);
  const basis = experienceBasis(c, matches);
  const scopeEs = basis === "condition" ? `en ${c.indication}` : basis === "area" ? "en el área terapéutica" : "entre todos los ensayos registrados";
  const scopeEn = basis === "condition" ? `in ${c.indication}` : basis === "area" ? "in the therapeutic area" : "among all registered trials";
  const label = {
    experience: { es: `Ensayos registrados en ${c.indication}`, en: `Registered trials in ${c.indication}` },
    competing: { es: `Ensayos en ${c.indication} reclutando ahora en el centro`, en: `Trials in ${c.indication} recruiting at the hospital now` },
    phaseExperience: { es: `Ensayos de la misma fase ${scopeEs}`, en: `Trials of the same phase ${scopeEn}` },
    pediatric: { es: `Ensayos con pacientes pediátricos ${scopeEs}`, en: `Trials enrolling children ${scopeEn}` },
  }[role];
  const sorted = (l: Trial[]) => [...l].sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0) || a.title.localeCompare(b.title));
  const builtOn = dataset().report.builtOn;
  const sentAnswer = sent?.answers[q.id];
  const sentIds = sent?.records?.[q.id];

  if (sentIds && sentAnswer?.source.kind === "registry") {
    const byId = new Map(dataset().trials.map((t) => [t.id, t]));
    const found = sentIds.map((id) => byId.get(id)).filter((t): t is Trial => !!t);
    return {
      role, ...label, trials: sorted(found), builtOn: sentAnswer.source.date ?? builtOn,
      missing: sentIds.filter((id) => !byId.has(id)),
    };
  }

  const trials = sorted(registryLists(site, c, matches)[role]);
  let note: RegistryRecords["note"];
  if (sentAnswer?.source.kind === "registry") {
    const counted = role === "experience" || role === "competing";
    const sentOn = sentAnswer.source.date;
    if (counted && sentAnswer.value !== String(trials.length)) {
      note = {
        es: `Lista actualizada el ${fmtDateEs(builtOn)}; el número enviado era ${sentAnswer.value}.`,
        en: `List updated on ${fmtDateEn(builtOn)}; the number sent was ${sentAnswer.value}.`,
      };
    } else if (sentOn && sentOn !== builtOn) {
      note = {
        es: `Lista actualizada el ${fmtDateEs(builtOn)}; la respuesta pre-rellenada se basó en los datos del ${fmtDateEs(sentOn)}.`,
        en: `List updated on ${fmtDateEn(builtOn)}; the pre-filled answer used data from ${fmtDateEn(sentOn)}.`,
      };
    }
  }
  return { role, ...label, trials, builtOn, missing: [], note };
}
