# Solera — clinical trial site feasibility for Madrid

First version (MVP) of Workflow 1: (optional protocol upload →) search → shortlist → sign up → blinded questionnaire → send → site responds → suggested matches → approve / reject.

```
pipeline/            Python data pipeline (public data → web/data/*.json)
  build_data.py      builds the dataset: hospital catalogue + ClinicalTrials.gov + REec, de-duplicated
  reec.py            REec (AEMPS) download + normalisation; strips personal data before writing to disk
  ctis_link.py       CTIS lookups linking transitioned EU CT ↔ EudraCT numbers (prevents double counting)
  geo.py / images.py / sermas.py / ceim.py   per-hospital enrichments: map point, Commons photo, SERMAS activity, CEIm
  research_units.json  hospital → research institute (ISCIII accredited IIS list); feasibility mailboxes to verify
  hospital_contacts.json  curated public research contacts per hospital (role mailboxes + source page); copied to web/data
  raw/               cached source files
web/                 Next.js 16 app (TypeScript, Tailwind, Prisma + SQLite)
  data/              built dataset: sites.json, trials.json, build_report.json, patient_trials.json
                     + hospital_contacts.json (copy of pipeline/hospital_contacts.json, read by src/lib/contacts.ts)
  src/lib/           search scoring, questionnaire engine, auth, email; src/lib/patients/ = patient portal data/search/i18n/education
  src/app/layout.tsx bare document shell (html/body, fonts)
  src/app/(site)/    sponsor + hospital app with its header/footer (actions.ts holds all workflow logic)
  src/app/pacientes/ public patient portal (Spanish-first, own layout; no accounts, forms or tracking)
```

## Patient portal (/pacientes)

Free, public trial discovery for patients: open trials (recruiting / not yet recruiting) at Madrid hospitals, List / Map /
Split views, trial and hospital pages, plain-language education ("Aprende") and an About page. It is deliberately a
neutral view of public registry data: trial text is shown verbatim with its registry, ID and fetch date; no ranking or
paid placement ("El orden no es una recomendación"); no forms, eligibility quizzes, accounts, saved searches or analytics;
the next step is always "talk to your doctor" and the registry's official contact details. Banned promotional wording is
checked by `findBannedTerms` (src/lib/patients/wording.ts). Rebuild its data with `python3 pipeline/patient_trials.py`
(`--refresh` re-downloads ClinicalTrials.gov detail). Trial-specific sponsor FAQs (Workflow 2) are not built; see memo.
Open TODOs: legal entity + contact on the About page; hosting logs must not keep query strings; hospital photos on cards
only once photos are self-hosted (Wikimedia hot-linking would send visitor IPs to the US).

## Run it

```bash
cd web
npm install
npx prisma migrate dev      # creates prisma/dev.db
npm run dev                 # http://localhost:3000
```

Emails are not delivered by default — they're logged at **/dev/outbox** (with the questionnaire links), so you can play
both the sponsor and the hospital. Set `RESEND_API_KEY` and `EMAIL_FROM` in `web/.env` to deliver for real.

