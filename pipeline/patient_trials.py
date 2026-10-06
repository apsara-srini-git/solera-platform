"""
Patient portal dataset — open Madrid trials, registry text only.

Builds web/data/patient_trials.json for the public patient portal (/pacientes). It is a NEUTRAL view of public registry
records: every text field is copied verbatim from REec (AEMPS) or ClinicalTrials.gov, cleaned of HTML / markup only,
and carries the registry + record id it came from. Nothing trial-specific is generated or paraphrased here.

Inputs (all produced or cached by build_data.py / reec.py, read-only here):
  web/data/trials.json, web/data/sites.json          merged trial ↔ Madrid hospital dataset (ids and siteIds reused)
  pipeline/raw/reec/status.json                       REec trial status (estado) — refreshed by build_data --refresh
  pipeline/raw/reec/detalle/{id}.json                 REec detail: public title / indication / criteria (es + en)
  pipeline/raw/ctgov_madrid.json                      ClinicalTrials.gov Madrid studies (titles, statuses)
Fetched here (only for the open trials we output, cached in pipeline/raw/ctgov_patient/{NCT}.json):
  ClinicalTrials.gov API v2: brief summary, eligibility criteria, ages, sex, healthy volunteers, last update posted.
  REec public page (cached in pipeline/raw/reec/modif/{id}.json): the record's "Última actualización" date.

Which trials: overall status RECRUITING or NOT_YET_RECRUITING (CT.gov) / REec estado 2 or 1, with ≥1 Madrid hospital
whose own status is not closed. A merged CT.gov + REec trial is dropped when REec says recruitment in Spain has ended
(estado 3 / 4 / 5) or has a Spain end / early-termination date, because the portal is for patients in Madrid.

REec per-site `situacion`: the public REec centre list shows a legend NO INICIADO / ACTIVO / CERRADO, and each centre
block's CSS class (b-centro_no_iniciado / b-centro_activo / b-centro_cerrado) lines up with situacion 0 / 1 / 2. So for
each Madrid hospital of the primary REec record: 0 -> "not_yet", 1 -> "recruiting", 2 -> closed (dropped). This is read
here from pipeline/raw/reec/detalle/{id}.json (reec.SITE_STATUS, used by the sponsor app, is left unchanged). An
explicit ClinicalTrials.gov site status (RECRUITING / NOT_YET_RECRUITING) wins over REec; a site with no status in
either registry is "not_yet" when the primary REec record says the trial has not started in Spain (estado 1), else
"unknown".

Last registry update: ClinicalTrials.gov "Last Update Posted", and REec's own "Última actualización" (the date shown as
#detailFechaModif on reec.aemps.es/reec/estudio/{id}). The REST service does not expose it, so it is read from the
public page's detail call (reec/detalle/getDetailIdentifiacionByIdEstudio, field 21) and cached, date only, in
pipeline/raw/reec/modif/{id}.json. When it is missing, REec's latest calendar date is the fallback (a lower bound).

Personal data: no contact / investigator fields are read. Free text is scrubbed again for emails and phone numbers,
"Dr./Dra./Prof. Surname" mentions are masked, and sponsor names go through reec.is_person_sponsor.

Usage:
  python3 pipeline/patient_trials.py            # uses cached ClinicalTrials.gov detail where present
  python3 pipeline/patient_trials.py --refresh  # re-downloads ClinicalTrials.gov detail and REec update dates
Run with --refresh before publishing: ClinicalTrials.gov's terms ask reusers to keep the data current.
"""

import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

import build_data
import ctis_link
import reec

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "pipeline" / "raw"
DATA = ROOT / "web" / "data"
REEC_DIR = RAW / "reec"
CT_FILE = RAW / "ctgov_madrid.json"
CT_CACHE = RAW / "ctgov_patient"
REEC_MODIF = REEC_DIR / "modif"
REEC_WEB = "https://reec.aemps.es/reec"
OUT = DATA / "patient_trials.json"

OPEN = {"RECRUITING", "NOT_YET_RECRUITING"}
REEC_OPEN = {"1": "NOT_YET_RECRUITING", "2": "RECRUITING"}
REEC_CLOSED = {"3", "4", "5"}
STALE_DAYS = 730

CT_API = "https://clinicaltrials.gov/api/v2/studies"
CT_PATIENT_FIELDS = ",".join([
    "NCTId", "OverallStatus", "BriefSummary", "EligibilityCriteria", "MinimumAge", "MaximumAge", "Sex",
    "HealthyVolunteers", "StdAge", "LastUpdatePostDate", "StatusVerifiedDate",
])
BATCH = 50

# ---------------------------------------------------------------- text cleaning (format only, never wording)

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# phone candidates: international prefix, or a Spanish 9-digit number (starts 6/7/8/9) written in groups
PHONE = re.compile(r"(?<![\w-])(?:(?:\+|00)\d{2,3}[\s.-]?)?\(?[6789]\d{1,2}\)?(?:[\s.]?\d{2,3}){3}(?![\w-])"
                   r"|(?<![\w-])(?:\+|00)\d{1,3}[\s.-]?\d[\d\s.-]{7,14}\d(?![\w-])")
