"""
REec — Registro Español de Estudios Clínicos (AEMPS) public REST service.
Docs: https://www.aemps.gob.es/medicamentos-de-uso-humano/investigacion_medicamentos/ensayosclinicos/servicios-de-consulta-de-estudios-publicados-en-reec/

Three calls:
  estudios?fechadesde&fechahasta   → every trial registered in a window, with its full site list (ORG ids)
  busquedaestudios?estado=N        → trial-level status (1 not started, 2 recruiting, 3 finished,
                                     4 recruitment ended, 5 interrupted — 5 is undocumented but works)
                                     plus title, indication, sponsor, authorisation date
  json/detalle/{id}                → phase flags, population, MeSH-coded therapeutic areas (one call per trial)

GDPR: investigator names and sponsor contact person / email / phone are removed before anything is
written to disk. Only institution-level data is kept.
"""

import html
import json
import re
import time
import unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

BASE = "https://reec.aemps.es/reec-services"
FIRST_YEAR = 2013  # REec starts in 2013

# Only these site fields are kept; everything else (investigador, free-text departamento which can hold
# personal emails/phones, any new field) is dropped by default.
SITE_FIELDS = {"tipo", "referencia", "situacion", "nombre", "localidad", "codPostal", "provincia", "ccaa"}
PERSONAL_ORG_FIELDS = {"mail", "telefono", "fax", "personaContacto", "domicilio"}

STATUS = {  # REec trial estado → ClinicalTrials.gov-style status used by the app
    "1": "NOT_YET_RECRUITING",
    "2": "RECRUITING",
    "3": "COMPLETED",
    "4": "ACTIVE_NOT_RECRUITING",
    "5": "SUSPENDED",
}
# per-site situacion → app site status (search.ts treats a site as competing only if the trial is also recruiting)
SITE_STATUS = {"0": None, "1": "RECRUITING", "2": "COMPLETED"}
SITE_RANK = {"RECRUITING": 2, "COMPLETED": 1, None: 0}

# MeSH tree code (from REec "Diseases [C] - Neoplasms [C04]") → app therapeutic area
MESH_TREE_AREAS = {
    "C04": "oncology", "C15": "hematology", "C14": "cardiovascular", "C10": "neurology",
    "F03": "psychiatry", "C01": "infectious", "C02": "infectious", "C03": "infectious", "C08": "respiratory", "C06": "gastro_hepatology",
    "C19": "endocrine_metabolic", "C18": "endocrine_metabolic", "C20": "immunology_rheumatology",
    "C05": "immunology_rheumatology", "C17": "dermatology", "C12": "nephrology_urology",
    "C13": "womens_health", "C11": "ophthalmology", "C16": "rare_genetic",
}

COMPANY = re.compile(
    r"\b(s\.?a\.?u?|s\.?l\.?u?|sociedad unipersonal|inc|ltd|co\.? ltd|limited|gmbh|ag|llc|plc|corp|"
    r"pharma\w*|therapeutics|biotech\w*|laborator\w*|biosciences?|s\.p\.a|n\.v|a/s|kft)\b"
)
ACADEMIC = re.compile(
    r"fundaci|hospital|universi|instituto|servicio|grupo|gruppo|groupe|sociedad|asociaci|consorcio|centro nacional|"
    r"group|society|association|foundation|fondazione|fondation|stiftung|onlus|\bets\b|institut|academic|"
    r"research council|ministerio|consejer|cooperative|organisation for research|organization for research|eortc|"
    r"europese organisatie|organisation europeenne|kompetenznetz|stichting|vereniging|unicancer|lysarc|solti|"
    r"assistance publique|\bap-hp\b|inserm|cancer research uk|cancer cent|\bnhs\b|college|\bmrc\b|\bctu\b|"
    r"\betop\b|ciber|idib|\bfib|fisevi|sermas|plan nacional|centrum|maxima"
)
PERSON_TITLE = re.compile(r"^(dr|dra|prof|profa)\.?\s")