Reset local data: `npx prisma migrate reset`.
Refresh public data: `python3 pipeline/build_data.py --refresh` (needs `pip install openpyxl`). The server picks up the
rebuilt `web/data/*.json` on the next request (the in-memory cache is keyed on the files' mtime), no restart needed.
A first full build downloads ~9,000 REec trial records and ~3,000 CTIS lookups (about 2 hours, throttled to be polite to
the public servers); everything is cached under `pipeline/raw/`, so later builds take seconds.

**Protocol upload** needs an Anthropic API key: set `ANTHROPIC_API_KEY` in `web/.env`. Without it the upload returns
"not configured" and the rest of the app works normally. Uses `claude-opus-5-5` with structured output; documents are
processed in memory and stored (under `web/storage/`, git-ignored) only when the user ticks "keep".

## Data

| Source | What we use | Coverage |
|---|---|---|
| Catálogo Nacional de Hospitales 2025 (Ministerio de Sanidad) | Every Madrid hospital: beds, public/private, class, high-tech equipment (CT, MRI, PET, linac, dialysis…) | 91 hospitals |
| ClinicalTrials.gov API v2 | Interventional trials with a Madrid site: condition + MeSH terms, phase, status, dates, sponsor, per-site recruiting status | ~11,200 studies with a Madrid site (11,063 unique trials after merging with REec, 70 hospitals) |
| REec (AEMPS) REST service | Official Spanish site list for every medicines trial authorised in Spain since 2017, incl. trials missing from CT.gov; per-site active/closed status | ~9,000 trials with a Madrid site |
| CTIS (EMA) public API | Only to link transitioned trials' new EU CT numbers to their old EudraCT numbers | lookups cached |
| ISCIII accredited IIS list | Hospital → research institute | 8 Madrid institutes, 24 hospitals mapped |
| Comunidad de Madrid open data: [centros, servicios y establecimientos sanitarios](https://datos.comunidad.madrid/catalogo/dataset/centros_servicios_establecimientos_sanitarios) (+ OpenStreetMap Nominatim cross-check) | Map coordinates (UTM ETRS89 30N → WGS84), joined by address; points > 1.5 km from the OSM geocode — and every OSM-fallback point — must agree with the OSM hospital-name geocode or be checked by hand, otherwise the build stops (`pipeline/geo.py`) | 91/91 hospitals (81 by address join, 6 hand-matched register entries, 1 hand-fixed, 1 OSM address fallback checked against the OSM hospital-name geocode, 2 moved to their own OSM address point because they shared a register point with a neighbour); 82 cross-checked against an independent OSM geocode |
| Wikidata → Wikimedia Commons | Hospital photo (P18 of the hospital's own Wikidata item, verified by type, name and ≤ 1.5 km distance); CC0 / CC BY / CC BY-SA / public domain only, author + licence shown, URLs point at Commons; photos that don't show the hospital well are rejected by hand (`REJECTED_PHOTOS`) and fall back to the placeholder (`pipeline/images.py`) | 31/91 hospitals (3 rejected by hand: Puerta de Hierro, Infanta Leonor, Gregorio Marañón) |
| SERMAS hospital annual reports, open data ([index](https://www.comunidad.madrid/servicios/salud/memorias-e-informes-servicio-madrileno-salud)) | Outpatient first / total visits per specialty, discharges, industry-funded research projects (new / active), latest year with per-hospital files (`pipeline/sermas.py`) | 34 SERMAS-network hospitals, year 2024 (30 with per-specialty visits, 34 with discharges, 23 with industry-funded projects); private hospitals → null |
| AEMPS directory of accredited CEIm (`reec.aemps.es/reec-services`: `ceimbyccaa?ccaa=13`, `ceimstrabajactis`, `ceimsevaluacionrapida`) | Hospital's ethics committee (own, hospital-complex, or CEIm Regional by default), CTIS evaluator, fast track, this month's CTIS slots, committee mailbox (`pipeline/ceim.py`) | 28/91 sourced (25 own committee, 3 via their hospital complex; `ceim.basis` = `own` / `complex`, `source` = AEMPS URL). The other 63 get the CEIm Regional as an **inferred default** (`basis: "default"`, no source, no mailbox): the directory doesn't say which hospitals it serves, so the UI shows it as "not confirmed" |
| Hospital, research-institute and research-foundation websites (`pipeline/hospital_contacts.json`) | Public role mailboxes a sponsor can send a questionnaire to: kind (clinical trials unit, research foundation, research institute, research office, ethics committee secretariat, hospital general contact), what each is for (ES/EN), phone, confidence, source page + verbatim quote, date checked | 91/91 hospitals checked on 6 Oct 2026; 75 with at least one contact, 16 with none found (130 contact rows) |

**Public research contacts** (`pipeline/hospital_contacts.json`) are curated by hand / research agents, not built by
`build_data.py`: each address was seen on an official page (`sourceUrl`, `sourceTitle`, `evidenceQuote`, `checkedOn`)
and the file is re-checked periodically. It contains **only role mailboxes** (units, foundations, secretariats) — no
named people or personal addresses (`npm test` checks every address against a personal-name heuristic and the
institutional-domain rule). One webmail address published by a hospital is kept on file for completeness but is never
offered as a recipient. After editing it, copy it to `web/data/hospital_contacts.json` (the app re-reads it on change).
In the send step the sponsor chooses one of these contacts (the best one is highlighted, never pre-selected) or types
another institutional address; the invitation records which listed contact was used (`Invitation.recipientContact`).

Hospital names: `name` is a display name (accents and proper names restored from a hand-kept override map in
`build_data.py`, legal suffixes like "S.L." removed); `catalogueName` keeps the catalogue spelling. All matching
normalises accents and case, so display names never change a match.

Sources: every `source` field in `web/data` is a plain URL (or empty when nothing states the fact); explanatory prose
lives in a separate `note` field.

Site-name matching: alias rules map registry site names to catalogue hospitals; primary-care centres and nursing homes
are excluded. Trials are de-duplicated across registries by NCT / EudraCT / EU CT number, CTIS links, and a conservative
title match (audit list in `web/data/build_report.json` → `mergedByTitle`).

**Personal data:** investigator names, contact persons, emails and phones are dropped at download time (REec) and never
requested (CT.gov). Investigator-sponsored trials show "Investigator-initiated" instead of a person's name.
The CEIm directory names each committee's responsible person: that field is dropped before the response is cached, and
only committee mailboxes (e.g. `ceic.hulp@salud.madrid.org`) are kept — anything that looks personal becomes null. The
SERMAS research sheets list projects and investigators; only the aggregate counts are read.

**Explicit exception — photo attribution.** `site.image.author` stores the photographer's name (or Commons username)
exactly as the Commons file page gives it. CC BY / CC BY-SA licences require crediting the author wherever the photo is
shown, so this is the one personal name we keep, by decision. It is public attribution, used only next to the photo,
never for contact or profiling; the build guard allows only the known attribution fields under `image` and stops if an
author string carries an email address or phone number. Removing the photo (adding it to `REJECTED_PHOTOS`) removes the
name too.

## Known limits / next

- Payments are mocked (`unlockInsights` flips the plan) — replace with Stripe Checkout + webhook.
- Questionnaire is rule-based (no LLM yet); scoring weights are first guesses to calibrate with real responses.
- Public contacts come from official pages but most are contracts or general research mailboxes, not dedicated
  feasibility inboxes; confirm the right route with the research foundations and update `hospital_contacts.json`.
- Anonymous projects (and kept protocol documents) stay in the DB after the browser session ends; add a retention job.
- Protocol upload: abuse limits are per browser, per IP (needs a trusted proxy setting `x-forwarded-for`) and a global
  anonymous daily cap; set `IP_HASH_SALT` in production.
- SQLite → Postgres (EU region) before deployment.
- Workflow 2 (patient FAQ drafts for CEIm submission).