_NAME = r"[A-ZÁÉÍÓÚÑ][a-záéíóúñü'-]+"
# "Dr. Ana M. García López", "Prof. J. Smith" — title + up to four capitalised words / initials
PERSON_MENTION = re.compile(r"\b(?:Dr|Dra|Prof|Profa)\.?\s+(?:[A-ZÁÉÍÓÚÑ]\.\s*)*" + _NAME
                            + r"(?:\s+(?:[A-ZÁÉÍÓÚÑ]\.|(?:de|del|la|y)\s+" + _NAME + "|" + _NAME + ")){0,4}")
TAG = re.compile(r"</?[A-Za-z][A-Za-z0-9]*(?:\s[^<>]*)?/?>")
BREAK = re.compile(r"<\s*(?:br|/p|/li|/div|/tr|/h\d)\s*/?\s*>", re.I)
LI = re.compile(r"<\s*li[^>]*>", re.I)

# a name right after a contact / investigator label: "Lead Coordinator: Ana García", "Investigador principal: …"
LABELLED_NAME = re.compile(r"(?i:\b(?:coordinator|contact(?: person)?|principal investigator|investigador(?:a)?(?: principal)?|"
                           r"study chair|responsable)\s*:\s*)(?:(?:Dr|Dra|Prof)\.?\s+)?" + _NAME
                           + r"(?:\s+(?:[A-ZÁÉÍÓÚÑ]\.|(?:de|del|la|y)\s+" + _NAME + "|" + _NAME + ")){1,4}")
ORG_WORD = re.compile(r"therapeutics|pharma|hospital|inc\b|ltd|gmbh|s\.?a\.?\b|s\.?l\.?\b|foundation|fundaci|university|"
                      r"universidad|institut|group|grupo|patient|enquir|team|equipo|department|servicio", re.I)

scrub_counts: Counter = Counter()


def _digits(s: str) -> int:
    return sum(ch.isdigit() for ch in s)


def scrub(text: str) -> str:
    def phone(m):
        s = m.group(0)
        n = _digits(s)
        if n == 9 or (s.lstrip().startswith(("+", "00")) and 10 <= n <= 15):
            scrub_counts["phone"] += 1
            return "[teléfono eliminado]"
        return s

    def email(m):
        scrub_counts["email"] += 1
        return "[email eliminado]"

    def person(m):
        scrub_counts["person_mention"] += 1
        return "[nombre eliminado]"

    def labelled(m):
        s = m.group(0)
        head, name = s.split(":", 1)
        if ORG_WORD.search(name):
            return s
        scrub_counts["person_mention"] += 1
        return head + ": [nombre eliminado]"

    text = EMAIL.sub(email, text)
    text = LABELLED_NAME.sub(labelled, text)
    text = PHONE.sub(phone, text)
    return PERSON_MENTION.sub(person, text)


def clean(s) -> str | None:
    """HTML → plain text. Keeps line breaks (lists), collapses other whitespace, unescapes entities and the
    backslash escapes ClinicalTrials.gov's markdown uses (\\>=, \\*). Wording is never changed."""
    if not s or not isinstance(s, str):
        return None
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = BREAK.sub("\n", s)
    s = LI.sub("\n• ", s)
    s = TAG.sub(" ", s)
    s = html.unescape(html.unescape(s))
    s = re.sub(r"\\([<>=*_#~\[\]()^.+-])", r"\1", s)
    s = s.replace("\u00a0", " ")
    lines = [re.sub(r"[ \t\f\v]+", " ", ln).strip() for ln in s.split("\n")]
    out, blank = [], False
    for ln in lines:
        if not ln:
            blank = bool(out)
            continue
        if blank:
            out.append("")
        out.append(ln)
        blank = False
    text = "\n".join(out).strip()
    return scrub(text) if text else None


ES_WORDS = {"de", "la", "el", "en", "los", "las", "del", "con", "para", "por", "que", "una", "un", "y", "estudio",
            "pacientes", "ensayo", "fase", "tratamiento", "evaluar", "eficacia", "seguridad", "se", "al", "o",
            "tipo", "enfermedad", "cronica", "aguda", "avanzado", "avanzada", "metastasico", "metastasica", "celulas",
            "pulmon", "mama", "insuficiencia", "sindrome", "infeccion", "trastorno", "grave", "leve", "moderada",
            "moderado", "adultos", "ninos", "voluntarios", "sanos", "recidivante", "refractario", "refractaria"}
EN_WORDS = {"the", "of", "and", "in", "with", "for", "to", "a", "an", "study", "patients", "trial", "phase",
            "treatment", "evaluate", "efficacy", "safety", "or", "who", "participants", "is", "are"}


def lang_of(text: str | None) -> str | None:
    """'es' / 'en' / None — REec sometimes fills its Spanish fields with English text (or vice versa)."""
    if not text:
        return None
    words = re.findall(r"[a-záéíóúñü]+", text.lower())
    es = sum(w in ES_WORDS for w in words) + 2 * sum(ch in "áéíóúñ¿¡" for ch in text.lower()) / 3
    en = sum(w in EN_WORDS for w in words)
    if es == en:
        return None
    return "es" if es > en else "en"