CREDENTIALS = re.compile(r"(^|[\s,])(m\.?d\.?|ph\.?d\.?|msc|rn)(\s|,|\.|$)", re.I)
# Common given names (Spanish + frequent international). A sponsor whose leading segment starts with one of these
# and has no organisation word is treated as a person. Deliberately excludes names that start company names (e.g. Eli).
FIRST_NAMES = set("""
maria mª jose josé juan antonio francisco manuel david javier daniel carlos jesus jesús alejandro miguel rafael pedro pablo
angel ángel fernando luis jorge sergio alberto alvaro álvaro diego adrian adrián raul raúl enrique ramon ramón vicente andres
andrés joaquin joaquín santiago victor víctor eduardo ignacio roberto marcos jaime mario ruben rubén oscar óscar emilio julio
salvador guillermo gonzalo agustin agustín tomas tomás jordi xavier josep joan felix félix cristina carmen ana isabel laura
marta lucia lucía elena pilar teresa rosa paula sara beatriz silvia patricia raquel rocio rocío monica mónica nuria irene
eva sonia alicia esther mercedes montserrat amparo concepcion concepción dolores angeles ángeles rosario inmaculada begoña
susana victoria natalia noelia alejandra clara sofia sofía julia andrea marina ines inés gloria virginia celia almudena
belen belén lourdes yolanda olga adela consuelo encarnacion margarita miriam marisa celso abelardo borja iñigo iñaki
john james robert michael william richard thomas mark paul peter george stephen andrew mary susan sarah jennifer linda
""".split())


def is_person_sponsor(name: str) -> bool:
    """Investigator-sponsored trials name a person as sponsor (personal data) — never store it.
    Signals: a title (Dr./Dra./Prof./Mª), credentials (MD, PhD), or a leading segment that starts with a common
    given name and contains no organisation word ('María de los Ángeles Tena', 'Name, Servicio de … Hospital')."""
    raw = (name or "").strip()
    n = raw.lower()
    if not n or re.search(r"\d", n):
        return False
    if PERSON_TITLE.match(n) or re.match(r"^m[ªa]\.?\s", n):
        return not COMPANY.search(n)  # 'Dr. Falk Pharma GmbH', "Dr. Reddy's Laboratories" are companies
    lead = re.split(r"[/,(;]|\.\s", raw, maxsplit=1)[0].strip().lower()
    if CREDENTIALS.search(n) and not COMPANY.search(lead) and not ACADEMIC.search(lead):
        return True
    words = re.findall(r"[^\W\d_][\w'\-]*", lead)
    first = unicodedata.normalize("NFKD", words[0]).encode("ascii", "ignore").decode() if words else ""
    if not words or (words[0] not in FIRST_NAMES and first not in FIRST_NAMES) or not 2 <= len(words) <= 7:
        return False
    return not (COMPANY.search(lead) or ACADEMIC.search(lead))


def sponsor_class(name: str | None) -> str | None:
    if not name:
        return None
    n = name.lower()
    if COMPANY.search(n):
        return "INDUSTRY"
    return "OTHER" if ACADEMIC.search(n) else "INDUSTRY"


def _get(url: str, retries: int = 4):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Solera-pipeline/0.1 (feasibility research)"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(2 * (attempt + 1))


def _as_list(v):
    if v is None or v == "":
        return []
    return v if isinstance(v, list) else [v]


