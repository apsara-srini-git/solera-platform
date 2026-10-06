import "server-only";
import { dataset } from "./data";
import { patientDataset } from "./patients/data";
import { buildVocabulary, type Vocabulary } from "./spelling";

// The condition vocabulary behind "Did you mean…?", built once from our own data and cached until the sponsor
// dataset reloads (lib/data.ts swaps its trial list when trials.json changes on disk).

let cache: { trials: unknown; vocab: Vocabulary } | null = null;

export function conditionVocabulary(): Vocabulary {
  const { trials } = dataset();
  if (cache?.trials === trials) return cache.vocab;
  let patient: ReturnType<typeof patientDataset> | null = null;
  try {
    patient = patientDataset();
  } catch {
    // the patient dataset is optional here: Spanish public indications are a bonus, not a requirement
  }
  const vocab = buildVocabulary({
    trials: patient ? [...trials, ...patient.trials] : trials,
    indications: patient?.trials.map((t) => ({ es: t.publicIndication?.es, en: t.publicIndication?.en })) ?? [],
  });
  cache = { trials, vocab };
  return vocab;
}