def looks_spanish(text: str) -> bool:
    """True when a text has a Spanish marker: an accented letter / ¿¡, or a Spanish word (lang_of says es)."""
    if re.search(r"[áéíóúñ¿¡]", text.lower()):
        return True
    words = set(re.findall(r"[a-z]+", text.lower()))
    return lang_of(text) == "es" or bool(words & (ES_WORDS - EN_WORDS - {"a", "o", "se", "al", "un", "en"}))


def bilingual(candidates_es, candidates_en):
    """Pick the first non-empty Spanish and English text from (text, source) candidates. A candidate whose language is
    clearly the other one (REec sometimes files English text in its Spanish fields) is only used as a fallback for that
    other language. Returns ({es?, en?}, {es?: src, en?: src})."""
    proper = {"es": [], "en": []}
    misfiled = {"es": [], "en": []}
    for want, cands in (("es", candidates_es), ("en", candidates_en)):
        for text, s in cands:
            if not text:
                continue
            lang = lang_of(text)
            if lang and lang != want:
                misfiled[lang].append((text, s))
            else:
                proper[want].append((text, s))
    out, src = {}, {}
    for lang in ("es", "en"):
        pick = (proper[lang] or misfiled[lang] or [None])[0]
        if pick:
            out[lang], src[lang] = pick
    # the same text filed under both languages, not recognisably Spanish: keep it as English only (so the UI says
    # "only available in English" instead of labelling English text as Spanish)
    if out.get("es") and out.get("es") == out.get("en") and not looks_spanish(out["es"]):
        del out["es"], src["es"]
    return out, src


# ---------------------------------------------------------------- dates

def reec_date(d: str | None) -> str | None:
    m = re.fullmatch(r"(\d{2})[-/](\d{2})[-/](\d{4})", (d or "").strip())
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


def iso_date(d: str | None) -> str | None:
    if not d:
        return None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
        return d
    if re.fullmatch(r"\d{4}-\d{2}", d):
        return d + "-01"
    return None


def mtime_iso(p: Path) -> str | None:
    return datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat(timespec="seconds") if p.exists() else None


def age_years(s: str | None) -> float | None:
    m = re.match(r"\s*(\d+(?:\.\d+)?)\s*(year|month|week|day|hour|minute)", (s or "").lower())
    if not m:
        return None
    n = float(m.group(1))
    return round(n / {"year": 1, "month": 12, "week": 52.18, "day": 365.25, "hour": 8766, "minute": 525960}[m.group(2)], 2)


# ---------------------------------------------------------------- ClinicalTrials.gov detail (open trials only)

def fetch_ctgov(ncts: list[str], refresh: bool) -> dict[str, dict]:
    CT_CACHE.mkdir(parents=True, exist_ok=True)
    todo = [n for n in ncts if refresh or not (CT_CACHE / f"{n}.json").exists()]
    print(f"  ClinicalTrials.gov detail: {len(ncts)} open trials, {len(todo)} to fetch", flush=True)
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        q = {"filter.ids": ",".join(chunk), "fields": CT_PATIENT_FIELDS, "pageSize": str(len(chunk)), "format": "json"}
        url = f"{CT_API}?{urllib.parse.urlencode(q)}"
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Solera-pipeline/0.1 (patient portal)"})
                with urllib.request.urlopen(req, timeout=120) as r:
                    page = json.loads(r.read().decode("utf-8"))
                break
            except Exception as e:
                if attempt == 3:
                    print(f"    batch failed ({chunk[0]}…): {e}", file=sys.stderr)
                    page = {"studies": []}
                time.sleep(3 * (attempt + 1))
        for s in page.get("studies", []):
            nct = s["protocolSection"]["identificationModule"]["nctId"]
            (CT_CACHE / f"{nct}.json").write_text(json.dumps(s, ensure_ascii=False))
        time.sleep(1.0)  # polite: ~1 request / second
    out = {}
    for n in ncts:
        f = CT_CACHE / f"{n}.json"
        if f.exists():
            out[n] = {**json.loads(f.read_text()), "_fetchedAt": mtime_iso(f)}
    return out


def _reec_modified_one(rid: str) -> dict:
    """REec's own "Última actualización" for one record: open the public page (sets the study in the session), then
    call the same detail endpoint the page uses. Only the date is kept."""
    import http.cookiejar
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.addheaders = [("User-Agent", "Solera-pipeline/0.1 (patient portal)")]
    for attempt in range(3):
        try:
            opener.open(f"{REEC_WEB}/estudio/{urllib.parse.quote(rid)}", timeout=60).read()
            req = urllib.request.Request(f"{REEC_WEB}/detalle/getDetailIdentifiacionByIdEstudio", data=b"", method="POST")
            with opener.open(req, timeout=60) as r:
                resp = json.loads(r.read().decode("utf-8"))
            ms = resp[21] if isinstance(resp, list) and len(resp) > 21 else None
            ident = resp[39] if isinstance(resp, list) and len(resp) > 39 else None
            d = None
            if isinstance(ms, (int, float)):
                from zoneinfo import ZoneInfo
                d = datetime.fromtimestamp(ms / 1000, ZoneInfo("Europe/Madrid")).date().isoformat()
            return {"id": rid, "fechaModif": d, "reecInternalId": ident}
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                print(f"    REec update date failed for {rid}: {e}", file=sys.stderr)
                return {}
            time.sleep(2 * (attempt + 1))
    return {}