# Detail-record blocks the pipeline uses; everything else (criteria free text, contacts, …) is dropped on download.
DETAIL_FIELDS = {"id", "identificador", "acronimo", "enfermedadRara", "calendario", "informacion", "organismo",
                 "proposito", "poblacion", "centros", "areasTerapeuticas"}
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def _scrub(o):
    """Blank out email addresses anywhere in remaining free text."""
    if isinstance(o, dict):
        return {k: _scrub(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_scrub(v) for v in o]
    return EMAIL.sub("[email removed]", o) if isinstance(o, str) else o


def _strip_personal(study: dict) -> dict:
    if "proposito" in study or "poblacion" in study:  # a detail record
        study = {k: v for k, v in study.items() if k in DETAIL_FIELDS}
    centros = study.get("centros") or {}
    if centros.get("centro") is not None:
        centros["centro"] = [{k: v for k, v in c.items() if k in SITE_FIELDS} for c in _as_list(centros["centro"])]
    org = study.get("organismo") or {}
    for k in PERSONAL_ORG_FIELDS:
        org.pop(k, None)
    return _scrub(study)


def _text(s) -> str:
    s = re.sub(r"</?[A-Za-z][A-Za-z0-9]*(?:\s[^<>]*)?/?>", " ", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def _flag(v) -> bool:
    """REec detail flags arrive as JSON ints (0/1); accept strings too."""
    return str(v).strip() == "1"


def _is_madrid_site(c: dict) -> bool:
    return "MADRID" in (c.get("ccaa") or "").upper() or (c.get("codPostal") or "").startswith("28")


# ---------------------------------------------------------------- fetch (cached under raw/reec)

def fetch(raw_dir: Path, refresh: bool = False, workers: int = 4) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    this_year = date.today().year

    # 1. site lists by registration year. Past years are cached forever; the current year is refreshed.
    for y in range(FIRST_YEAR, this_year + 1):
        f = raw_dir / f"estudios_{y}.json"
        if f.exists() and not (refresh and y >= this_year - 1):
            continue
        data = _get(f"{BASE}/estudios?fechadesde=01/01/{y}&fechahasta=31/12/{y}")
        studies = [_strip_personal(s) for s in _as_list((data or {}).get("estudio"))]
        f.write_text(json.dumps(studies, ensure_ascii=False))
        print(f"  REec {y}: {len(studies)} trials", flush=True)

    # 2. status + titles (small, always refreshed when asked)
    f = raw_dir / "status.json"
    if refresh or not f.exists():
        status = {}
        for code in STATUS:
            data = _get(f"{BASE}/busquedaestudios?estado={code}&xml=0")
            for s in _as_list((data or {}).get("estudio")):
                status[s["identificador"]] = {
                    "estado": code,
                    "titulo_es": s.get("titulo_es"), "titulo_en": s.get("titulo_en"),
                    "indicacion_es": s.get("indicacion_es"), "indicacion_en": s.get("indicacion_en"),
                    "promotor": s.get("promotor"), "fecha_autorizacion": s.get("fecha_autorizacion"),
                    "enfermedadrara": s.get("enfermedadrara"),
                }
        f.write_text(json.dumps(status, ensure_ascii=False))
        print(f"  REec status: {len(status)} trials", flush=True)

    # 3. detail for every trial with a Madrid site (one file per trial, so interrupted runs resume)
    det_dir = raw_dir / "detalle"
    det_dir.mkdir(exist_ok=True)
    ids = sorted({s["identificador"] for s in _load_bulk(raw_dir)
                  if any(_is_madrid_site(c) for c in _as_list((s.get("centros") or {}).get("centro")))})
    todo = [i for i in ids if not (det_dir / f"{i}.json").exists()]
    print(f"  REec detail: {len(ids)} Madrid trials, {len(todo)} to fetch", flush=True)

    def one(i):
        try:
            d = _get(f"{BASE}/json/detalle/{i}")
            if d:
                (det_dir / f"{i}.json").write_text(json.dumps(_strip_personal(d), ensure_ascii=False))
        except Exception as e:  # keep going; the trial is still usable from bulk + status data
            print(f"    detail failed {i}: {e}", flush=True)
        time.sleep(0.25)

    with ThreadPoolExecutor(workers) as pool:
        for n, _ in enumerate(pool.map(one, todo), 1):
            if n % 500 == 0:
                print(f"    {n}/{len(todo)}", flush=True)


def _load_bulk(raw_dir: Path) -> list[dict]:
    out = {}
    for f in sorted(raw_dir.glob("estudios_*.json")):
        for s in json.loads(f.read_text()):
            out[s["identificador"]] = s  # later registration windows win
    return list(out.values())


# ---------------------------------------------------------------- normalise to the app's Trial shape

def _year(d: str | None):
    m = re.search(r"(\d{4})", d or "")
    return int(m.group(1)) if m else None


NON_HOSPITAL_NAME = re.compile(r"^(cap|cs|centro de salud|consultorio|residencia)\b", re.I)


def load_trials(raw_dir: Path, match_site, cnh_codes: set[str] = frozenset()) -> tuple[list[dict], dict]:
    """Returns (trials with ≥1 attributable Madrid site, stats). Trial ids are the EudraCT / EU CT number."""
    status = json.loads((raw_dir / "status.json").read_text())
    det_dir = raw_dir / "detalle"
    stats = {"madrid_site_rows": 0, "matched": 0, "unmatched": 0, "non_hospital": 0, "trials_without_attributable_site": 0, "missing_detail": 0}
    unmatched: dict[str, int] = {}
    trials = []

    for s in _load_bulk(raw_dir):
        madrid = [c for c in _as_list((s.get("centros") or {}).get("centro")) if _is_madrid_site(c)]
        if not madrid:
            continue
        sites = {}
        for c in madrid:
            stats["madrid_site_rows"] += 1
            name = _text(c.get("nombre"))
            ref = (c.get("referencia") or "").strip()
            if ref in cnh_codes:  # some rows carry the hospital's catalogue code itself
                code = ref
            elif re.fullmatch(r"117\d{3}", ref) or NON_HOSPITAL_NAME.match(name):  # primary care / nursing homes
                stats["non_hospital"] = stats.get("non_hospital", 0) + 1
                continue
            else:
                code, _ = match_site(name)
            if code:
                stats["matched"] += 1
                st = SITE_STATUS.get(c.get("situacion") or "0")
                # one hospital can appear twice (e.g. transitioned trials): active beats closed beats unknown
                if code not in sites or SITE_RANK[st] > SITE_RANK[sites[code]]:
                    sites[code] = st
            else:
                stats["unmatched"] += 1
                key = f"{name} [{c.get('referencia') or '-'}]"
                unmatched[key] = unmatched.get(key, 0) + 1
        if not sites:
            stats["trials_without_attributable_site"] += 1
            continue

        tid = s["identificador"]
        st = status.get(tid, {})
        f = det_dir / f"{tid}.json"
        det = json.loads(f.read_text()) if f.exists() else {}
        if not det:
            stats["missing_detail"] += 1
        info, prop, pob, cal = det.get("informacion") or {}, det.get("proposito") or {}, det.get("poblacion") or {}, s.get("calendario") or {}

        phases = [p for flag, p in (("faseUno", "PHASE1"), ("faseDos", "PHASE2"), ("faseTres", "PHASE3"), ("faseCuatro", "PHASE4"))
                  if _flag(prop.get(flag))]
        ages = []
        if any(_flag(pob.get(k)) for k in ("ninos", "adolescentes", "preescolar", "reciennacido", "prematuros", "menores", "intrauteros")):
            ages.append("CHILD")
        if _flag(pob.get("adultos")):
            ages.append("ADULT")
        if _flag(pob.get("ancianos")):
            ages.append("OLDER_ADULT")

        area_names = [a.get("nombre_en") or "" for a in _as_list((det.get("areasTerapeuticas") or {}).get("area"))]
        areas = sorted({MESH_TREE_AREAS[code] for n in area_names for code in re.findall(r"\[([A-Z]\d\d)", n) if code in MESH_TREE_AREAS})
        if _flag(st.get("enfermedadrara")) or _flag(s.get("enfermedadRara")):
            areas = sorted(set(areas) | {"rare_genetic"})

        conditions = [t for t in {_text(info.get("indicacionPublica_en")), _text(info.get("indicacionPublica")),
                                  _text(st.get("indicacion_en")), _text(st.get("indicacion_es"))} if t]
        sponsor = _text((det.get("organismo") or s.get("organismo") or {}).get("promotor") or st.get("promotor"))
        person = is_person_sponsor(sponsor)
        trial_status = STATUS.get(st.get("estado"), "UNKNOWN")
        if cal.get("fechaFinPrematuro"):
            trial_status = "TERMINATED"

        trials.append({
            "id": tid,
            "title": _text(info.get("tituloPublico_en") or st.get("titulo_en") or info.get("tituloPublico") or st.get("titulo_es")),
            # scientific title: used only for de-duplication against ClinicalTrials.gov, removed before output
            "_officialTitle": _text(info.get("tituloCientifico_en") or info.get("tituloCientifico") or ""),
            "status": trial_status,
            "whyStopped": None,
            "phases": phases,
            "startYear": _year(cal.get("fechaInicioReal")) or _year(cal.get("fechaAutorizacionAEMPS")) or _year(st.get("fecha_autorizacion")),
            "completionYear": _year(cal.get("fechaFinRealEspana")),
            "enrollment": int(pob["total"]) if str(pob.get("total") or "").isdigit() else None,
            "sponsor": "Investigator-initiated" if person else (sponsor or None),
            "sponsorClass": "OTHER" if person else sponsor_class(sponsor),
            "conditions": conditions,
            "mesh": [],
            "meshAncestors": [],
            "areas": areas,
            "ages": ages,
            "sites": [{"siteId": c, "status": v} for c, v in sites.items()],
            "sources": ["reec"],
            "registryIds": [tid],
        })
    stats["topUnmatched"] = sorted(unmatched.items(), key=lambda x: -x[1])[:40]
    return trials, stats