def fetch_reec_modified(ids: list[str], refresh: bool, workers: int = 3) -> dict[str, dict]:
    """{id: {"date": yyyy-mm-dd | None, "fetchedAt": iso}} from cache, fetching what is missing (or all with refresh)."""
    from concurrent.futures import ThreadPoolExecutor
    REEC_MODIF.mkdir(parents=True, exist_ok=True)
    todo = [i for i in ids if refresh or not (REEC_MODIF / f"{i}.json").exists()]
    print(f"  REec update dates: {len(ids)} records, {len(todo)} to fetch", flush=True)

    def one(rid):
        r = _reec_modified_one(rid)
        if r:
            (REEC_MODIF / f"{rid}.json").write_text(json.dumps({"id": rid, "fechaModif": r.get("fechaModif")}))
        time.sleep(0.3)  # polite
        return rid

    done = 0
    with ThreadPoolExecutor(workers) as ex:
        for _ in ex.map(one, todo):
            done += 1
            if done % 200 == 0:
                print(f"    {done}/{len(todo)}", flush=True)
    out = {}
    for i in ids:
        f = REEC_MODIF / f"{i}.json"
        if f.exists():
            out[i] = {"date": json.loads(f.read_text()).get("fechaModif"), "fetchedAt": mtime_iso(f)}
    return out


# ---------------------------------------------------------------- REec per-site status (situacion)

REEC_SITUACION = {"0": "not_yet", "1": "recruiting", "2": "closed"}
_SIT_RANK = {"recruiting": 3, "not_yet": 2, "closed": 1}


def reec_site_status(det: dict, cnh_codes: set[str]) -> dict[str, str]:
    """Madrid siteId -> recruiting / not_yet / closed from a REec detail record's centre list (same hospital matching
    as build_data / reec.load_trials). One hospital listed twice: active beats not started beats closed."""
    out: dict[str, str] = {}
    centros = (det.get("centros") or {}).get("centro") or []
    if isinstance(centros, dict):
        centros = [centros]
    for c in centros:
        if not reec._is_madrid_site(c):
            continue
        name = reec._text(c.get("nombre"))
        ref = (c.get("referencia") or "").strip()
        if ref in cnh_codes:
            code = ref
        elif re.fullmatch(r"117\d{3}", ref) or reec.NON_HOSPITAL_NAME.match(name):
            continue
        else:
            code, _ = build_data.match_site(name)
        v = REEC_SITUACION.get(str(c.get("situacion") or "").strip())
        if code and v and (code not in out or _SIT_RANK[v] > _SIT_RANK[out[code]]):
            out[code] = v
    return out


# ---------------------------------------------------------------- areas (display order)

# Solera's own area grouping is only used for search filters and the card band. Order a trial's areas by how directly
# they match the registry's own condition words, so a breast-cancer trial is not headed "Skin" (MeSH puts Breast
# Diseases under Skin and Connective Tissue) and a lymphoma trial is not headed "Heart" (via Hemostatic Disorders).
AREA_KEYWORDS = {
    "oncology": r"cancer|carcinom|neoplas|tumou?r|malignan|sarcom|melanom|glioma|blastom|metasta|oncolog|lymphom|linfom|leuk|leuc|myelom|mielom|mesothelio",
    "hematology": r"hemat|haemat|leuk|leuc|lymphom|linfom|myelom|mielom|anemi|anaemi|hemophil|haemophil|thromb|sickle|thalass|blood|sangre|neutropen|myelodysplas|waldenstr",
    "cardiovascular": r"heart|cardi|coronar|myocard|hypertens|hipertens|atrial|arrhythm|vascular|aort|stroke|ictus|infarct|angina|cholesterol|colesterol|lipid",
    "neurology": r"neuro|alzheimer|parkinson|epilep|sclerosis|esclerosis|migrain|migran|brain|cerebr|dementia|demencia|neuropath|myasthen|huntington|ataxi|stroke|ictus",
    "psychiatry": r"depress|schizo|esquizo|bipolar|anxiety|ansiedad|psych|psiqu|autis|adhd|tdah|mental|addict|adiccion",
    "infectious": r"infect|infecc|hiv|vih|hepatitis|covid|sars|influenza|gripe|vaccin|vacuna|tubercul|bacter|viral|virus|sepsis|fung",
    "respiratory": r"lung|pulmon|asthma|asma|copd|epoc|respirat|bronch|fibrosis|cystic|apnea|apnoea",
    "gastro_hepatology": r"liver|hepat|higado|crohn|colitis|bowel|intestin|gastr|esophag|esofag|pancrea|cirrhos|steatohep|biliar|celiac|celiac",
    "endocrine_metabolic": r"diabet|obes|metabol|thyroid|tiroid|endocrin|lipid|cholesterol|colesterol|growth|adrenal|hypophosph|insulin",
    "immunology_rheumatology": r"arthrit|artritis|lupus|rheumat|reumat|spondyl|immun|inmun|vasculitis|sjogren|gout|osteoporo|bone|hueso|joint|articul|myositis",
    "dermatology": r"skin|piel|dermat|psoria|eczema|urticar|hidradenitis|acne|vitiligo|alopecia|pemphig|cutane",
    "nephrology_urology": r"kidney|renal|rinon|nephr|urolog|bladder|vejiga|prostat|urinar|dialysis|glomerul",
    "womens_health": r"pregnan|embaraz|endometrio|menopaus|ovari|uter|cervic|gynec|ginec|fertil|matern|preterm|breast|mama",
    "ophthalmology": r"eye|ocular|retin|macular|glaucom|oftalm|ophthalm|uveitis|cornea|vision",
    "rare_genetic": r"rare|rara|genetic|genetica|hereditar|congenit|duchenne|fabry|gaucher|amyloid|spinal muscular|syndrome",
}
AREA_KEYWORDS = {k: re.compile(v, re.I) for k, v in AREA_KEYWORDS.items()}
AREA_PRIORITY = ["oncology", "hematology", "neurology", "psychiatry", "infectious", "respiratory", "endocrine_metabolic",
                 "gastro_hepatology", "nephrology_urology", "ophthalmology", "dermatology", "womens_health",
                 "immunology_rheumatology", "rare_genetic", "cardiovascular"]


def order_areas(areas: list[str], conditions: list[str], mesh: list[str], titles: list[str]) -> list[str]:
    if len(areas) <= 1:
        return list(areas)
    first = conditions[:1]

    def score(a):
        rx = AREA_KEYWORDS.get(a)
        if not rx:
            return 0
        s = 4 * sum(bool(rx.search(c)) for c in first)
        s += 2 * sum(bool(rx.search(c)) for c in conditions[1:] + mesh)
        s += sum(bool(rx.search(t)) for t in titles if t)
        return s

    prio = {a: i for i, a in enumerate(AREA_PRIORITY)}
    return sorted(areas, key=lambda a: (-score(a), prio.get(a, 99)))


def split_ctgov_criteria(text: str | None) -> tuple[str | None, str | None, bool]:
    """CT.gov eligibility is one block: 'Inclusion Criteria: … Exclusion Criteria: …'. Returns (incl, excl, split_ok)."""
    if not text:
        return None, None, False
    m = re.search(r"^\s*(?:key\s+)?exclusion\s+criteria\b.*$", text, re.I | re.M)
    if not m:
        return text, None, False
    incl = re.sub(r"^\s*(?:key\s+)?inclusion\s+criteria\b[^\n]*\n?", "", text[:m.start()], flags=re.I).strip()
    excl = text[m.end():].strip()
    return incl or None, excl or None, True


# ---------------------------------------------------------------- main

def registry_links(ids: list[str], reec_known: set[str]) -> list[dict]:
    out = []
    for i in ids:
        if i.startswith("NCT"):
            out.append({"id": i, "registry": "ctgov", "url": f"https://clinicaltrials.gov/study/{i}"})
        elif i in reec_known:
            out.append({"id": i, "registry": "reec", "url": f"https://reec.aemps.es/reec/estudio/{i}"})
        elif ctis_link.is_euct(i) or re.fullmatch(r"\d{4}-5\d{5}-\d{2}", i):  # EU CT number, with or without suffix
            out.append({"id": i, "registry": "ctis",
                        "url": f"https://euclinicaltrials.eu/search-for-clinical-trials/?lang=en&EUCT={i}"})
        else:
            out.append({"id": i, "registry": "euctr",
                        "url": f"https://www.clinicaltrialsregister.eu/ctr-search/search?query={i}"})
    return out


def main():
    refresh = "--refresh" in sys.argv
    today = date.today()
    trials = json.loads((DATA / "trials.json").read_text())
    sites = {s["id"]: s for s in json.loads((DATA / "sites.json").read_text())}
    status = json.loads((REEC_DIR / "status.json").read_text())
    det_dir = REEC_DIR / "detalle"
    ct_raw = {s["protocolSection"]["identificationModule"]["nctId"]: s for s in json.loads(CT_FILE.read_text())}
    status_fetched = mtime_iso(REEC_DIR / "status.json")
    ct_madrid_fetched = mtime_iso(CT_FILE)

    cnh_codes = set(sites)
    stats: Counter = Counter()
    reec_known = set(status) | {p.stem for p in det_dir.glob("*.json")}

    def reec_records(t):
        ids = [i for i in t["registryIds"] if not i.startswith("NCT") and (i in status or (det_dir / f"{i}.json").exists())]
        # open record first, then the newest numbering (EU CT over EudraCT, -01 over -00)
        return sorted(ids, key=lambda i: (status.get(i, {}).get("estado") in REEC_OPEN, ctis_link.is_euct(i), i), reverse=True)

    # 1. select open trials
    selected = []
    for t in trials:
        recs = reec_records(t)
        r_estados = [status.get(i, {}).get("estado") for i in recs]
        r_open = [i for i in recs if status.get(i, {}).get("estado") in REEC_OPEN]
        has_ct = any(i.startswith("NCT") for i in t["registryIds"]) and "ctgov" in t["sources"]
        trial_status, status_source = None, None
        if t["status"] in OPEN:
            trial_status, status_source = t["status"], ("ctgov" if has_ct else "reec")
            if has_ct and recs and not r_open and any(e in REEC_CLOSED for e in r_estados):
                stats["dropped_reec_closed_in_spain"] += 1
                continue
        elif has_ct and t["status"] == "UNKNOWN" and r_open:
            trial_status, status_source = REEC_OPEN[status[r_open[0]]["estado"]], "reec"
            stats["unknown_ctgov_open_in_reec"] += 1
        else:
            continue
        # REec Spain end / early termination dates override an open flag
        if r_open:
            d = json.loads((det_dir / f"{r_open[0]}.json").read_text()) if (det_dir / f"{r_open[0]}.json").exists() else {}
            cal = d.get("calendario") or {}
            if cal.get("fechaFinRealEspana") or cal.get("fechaFinPrematuro"):
                stats["dropped_reec_end_date"] += 1
                continue
        selected.append((t, trial_status, status_source, recs))
    stats["open_candidates"] = len(selected)

    # 2. ClinicalTrials.gov detail for the open NCT trials
    ncts = sorted({i for t, *_ in selected for i in t["registryIds"] if i.startswith("NCT")})
    ct_detail = fetch_ctgov(ncts, refresh)
    reec_modif = fetch_reec_modified(sorted({recs[0] for *_, recs in selected if recs}), refresh)

    out = []
    for t, trial_status, status_source, recs in selected:
        nct = next((i for i in t["registryIds"] if i.startswith("NCT")), None)
        ctd = ct_detail.get(nct) if nct else None
        ps = (ctd or {}).get("protocolSection", {})
        if ctd and status_source == "ctgov":
            fresh = ps.get("statusModule", {}).get("overallStatus")
            if fresh and fresh not in OPEN:
                stats["dropped_ctgov_fresh_status_closed"] += 1
                continue
            if fresh:
                trial_status = fresh

        # REec primary record
        rid = recs[0] if recs else None
        det = json.loads((det_dir / f"{rid}.json").read_text()) if rid and (det_dir / f"{rid}.json").exists() else {}
        reec_sites = reec_site_status(det, cnh_codes) if det else {}
        reec_not_started = bool(rid) and status.get(rid, {}).get("estado") == "1"
        is_reec_only = not (nct and "ctgov" in t["sources"])

        # per-site status
        out_sites = []
        for s in t["sites"]:
            if s["siteId"] not in sites:
                continue
            st = (s.get("status") or "").upper() or None
            if is_reec_only:
                st = None  # REec-only: trials.json site status came from reec.SITE_STATUS; re-read situacion below
            if st in ("COMPLETED", "ACTIVE_NOT_RECRUITING", "TERMINATED", "WITHDRAWN", "SUSPENDED", "ENROLLING_BY_INVITATION"):
                continue  # closed / not open to new patients at this hospital
            rs = reec_sites.get(s["siteId"])
            if st == "RECRUITING":
                v = "not_yet" if trial_status == "NOT_YET_RECRUITING" else "recruiting"
                stats["site_status_from_ctgov"] += 1
            elif st == "NOT_YET_RECRUITING":
                v = "not_yet"
                stats["site_status_from_ctgov"] += 1
            elif rs == "closed":
                stats["site_dropped_reec_closed"] += 1
                continue
            elif rs == "recruiting":
                v = "not_yet" if trial_status == "NOT_YET_RECRUITING" or reec_not_started else "recruiting"
                stats["site_status_from_reec"] += 1
            elif rs == "not_yet":
                v = "not_yet"
                stats["site_status_from_reec"] += 1
            elif trial_status == "NOT_YET_RECRUITING" or reec_not_started:
                v = "not_yet"
            else:
                v = "unknown"
            out_sites.append({"siteId": s["siteId"], "status": v})
        if not out_sites:
            stats["dropped_all_madrid_sites_closed"] += 1
            continue
        info = det.get("informacion") or {}
        rst = status.get(rid, {}) if rid else {}
        R = lambda field: {"registry": "reec", "id": rid, "field": field} if rid else None  # noqa: E731
        C = lambda field: {"registry": "ctgov", "id": nct, "field": field} if nct else None  # noqa: E731
        ct_title = (ct_raw.get(nct) or {}).get("protocolSection", {}).get("identificationModule", {}).get("briefTitle") if nct else None

        titles, tsrc = bilingual(
            [(clean(info.get("tituloPublico")), R("tituloPublico")), (clean(rst.get("titulo_es")), R("titulo_es"))],
            [(clean(ct_title), C("briefTitle")), (clean(info.get("tituloPublico_en")), R("tituloPublico_en")),
             (clean(rst.get("titulo_en")), R("titulo_en"))],
        )
        indication, isrc = bilingual(
            [(clean(info.get("indicacionPublica")), R("indicacionPublica")), (clean(rst.get("indicacion_es")), R("indicacion_es"))],
            [(clean(info.get("indicacionPublica_en")), R("indicacionPublica_en")), (clean(rst.get("indicacion_en")), R("indicacion_en"))],
        )
        summary_en = clean(ps.get("descriptionModule", {}).get("briefSummary"))
        em = ps.get("eligibilityModule", {})
        ct_incl, ct_excl, split_ok = split_ctgov_criteria(clean(em.get("eligibilityCriteria")))
        incl, incl_src = bilingual([(clean(info.get("criteriosInclusion")), R("criteriosInclusion"))],
                                   [(ct_incl, C("eligibilityCriteria")), (clean(info.get("criteriosInclusion_en")), R("criteriosInclusion_en"))])
        excl, excl_src = bilingual([(clean(info.get("criteriosExclusion")), R("criteriosExclusion"))],
                                   [(ct_excl, C("eligibilityCriteria")), (clean(info.get("criteriosExclusion_en")), R("criteriosExclusion_en"))])
        from_ct = (incl_src.get("en") or {}).get("registry") == "ctgov"
        if ct_incl and not split_ok and from_ct:
            stats["ctgov_criteria_unsplit"] += 1

        pob = det.get("poblacion") or {}
        hv = em.get("healthyVolunteers") if "healthyVolunteers" in em else None
        if hv is None and pob:
            hv = True if reec._flag(pob.get("voluntariossanos")) else (False if reec._flag(pob.get("pacientes")) else None)

        rare = None
        if rid:
            rare = reec._flag(det.get("enfermedadRara")) or reec._flag(rst.get("enfermedadrara"))

        # last registry update: CT.gov "last update posted" and REec's own "Última actualización"; when REec's date
        # could not be read, its latest dated event (registration, authorisation, start, restart) is a lower bound.
        ct_updated = iso_date(ps.get("statusModule", {}).get("lastUpdatePostDateStruct", {}).get("date"))
        reec_modified = (reec_modif.get(rid) or {}).get("date") if rid else None
        if reec_modified:
            reec_updated, reec_kind = reec_modified, "last_modified"
        else:
            cal = det.get("calendario") or {}
            reec_dates = [reec_date(cal.get(k)) for k in ("fechaRegistro", "fechaAutorizacionAEMPS", "fechaInicioReal",
                                                           "fechaReinicio", "fechaInicioPrevista")]
            reec_dates = [d for d in reec_dates if d and d <= today.isoformat()]
            reec_updated = max(reec_dates) if reec_dates else reec_date(rst.get("fecha_autorizacion"))
            reec_kind = "calendar" if reec_updated else None
        cands = [d for d in (ct_updated, reec_updated) if d]
        last = max(cands) if cands else None
        basis = None if not last else ("ctgov_last_update_posted" if last == ct_updated else
                                       ("reec_last_modified" if reec_kind == "last_modified" else "reec_latest_calendar_date"))
        stale = (today - date.fromisoformat(last)).days > STALE_DAYS if last else True

        fetched = {}
        if rid:
            f = det_dir / f"{rid}.json"
            fetched["reec"] = min(x for x in (mtime_iso(f), status_fetched) if x) if f.exists() else status_fetched
        if nct:
            fetched["ctgov"] = min(x for x in ((ctd or {}).get("_fetchedAt"), ct_madrid_fetched) if x)

        # MeSH: drop ClinicalTrials.gov supplementary concepts (C-ids, e.g. "Parkinson Disease 4, Autosomal Dominant Lewy
        # Body" derived from KRAS text in a lung-cancer record); keep descriptors (D-ids) only.
        ct_mesh_ids = {m.get("term"): m.get("id", "") for m in ((ct_raw.get(nct) or {}).get("derivedSection", {})
                                                                 .get("conditionBrowseModule", {}).get("meshes", []))} if nct else {}
        mesh_terms = []
        for m in t.get("mesh") or []:
            mid = ct_mesh_ids.get(m)
            if (mid and not mid.startswith("D")) or re.search(r"\d, Autosomal", m):
                stats["mesh_supplementary_dropped"] += 1
                continue
            mesh_terms.append(m)

        sponsor = t.get("sponsor")
        if sponsor and sponsor != "Investigator-initiated" and reec.is_person_sponsor(sponsor):
            sponsor = "Investigator-initiated"

        rec = {
            "id": t["id"],
            "registryIds": t["registryIds"],
            "registryLinks": registry_links(t["registryIds"], reec_known),
            "primaryReecId": rid,
            "nctId": nct,
            "title": {**titles, "source": tsrc},
            "publicIndication": {**indication, "source": isrc},
            "summary": {"en": summary_en, "source": C("briefSummary")} if summary_en else {"source": None},
            "eligibility": {
                "inclusion": {**incl, "source": incl_src},
                "exclusion": {**excl, "source": excl_src},
                "criteriaSplit": split_ok if from_ct else True,
                "minAge": em.get("minimumAge"),
                "maxAge": em.get("maximumAge"),
                "minAgeYears": age_years(em.get("minimumAge")),
                "maxAgeYears": age_years(em.get("maximumAge")),
                "sex": em.get("sex"),
                "healthyVolunteers": hv,
                "source": C("eligibilityModule") if em else (R("poblacion") if pob else None),
            },
            "ages": t.get("ages") or em.get("stdAges") or [],
            "conditions": t.get("conditions") or [],
            "mesh": mesh_terms,
            "meshAncestors": t.get("meshAncestors") or [],
            "areas": order_areas(t.get("areas") or [], t.get("conditions") or [], mesh_terms,
                                 [titles.get("en"), titles.get("es"), indication.get("en"), indication.get("es")]),
            "phases": t.get("phases") or [],
            "status": trial_status,
            "statusSource": status_source,
            "sites": out_sites,
            "sponsor": sponsor,
            "sponsorClass": t.get("sponsorClass"),
            "rareDisease": rare,
            "lastUpdated": last,
            "lastUpdatedBasis": basis,
            "lastUpdatedBySource": {k: v for k, v in (("ctgov", ct_updated), ("reec", reec_updated)) if v},
            "reecUpdatedKind": reec_kind if rid and reec_updated else None,
            "stale": stale,
            "fetchedAt": fetched,
        }
        out.append(rec)

    # 3. guards: no personal data
    blob = json.dumps(out, ensure_ascii=False)
    if EMAIL.search(blob.replace("[email eliminado]", "")):
        raise SystemExit("Personal data guard: email address in patient_trials.json")
    leaked = [r["id"] for r in out if r["sponsor"] and r["sponsor"] != "Investigator-initiated" and reec.is_person_sponsor(r["sponsor"])]
    if leaked:
        raise SystemExit(f"Personal data guard: person-like sponsor in {leaked[:10]}")
    for r in out:
        for field in ("title", "publicIndication", "summary"):
            for lang in ("es", "en"):
                v = r[field].get(lang)
                if v and (PERSON_MENTION.search(v) or reec.is_person_sponsor(v.split("\n")[0][:80]) and len(v) < 80):
                    raise SystemExit(f"Personal data guard: person-like text in {r['id']} {field}.{lang}")
        if any(re.search(r"investigador|investigator|contact|email|phone|telefono", k, re.I) for k in r):
            raise SystemExit("Personal data guard: contact-like field")

    out.sort(key=lambda r: (r["lastUpdated"] or "", r["id"]), reverse=True)
    payload = {
        "builtAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "staleAfterDays": STALE_DAYS,
        "sources": {
            "reec": {"name": "REec, Registro Español de Estudios Clínicos (AEMPS)", "url": "https://reec.aemps.es/reec/public/web.html",
                     "fetchedAt": status_fetched},
            "ctgov": {"name": "ClinicalTrials.gov (U.S. National Library of Medicine)", "url": "https://clinicaltrials.gov/",
                      "fetchedAt": ct_madrid_fetched},
        },
        "trials": out,
    }
    tmp = OUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False))
    os.replace(tmp, OUT)

    # 4. summary
    n = len(out) or 1
    pct = lambda k: f"{100 * k / n:.0f}%"
    summary = {
        "trials": len(out),
        "byStatus": dict(Counter(r["status"] for r in out)),
        "bySource": dict(Counter("+".join(sorted({l["registry"] for l in r["registryLinks"]} & {"ctgov", "reec"})) for r in out)),
        "withSpanishTitle": pct(sum(1 for r in out if r["title"].get("es"))),
        "withSpanishIndication": pct(sum(1 for r in out if r["publicIndication"].get("es"))),
        "withEnglishTitle": pct(sum(1 for r in out if r["title"].get("en"))),
        "withSummary": pct(sum(1 for r in out if r["summary"].get("en"))),
        "withSpanishCriteria": pct(sum(1 for r in out if r["eligibility"]["inclusion"].get("es"))),
        "withEnglishCriteria": pct(sum(1 for r in out if r["eligibility"]["inclusion"].get("en"))),
        "stale": sum(1 for r in out if r["stale"]),
        "lastUpdatedBasis": dict(Counter(r["lastUpdatedBasis"] for r in out)),
        "staleByBasis": dict(Counter(r["lastUpdatedBasis"] for r in out if r["stale"])),
        "siteStatus": dict(Counter(s["status"] for r in out for s in r["sites"])),
        "hospitals": len({s["siteId"] for r in out for s in r["sites"]}),
        "healthyVolunteers": sum(1 for r in out if r["eligibility"]["healthyVolunteers"]),
        "rareDisease": sum(1 for r in out if r["rareDisease"]),
        "ctgovDetailMissing": sum(1 for r in out if r["nctId"] and r["nctId"] not in ct_detail),
        "selection": dict(stats),
        "scrubbed": dict(scrub_counts),
    }
    print(json.dumps(summary, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
