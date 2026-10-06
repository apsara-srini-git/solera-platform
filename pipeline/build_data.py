"""
Solera data pipeline — builds the Madrid site + trial dataset used by the app.

Sources (all public):
  1. Catálogo Nacional de Hospitales 2025 (Ministerio de Sanidad) — one row per hospital:
     beds, public/private, hospital class, high-tech equipment counts.
     https://www.sanidad.gob.es/estadEstudios/estadisticas/sisInfSanSNS/ofertaRecursos/hospitales/home.htm
  2. ClinicalTrials.gov API v2 — every interventional study with a site in the Comunidad de Madrid.
     https://clinicaltrials.gov/data-api/api
  3. REec — Registro Español de Estudios Clínicos (AEMPS) REST service: official Spanish site list for
     every medicines trial authorised in Spain, incl. trials missing from ClinicalTrials.gov. See reec.py.
  4. pipeline/research_units.json — hospital → research institute, from the ISCIII list of accredited IIS.
  5. Per-hospital enrichments (see each module): geo.py (map coordinates), images.py (Wikimedia Commons photo),
     sermas.py (SERMAS annual activity), ceim.py (AEMPS ethics-committee directory).

Usage:
  python3 pipeline/build_data.py            # uses cached raw files if present
  python3 pipeline/build_data.py --refresh  # re-downloads ClinicalTrials.gov and REec

Output: data/sites.json, data/trials.json, data/build_report.json
"""

import json
import itertools
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import openpyxl

import ceim
import ctis_link
import geo
import images
import reec
import sermas

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "pipeline" / "raw"
OUT = ROOT / "web" / "data"
CNH_FILE = RAW / "CNH_2025.xlsx"
CT_FILE = RAW / "ctgov_madrid.json"
REEC_DIR = RAW / "reec"
CTIS_MAP = RAW / "ctis" / "eudract_map.json"
UNITS_FILE = ROOT / "pipeline" / "research_units.json"

CT_FIELDS = ",".join([
    "NCTId", "BriefTitle", "OfficialTitle", "OverallStatus", "Phase", "StudyType", "StartDate",
    "PrimaryCompletionDate", "CompletionDate", "EnrollmentCount", "LeadSponsorName",
    "LeadSponsorClass", "Condition", "ConditionBrowseModule", "StdAge", "WhyStopped", "SecondaryIdInfo",
    "LocationFacility", "LocationCity", "LocationState", "LocationCountry", "LocationStatus",
    "OrgStudyId", "ResponsiblePartyType", "ResponsiblePartyInvestigatorFullName",
])

# CNH equipment column → (key, label)
EQUIPMENT = {
    "TAC": ("ct", "CT scanner"),
    "RMN": ("mri", "MRI"),
    "GAM": ("gamma_camera", "Gamma camera"),
    "HEM": ("cath_lab", "Haemodynamics / cath lab"),
    "ASD": ("angiography", "Digital angiography"),
    "LIT": ("lithotripsy", "Lithotripsy"),
    "ALI": ("linac", "Linear accelerator (radiotherapy)"),
    "SPECT": ("spect", "SPECT"),
    "PET": ("pet", "PET"),
    "MAMO": ("mammography", "Mammography"),
    "DO": ("densitometry", "Bone densitometry"),
    "DIAL": ("dialysis", "Dialysis stations"),
}

# MeSH ancestor term → therapeutic area
THERAPEUTIC_AREAS = [
    ("Neoplasms", "oncology"),
    ("Hemic and Lymphatic Diseases", "hematology"),
    ("Cardiovascular Diseases", "cardiovascular"),
    ("Nervous System Diseases", "neurology"),
    ("Mental Disorders", "psychiatry"),
    ("Infections", "infectious"),
    ("Respiratory Tract Diseases", "respiratory"),
    ("Digestive System Diseases", "gastro_hepatology"),
    ("Endocrine System Diseases", "endocrine_metabolic"),
    ("Nutritional and Metabolic Diseases", "endocrine_metabolic"),
    ("Immune System Diseases", "immunology_rheumatology"),
    ("Musculoskeletal Diseases", "immunology_rheumatology"),
    ("Skin and Connective Tissue Diseases", "dermatology"),
    ("Urogenital Diseases", "nephrology_urology"),
    ("Female Urogenital Diseases and Pregnancy Complications", "womens_health"),
    ("Eye Diseases", "ophthalmology"),
    ("Congenital, Hereditary, and Neonatal Diseases and Abnormalities", "rare_genetic"),
]

# ClinicalTrials.gov facility strings that hide the real site — cannot be attributed.
PLACEHOLDER = re.compile(
    r"^(none|madrid|research site|clinical trial site|local institution.*|investigational site.*|"
    r".*investigat\w* site.*|site \d+|site es\d+|.*for additional information.*|.*study site.*|.*research site|.*clinical site|"
    r"research (facility|center|centre)|investigator|hospital universitario|madrid spain)$"
)

# Ordered alias rules: first match wins. Patterns run on normalised text (lowercase, no accents).
# Each rule: (CNH code, regex). Specific names come before generic ones.
ALIASES = [
    ("280409", r"nuestra senora de la paz"),
    ("280164", r"hosp\w* carlos (iii|3)\b"),
    ("280210", r"cantoblanco"),
    ("280014", r"\bla paz\b|idipaz"),
    ("280035", r"12 de octubre|doce de octubre|12 octubre|\bimas12\b|i\+12"),
    ("280246", r"gregorio maran|maranon"),
    ("280029", r"ramon y cajal|irycis"),
    ("280133", r"nino jesus"),
    ("280072", r"san carlos|idissc"),
    ("280127", r"princes+a"),
    ("280421", r"jimenez diaz|\bfjd\b"),
    ("281315", r"p\w*\.? (de |del )?hierro|idiphisa"),
    ("281225", r"san ?chinarro|clara campal|\bciocc\b|madrid norte"),
    ("281090", r"(hosp\w*|\bhm\b|\bh\b|clinica).*monteprincipe"),
    ("281360", r"puerta del sur"),
    ("281157", r"torrelodones"),
    ("280626", r"nuevo belen"),
    ("281371", r"hm valles"),
    ("280954", r"\bhm (universitario )?madrid\b|hospital (universitario )?hm madrid|hospital de madrid\b"),
    ("281113", r"\bm ?d anderson"),
    ("281393", r"clinica univ\w* (de )?navarra|university clinic of navarra|\bcun\b"),
    ("281124", r"quiron\w* sur"),
    ("281456", r"quiron\w* (salud )?valle de(l)? henares"),
    ("280357", r"quiron\w* san jose"),
    ("281203", r"quiron\w*( salud)? (de )?(madrid|pozuelo)|hospital universitario quiron|^hospital quiron$"),
    ("281071", r"fundacion (de )?alcorcon|hospital\w* (universitario )?(de )?alcorcon"),
    ("280745", r"princ+ipe de asturias"),
    ("280838", r"severo ochoa"),
    ("280989", r"hosp\w*.*getafe|getafe university hospital"),
    ("281146", r"hosp\w*.*fuenlabrada|fuenlabrada university hospital"),
    ("281348", r"hosp\w*.*rey juan carlos|rey juan carlos (university )?hospital|idc ?salud mostoles|id dalud mostoles"),
    ("280894", r"hosp\w*.*mostoles|mostoles university hospital"),
    ("280091", r"virgen de la torre"),
    ("281270", r"infanta leonor"),
    ("281258", r"infanta sofia"),
    ("281304", r"infanta cristina"),
    ("281236", r"infanta elena"),
    ("281337", r"hosp\w*.*torrejon"),
    ("281269", r"hospital (universitario )?(del )?henares"),
    ("281281", r"(hosp\w*|\bh\b|\bu\b).*sureste"),
    ("281292", r"\btajo\b"),
    ("281359", r"general de villalba|villalba general"),
    ("280920", r"hosp\w*.*el escorial"),
    ("280724", r"gomez ulla|central de la defensa"),
    ("280565", r"ruber internaci\w*"),
    ("280552", r"ruber juan bravo|clinica ruber\b"),
    ("280604", r"zarzuela"),
    ("281179", r"(hosp\w*|sanitas).*la moraleja"),
    ("280360", r"beata maria ana"),
    ("280587", r"(hosp\w*|clinica|vithas)( vithas)?( madrid)? la milagrosa"),
    ("280323", r"nuestra senora del rosario"),
    ("280474", r"nuestra senora de america"),
    ("280339", r"hospital (universitario )?san rafael"),
    ("280534", r"clinica la luz|hospital la luz"),
    ("280468", r"san camilo"),
    ("281049", r"(hosp\w*|\bh\b|\bhla\b).*moncloa"),
    ("280112", r"santa cristina"),
    ("280442", r"virgen del mar"),
    ("280382", r"hospital (universitario )?san francisco de asis"),
    ("280148", r"cruz roja"),
    ("280262", r"lafora"),
    ("281438", r"jose germain"),
    ("280800", r"hosp\w*.*guadarrama"),
    ("280761", r"fuenfria"),
    ("280777", r"benito menni"),
    ("281247", r"pardo de aravaca"),
    ("281180", r"los madronos"),
    ("280416", r"instituto san jose"),
    ("280455", r"hestia"),
    ("281087", r"cemtro"),
    ("281445", r"isabel zendal"),
    ("280796", r"\basepeyo\b"),
]
ALIASES = [(code, re.compile(rx)) for code, rx in ALIASES]

# Display names: the catalogue spells many names without accents ("Fundacion Jimenez Diaz"), in odd case ("Md
# Anderson") or under the operating company. `name` is for people; `catalogueName` keeps the catalogue spelling, and all
# matching (trial sites, SERMAS, CEIm, photos) normalises accents/case, so these overrides never change a match.
DISPLAY_NAMES = {
    # registered under the operating company rather than the hospital name
    "281348": "Hospital Universitario Rey Juan Carlos",
    "281445": "Hospital de Emergencias Enfermera Isabel Zendal",
    # accents / proper names
    "280029": "Hospital Universitario Ramón y Cajal",
    "280421": "Hospital Universitario Fundación Jiménez Díaz",
    "281203": "Hospital Universitario Quirónsalud Madrid",
    "281113": "Hospital MD Anderson Cancer Center Madrid",
    "281071": "Hospital Universitario Fundación Alcorcón",
    "281258": "Hospital Universitario Infanta Sofía",
    "281090": "Hospital Universitario HM Montepríncipe",
    "280360": "Hospital Beata María Ana",
    "280724": "Hospital Central de la Defensa Gómez Ulla",
    "281049": "Hospital Universitario HLA Moncloa",
    "280357": "Hospital Quirónsalud San José",
    "281124": "Hospital Quirónsalud Sur",
    "281456": "Hospital Quirónsalud Valle del Henares",
    "280626": "Hospital HM Nuevo Belén",
    "280262": "Hospital Psiquiátrico Doctor Rodríguez Lafora",
    "281371": "Hospital HM Vallés",
    "280761": "Hospital de la Fuenfría",
    "280416": "Fundación Instituto San José",
    "281383": "Fraternidad-Muprespa (Mutua Colaboradora con la Seguridad Social nº 275)",
    "281478": "ALM Univass",
    "280344": "Hospital de la V.O.T. de San Francisco de Asís",
    "280091": "Hospital Virgen de la Torre",
    "280936": "Hospital Virgen de la Poveda",
    "280856": "Hospital Fremap Majadahonda",
}
LEGAL_SUFFIX = re.compile(r",?\s+S\.?\s?[AL]\.?$")  # "Clínica La Luz, S.L." → "Clínica La Luz"


def display_name(code: str, catalogue_name: str) -> str:
    return DISPLAY_NAMES.get(code) or LEGAL_SUFFIX.sub("", catalogue_name.strip())

EXCLUDE = re.compile(r"universidad|university|universitat|facultad|faculty|campus|\bceu\b|instituto de salud carlos iii|cnio|cnic\b|csic|ivi\b")


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9+]+", " ", s).strip()


def is_madrid(loc: dict) -> bool:
    if loc.get("country") != "Spain":
        return False
    state, city = norm(loc.get("state", "")), norm(loc.get("city", ""))
    return "madrid" in state or "madrid" in city or city in MADRID_MUNICIPALITIES


NON_HOSPITAL = re.compile(r"^(cap|cs|centro de salud|consultorio|residencia)\b")


def match_site(facility: str):
    f = norm(facility)
    if not f or PLACEHOLDER.match(f):
        return None, "placeholder"
    if NON_HOSPITAL.match(f):  # primary-care centres and nursing homes named after a hospital or district
        return None, "non_hospital"
    if "?" in (facility or "") and (facility or "").count("?") <= 4:
        # each '?' stands for one accented letter (MARA??N = Marañón)
        for combo in itertools.product("aeioun", repeat=facility.count("?")):
            fixed = facility
            for ch in combo:
                fixed = fixed.replace("?", ch, 1)
            code, outcome = match_site(fixed)
            if code:
                return code, outcome
    for code, rx in ALIASES:
        if rx.search(f):
            # a university faculty merely mentioning a hospital name is still not the hospital
            if EXCLUDE.search(f) and not re.search(r"hosp|clinic", f):
                return None, "non_hospital"
            return code, "matched"
    if EXCLUDE.search(f):
        return None, "non_hospital"
    return None, "unmatched"


def load_cnh():
    wb = openpyxl.load_workbook(CNH_FILE, read_only=True)
    directory = list(wb["DIRECTORIO DE HOSPITALES"].iter_rows(values_only=True))
    head = directory[0]
    rows = [dict(zip(head, r)) for r in directory[1:] if r[head.index("Provincia")] == "Madrid"]
    struct = list(wb["ESTRUCTURA FUNCIONAL"].iter_rows(values_only=True))
    shead = struct[0]
    equipment, complex_of = {}, {}
    for r in struct[1:]:
        r = dict(zip(shead, r))
        eq = {}
        for col, (key, _) in EQUIPMENT.items():
            v = r.get(col)
            eq[key] = int(v) if v not in (None, "", "DC") and str(v).isdigit() else None
        equipment[r["CODCNH"]] = eq
        if r.get("TAC") == "DC" and r.get("CODIDCOM"):
            complex_of[r["CODCNH"]] = r["CODIDCOM"]
    # "DC" = reported at hospital-complex level (e.g. Complejo Hospitalario La Paz). Attribute the
    # complex's equipment to its largest member hospital; the other members keep None.
    beds = {r["CODCNH"]: int(r["CAMAS"] or 0) for r in rows}
    members = defaultdict(list)
    for code, cx in complex_of.items():
        members[cx].append(code)
    equipment_scope = {}
    for cx, codes in members.items():
        main = max(codes, key=lambda c: beds.get(c, 0))
        equipment[main] = equipment.get(cx, {})
        equipment_scope[main] = "complex"
    return rows, equipment, equipment_scope


def fetch_ctgov():
    studies, token = [], None
    while True:
        q = {"query.locn": "Madrid, Spain", "filter.advanced": "AREA[StudyType]INTERVENTIONAL",
             "pageSize": "1000", "fields": CT_FIELDS, "format": "json"}
        if token:
            q["pageToken"] = token
        url = "https://clinicaltrials.gov/api/v2/studies?" + urllib.parse.urlencode(q)
        page = json.load(urllib.request.urlopen(url, timeout=180))
        studies += page["studies"]
        print(f"  fetched {len(studies)} studies", flush=True)
        token = page.get("nextPageToken")
        if not token:
            break
    CT_FILE.write_text(json.dumps(studies))
    return studies


def therapeutic_areas(mesh_ancestors, mesh_terms):
    names = set(mesh_ancestors) | set(mesh_terms)
    return sorted({area for term, area in THERAPEUTIC_AREAS if term in names})


EU_ID = re.compile(r"(?<!\d)((?:19|20)\d{2})[- ](\d{6})[- ](\d{2})(?:[- ](\d{2}))?(?!\d)")


def eu_ids(protocol: dict) -> list[str]:
    """EudraCT / EU CT numbers that ClinicalTrials.gov lists as secondary ids — the join key to REec.
    CT.gov sometimes puts the number in 'domain', writes it with spaces, or glues a prefix to it
    ('EUCT2022-…', 'EudraCT 2007-…'), so scan both fields and normalise."""
    out = set()
    ident = protocol.get("identificationModule", {})
    for i in [ident.get("orgStudyIdInfo") or {}, *ident.get("secondaryIdInfos", [])]:
        for field in ("id", "domain"):
            for y, n, c, suffix in EU_ID.findall(i.get(field) or ""):
                out.add(f"{y}-{n}-{c}" + (f"-{suffix}" if suffix else ""))
    return sorted(out)


def _key(registry_id: str) -> str:
    # First 14 chars: a full EudraCT number, or an EU CT number without its -00/-01 suffix, which
    # registries use inconsistently. EudraCT and EU CT number spaces never collide.
    return registry_id[:14]


def _absorb(t: dict, r: dict, stats: Counter) -> None:
    """Folds trial record r (REec) into t: union of sites and ids, fill gaps, never downgrade t."""
    t["sources"] = sorted(set(t["sources"]) | set(r["sources"]))
    t["registryIds"] = list(dict.fromkeys(t["registryIds"] + r["registryIds"]))
    have = {s["siteId"]: s for s in t["sites"]}
    for s in r["sites"]:
        if s["siteId"] not in have:
            t["sites"].append(dict(s))
            stats["sites_added_from_reec"] += 1
        elif not have[s["siteId"]]["status"] and s["status"]:
            have[s["siteId"]]["status"] = s["status"]
    for field in ("phases", "ages", "areas", "conditions"):
        if not t[field] and r[field]:
            t[field] = r[field]
    # CT.gov UNKNOWN = stale record; only a final REec status is clearly more reliable
    if t["status"] in (None, "UNKNOWN") and r["status"] in ("COMPLETED", "TERMINATED"):
        t["status"] = r["status"]
        stats["status_from_reec"] += 1


# Tokens that look like codes but name genes, biomarkers, units or diseases — not identifying.
GENERIC_CODE = re.compile(
    r"^(COVID-?19|SARS-?COV-?2|H1N1|HER-?2|PD-?L1|PD-?1|CD\d+[A-Z]?|\d+MG|\d+-?WEEKS?|PHASE-?\d\w?|IGG\d?|IGA\d?|IL-?\d+\w?|"
    r"T2D|T1D|ROS-?1|ALK-?\d?|FGFR\d?|NTRK\d?|KRAS|G12[CDV]|EGFR\w*|BRAF|V600E?|PIK3CA|BRCA\d|TP53|P53|BCR-?ABL\d?|HLA-?\w+|"
    r"FLT3|IDH\d|JAK\d|BTK|CDK\d+(/\d+)?|HIV-?\d|HBV|HCV|COPD|NSCLC|SCLC|AML|CLL|CML|MDS|ALS|SMA|RSV|NASH|MASH|1L|2L|3L|"
    r"HER-?2-?(NEGATIVE|POSITIVE|LOW|ULTRALOW)|HR-?(POSITIVE|NEGATIVE)|ER-?(POSITIVE|NEGATIVE))$"
)
EXTENSION = re.compile(r"\b(extension|long[- ]term|follow[- ]?up|ltfu|roll[- ]?over|open[- ]label extension|ole|maintenance|continuation)\b", re.I)


def _code_tokens(title: str) -> set[str]:
    """Drug / protocol codes in a title (contain letters and digits), e.g. ABX464, CK-2127107."""
    toks = set()
    for w in re.findall(r"[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9]", title or ""):
        w = w.upper()
        if len(w) >= 4 and re.search(r"[A-Z]", w) and re.search(r"\d", w) and not GENERIC_CODE.match(w):
            toks.add(w.replace("-", ""))  # CYP-001 == CYP001
    return toks


def _words(title: str) -> set[str]:
    return {w for w in norm(title).split() if len(w) >= 3}


def _jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


# Pairs that look alike but are different studies (verified by hand).
NOT_DUPLICATES = {
    ("2015-001859-67", "NCT01866111"), ("2015-004222-34", "NCT03070392"), ("2025-521971-29-00", "NCT04919811"),
    ("2022-502812-35-00", "NCT05276063"), ("2020-002595-12", "NCT05063318"), ("2025-520743-33-00", "NCT05547321"),
    ("2022-502145-10-00", "NCT06757634"), ("2015-004060-11", "NCT02606305"), ("2024-510658-28-00", "NCT05126303"),
}
# Verified pairs the automatic rules cannot find (different titles / codes).
KNOWN_LINKS = {"2024-514746-36-00": "NCT05547321", "2020-002595-12": "NCT05072106", "2015-004060-11": "NCT02631876"}

ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5}
STUDY_NO = re.compile(r"\b([A-Z][A-Z]{3,})[- ]?(\d{1,2}|IV|V|I{1,3})\b")


def _study_numbers(title: str) -> dict[str, set[int]]:
    """Numbered study names in a title, e.g. VIKTORIA-1 → {'VIKTORIA': {1}}, FORWARD II → {'FORWARD': {2}}."""
    out: dict[str, set[int]] = defaultdict(set)
    for stem, num in STUDY_NO.findall(title or ""):
        if stem in {"PHASE", "PART", "STAGE", "COHORT", "ARM", "TYPE", "GRADE", "STEP", "WEEK", "YEAR", "DAY", "LINE"}:
            continue
        out[stem].add(ROMAN.get(num) or int(num) if num.isdigit() or num in ROMAN else 0)
    return out


def _numbered_sisters(a: str, b: str) -> bool:
    """True when both titles name the same study series with different numbers (sister studies)."""
    na, nb = _study_numbers(a), _study_numbers(b)
    return any(stem in nb and not (na[stem] & nb[stem]) for stem in na)


def merge_reec(trials: list[dict], reec_trials: list[dict]) -> tuple[dict, list]:
    """Adds REec's Madrid sites to matching ClinicalTrials.gov trials and appends REec-only trials.

    Matching, most to least certain: (1) shared EudraCT / EU CT number; (2) the same, after linking
    transitioned EU CT ↔ EudraCT numbers through CTIS; (3) a conservative title match (shared drug code,
    shared Madrid hospital, start within a year, similar title, exactly one candidate). REec records left
    over are de-duplicated against each other before being added."""
    stats: Counter = Counter()
    index: dict[str, list[dict]] = defaultdict(list)

    def add_index(t):
        for i in t["registryIds"]:
            if not i.startswith("NCT") and not any(x is t for x in index[_key(i)]):
                index[_key(i)].append(t)

    def best(cands, r):
        sites = {s["siteId"] for s in r["sites"]}
        return max(cands, key=lambda t: len(sites & {s["siteId"] for s in t["sites"]}))

    for t in trials:
        add_index(t)

    # (1) registry ids. Newest REec record first so a -01 resubmission is kept over -00.
    pending = []
    for r in sorted(reec_trials, key=lambda r: r["id"], reverse=True):
        cands = index.get(_key(r["id"]))
        if cands:
            t = best(cands, r)
            _absorb(t, r, stats)
            add_index(t)
            stats["merged_by_registry_id"] += 1
        else:
            pending.append(r)

    # (2) CTIS link for transitioned trials, in both directions
    lookup = [r["id"] for r in pending] + [
        i for t in trials if "ctgov" in t["sources"]
        for i in t["registryIds"] if ctis_link.is_euct(i) and not any(not ctis_link.is_euct(x) and not x.startswith("NCT") for x in t["registryIds"])
    ]
    link = ctis_link.eudract_map(lookup, CTIS_MAP)
    for t in trials:
        for i in list(t["registryIds"]):
            e = link.get(i)
            if e and e not in t["registryIds"]:
                t["registryIds"].append(e)
        add_index(t)
    still = []
    for r in pending:
        e = link.get(r["id"])
        if e:
            r["registryIds"].append(e)
        cands = index.get(_key(r["id"])) or (index.get(_key(e)) if e else None)
        if cands:
            t = best(cands, r)
            _absorb(t, r, stats)
            add_index(t)
            stats["merged_via_ctis_link"] += 1
        else:
            still.append(r)

    # (2b) hand-verified links
    by_nct = {t["id"]: t for t in trials}
    rest = []
    for r in still:
        t = by_nct.get(KNOWN_LINKS.get(r["id"], ""))
        if t:
            _absorb(t, r, stats)
            add_index(t)
            stats["merged_known_link"] += 1
        else:
            rest.append(r)
    still = rest

    # (3) title match against CT.gov trials that list no EU number at all. A candidate must share a Madrid
    # hospital and either a drug code + similar title, or a near-identical title. Each CT.gov trial can absorb
    # at most one REec record this way (it then carries an EU id and drops out of the candidate pool).
    def only_nct(t):
        return len(t["registryIds"]) == 1 and t["registryIds"][0].startswith("NCT")

    by_token: dict[str, list[dict]] = defaultdict(list)
    for t in trials:
        if only_nct(t):
            title = f'{t["title"]} {t.get("_officialTitle") or ""}'
            for tok in _code_tokens(title) | {w for w in _words(title) if len(w) >= 6}:
                by_token[tok].append(t)
    by_token = {k: v for k, v in by_token.items() if len(v) <= 40}  # common words/codes are not identifying
    title_pairs = []
    leftover = []
    for r in still:
        r_sites = {s["siteId"] for s in r["sites"]}
        r_title = f'{r["title"]} {r.get("_officialTitle") or ""}'
        r_word_sets = [w for w in (_words(r["title"]), _words(r.get("_officialTitle") or "")) if w]
        r_words = set().union(*r_word_sets) if r_word_sets else set()
        r_codes = _code_tokens(r_title)
        r_ext = bool(EXTENSION.search(r_title))
        # CTIS transitions reset REec's start date, so allow a wider window for EU CT numbers
        window = 5 if ctis_link.is_euct(r["id"]) else 1
        cands = {id(t): t for tok in r_codes | {w for w in r_words if len(w) >= 6} for t in by_token.get(tok, [])}.values()
        ok = []
        for t in cands:
            if not only_nct(t) or (r["id"], t["id"]) in NOT_DUPLICATES:
                continue
            if not r_sites & {s["siteId"] for s in t["sites"]}:
                continue
            t_title = f'{t["title"]} {t.get("_officialTitle") or ""}'
            sim = max(_jaccard(a, b) for a in r_word_sets for b in (_words(t["title"]), _words(t.get("_officialTitle") or ""))) if r_word_sets else 0.0
            if r["startYear"] and t["startYear"] and abs(r["startYear"] - t["startYear"]) > window and sim < 0.95:
                continue  # an (almost) identical scientific title overrides the date window
            if r_ext != bool(EXTENSION.search(t_title)):
                continue  # extension / follow-up study vs its parent
            if r["phases"] and t["phases"] and not set(r["phases"]) & set(t["phases"]):
                continue
            if _numbered_sisters(r_title, t_title):
                continue  # VIKTORIA-1 vs VIKTORIA-2
            if r["startYear"] and t.get("completionYear") and r["startYear"] > t["completionYear"]:
                continue  # REec trial began after the CT.gov trial had finished
            shared_code = bool(r_codes & _code_tokens(t_title))
            if (shared_code and sim >= 0.5) or sim >= 0.8:
                ok.append((sim, t))
        ok.sort(key=lambda x: -x[0])
        # unambiguous: exactly one candidate, or a clear winner
        if ok and (len(ok) == 1 or ok[0][0] - ok[1][0] >= 0.2):
            t = ok[0][1]
            _absorb(t, r, stats)
            add_index(t)
            title_pairs.append((r["id"], t["id"]))
            stats["merged_by_title"] += 1
        else:
            leftover.append(r)

    # REec-only: collapse duplicates among themselves, then append
    for r in leftover:
        cands = [t for i in r["registryIds"] for t in index.get(_key(i), [])]
        if cands:
            _absorb(cands[0], r, stats)
            add_index(cands[0])
            stats["reec_duplicates_collapsed"] += 1
            continue
        trials.append(r)
        add_index(r)
        stats["reec_only_trials"] += 1
    return dict(stats), title_pairs


def year(d):
    return int(d[:4]) if d else None


MADRID_MUNICIPALITIES = set()


def main():
    refresh = "--refresh" in sys.argv
    print("Loading hospital catalogue…")
    cnh_rows, equipment, equipment_scope = load_cnh()
    MADRID_MUNICIPALITIES.update(norm(r["Municipio"]) for r in cnh_rows)
    MADRID_MUNICIPALITIES.update({"aravaca", "pozuelo", "alcobendas", "las rozas", "tres cantos", "pau de sanchinarro", "vallecas"})

    print("Loading ClinicalTrials.gov…")
    studies = fetch_ctgov() if refresh or not CT_FILE.exists() else json.loads(CT_FILE.read_text())
    units = {k: v for k, v in json.loads(UNITS_FILE.read_text()).items() if not k.startswith("_")}

    site_trials = defaultdict(list)
    trials = []
    stats = Counter()
    unmatched = Counter()

    for s in studies:
        p = s["protocolSection"]
        if p.get("designModule", {}).get("studyType") != "INTERVENTIONAL":
            continue
        locs = [l for l in p.get("contactsLocationsModule", {}).get("locations", []) if is_madrid(l)]
        sites = {}
        for l in locs:
            stats["madrid_location_rows"] += 1
            code, outcome = match_site(l.get("facility"))
            stats[outcome] += 1
            if outcome == "unmatched":
                unmatched[l.get("facility")] += 1
            if code:
                sites[code] = (l.get("status") or "").upper() or None
        # trials whose Madrid sites are all placeholders ("Research Site") are kept for now:
        # REec may know the real hospitals. Still-siteless trials are dropped after the merge.
        derived = s.get("derivedSection", {}).get("conditionBrowseModule", {})
        mesh = [m["term"] for m in derived.get("meshes", [])]
        ancestors = [a["term"] for a in derived.get("ancestors", [])]
        sm, dm, em = p["statusModule"], p.get("designModule", {}), p.get("eligibilityModule", {})
        sponsor = p.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {})
        nct = p["identificationModule"]["nctId"]
        rp = p.get("sponsorCollaboratorsModule", {}).get("responsibleParty", {})
        person_sponsor = (
            sponsor.get("class") == "INDIV"
            or (rp.get("type") == "SPONSOR_INVESTIGATOR" and norm(rp.get("investigatorFullName") or "") == norm(sponsor.get("name") or ""))
            or reec.is_person_sponsor(sponsor.get("name"))
        )
        trial = {
            "id": nct,
            "title": p["identificationModule"].get("briefTitle"),
            "_officialTitle": p["identificationModule"].get("officialTitle"),
            "status": sm.get("overallStatus"),
            "whyStopped": sm.get("whyStopped"),
            "phases": dm.get("phases") or [],
            "startYear": year(sm.get("startDateStruct", {}).get("date")),
            "completionYear": year(sm.get("completionDateStruct", {}).get("date")),
            "enrollment": dm.get("enrollmentInfo", {}).get("count"),
            "sponsor": "Investigator-initiated" if person_sponsor else sponsor.get("name"),
            "sponsorClass": "OTHER" if person_sponsor or sponsor.get("class") == "INDIV" else sponsor.get("class"),
            "conditions": p.get("conditionsModule", {}).get("conditions", []),
            "mesh": mesh,
            "meshAncestors": ancestors,
            "areas": therapeutic_areas(ancestors, mesh),
            "ages": em.get("stdAges", []),
            "sites": [{"siteId": c, "status": st} for c, st in sites.items()],
            "sources": ["ctgov"],
            "registryIds": [nct, *eu_ids(p)],
        }
        trials.append(trial)

    print("Loading REec…")
    reec.fetch(REEC_DIR, refresh=refresh)  # cached files are skipped; resumes an interrupted detail download
    reec_trials, reec_stats = reec.load_trials(REEC_DIR, match_site, {r["CODCNH"] for r in cnh_rows})
    if reec_stats["missing_detail"]:
        print(f"WARNING: {reec_stats['missing_detail']} REec trials lack detail (no phase/area/age). Re-run to resume", file=sys.stderr)
    merge_stats, title_pairs = merge_reec(trials, reec_trials)
    for t in trials:
        t.pop("_officialTitle", None)
    for r in reec_trials:
        r.pop("_officialTitle", None)
    stats["trials_without_attributable_site"] = sum(1 for t in trials if not t["sites"])
    trials = [t for t in trials if t["sites"]]
    for t in trials:
        for s in t["sites"]:
            site_trials[s["siteId"]].append(t["id"])

    print("Enriching hospitals (geo, photos, SERMAS activity, CEIm)…")
    for mod in (geo, sermas, ceim, images):
        mod.fetch(refresh)
    site_geo, geo_report = geo.build(cnh_rows)
    site_activity, activity_report = sermas.build(cnh_rows)
    site_ceim, ceim_report = ceim.build(cnh_rows)
    display = {r["CODCNH"]: display_name(r["CODCNH"], r["Nombre Centro"]) for r in cnh_rows}
    site_image, image_report = images.build(cnh_rows, site_geo, display)

    out_sites = []
    for r in cnh_rows:
        code = r["CODCNH"]
        unit = units.get(code, {})
        public = r["Dependencia Funcional"] != "Privados"
        out_sites.append({
            "id": code,
            "name": display[code],
            "catalogueName": r["Nombre Centro"],
            "municipality": r["Municipio"],
            "address": r["Dirección"],
            "postcode": r["Código Postal"],
            "phone": r["Teléfono"] if (r["Teléfono"] or "").strip("0 ") else None,
            "beds": int(r["CAMAS"] or 0),
            "hospitalClass": r["Clase de Centro"],
            "ownership": "public" if public else "private",
            "funding": r["Dependencia Funcional"],
            "complex": r["Nombre del Complejo"],
            "equipment": equipment.get(code, {}),
            "equipmentScope": equipment_scope.get(code, "hospital"),
            "researchUnit": unit or None,
            "trialCount": len(site_trials.get(code, [])),
            # enrichments: always present, null when the source has nothing for this hospital
            "geo": site_geo.get(code),
            "image": site_image.get(code),
            "activity": site_activity.get(code),
            "ceim": site_ceim.get(code),
        })
    out_sites.sort(key=lambda s: -s["trialCount"])

    # Guard: no personal data may reach the app's data files.
    email = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
    leaked = [t["id"] for t in trials if t["sponsor"] and (reec.is_person_sponsor(t["sponsor"]) or email.search(t["sponsor"]))]
    if leaked:
        raise SystemExit(f"Personal data guard: person-like sponsor names in {leaked[:10]}")
    # The only email allowed in the output is a CEIm committee mailbox (never a named person); it is checked again here
    # and removed from the copy the generic email scan looks at.
    scan = json.loads(json.dumps(out_sites))
    for s_ in scan:
        c = s_.get("ceim") or {}
        if c.get("email") and ceim.committee_mailbox(c["email"]) != c["email"]:
            raise SystemExit(f"Personal data guard: non-committee CEIm email for {s_['id']}")
        if c:
            if c.get("basis") == "default" and (c.get("email") or c.get("source")):
                raise SystemExit(f"CEIm guard: inferred (default) committee carries a source/mailbox for {s_['id']}")
            c["email"] = None
            if set(c) - {"name", "ownCommittee", "ctisEvaluator", "fastTrack", "slots", "slotsFull", "email", "basis",
                         "source", "note"}:
                raise SystemExit(f"Personal data guard: unexpected CEIm fields for {s_['id']}: {sorted(c)}")
        if c.get("source") and not re.fullmatch(r"https?://\S+", c["source"]):
            raise SystemExit(f"Source guard: CEIm source is not a plain URL for {s_['id']}")
        a = s_.get("activity") or {}
        if a.get("source") and not re.fullmatch(r"https?://\S+", a["source"]):
            raise SystemExit(f"Source guard: activity source is not a plain URL for {s_['id']}")
        # Photo attribution is the ONE place a person's name may appear (Commons licences require it; see README).
        # Only the known attribution fields are allowed, and the author must not carry contact details.
        im = s_.get("image") or {}
        if im and set(im) - {"url", "thumbUrl", "author", "license", "licenseUrl", "sourcePage"}:
            raise SystemExit(f"Personal data guard: unexpected image fields for {s_['id']}: {sorted(im)}")
        if im and (email.search(im.get("author") or "") or re.search(r"\+?\d[\d ]{7,}", im.get("author") or "")):
            raise SystemExit(f"Personal data guard: contact details in photo author for {s_['id']}")
    if email.search(json.dumps(trials)) or email.search(json.dumps(scan)):
        raise SystemExit("Personal data guard: email address found in output")
    if re.search(r"responsable|investigador|nombre_", json.dumps([[s_.get("ceim"), s_.get("activity"), s_.get("image")]
                                                                 for s_ in out_sites])):
        raise SystemExit("Personal data guard: person-related field in CEIm / activity data")
    # diagnostic lists keep organisation names only
    unmatched = Counter({k: v for k, v in unmatched.items() if not reec.is_person_sponsor(k)})
    reec_stats["topUnmatched"] = [(k, v) for k, v in reec_stats["topUnmatched"] if not reec.is_person_sponsor(k.split(" [")[0])]

    OUT.mkdir(exist_ok=True)

    # --- report: per-source fetch times (from the raw cache files, i.e. when each source was last downloaded) ---
    from datetime import datetime, timezone

    def fetched_at(*paths) -> str | None:
        times = []
        for p_ in paths:
            p_ = Path(p_)
            if p_.is_dir():
                times += [f.stat().st_mtime for f in p_.iterdir() if f.is_file()]
            elif p_.exists():
                times.append(p_.stat().st_mtime)
        return datetime.fromtimestamp(max(times), timezone.utc).isoformat(timespec="seconds") if times else None

    built_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    source_details = {
        "reec": {"fetchedAt": fetched_at(REEC_DIR), "url": "https://reec.aemps.es/reec/public/web.html",
                 "datasetUrl": reec.BASE},
        "ctgov": {"fetchedAt": fetched_at(CT_FILE), "url": "https://clinicaltrials.gov/",
                  "datasetUrl": "https://clinicaltrials.gov/data-api/api"},
        "ctis": {"fetchedAt": fetched_at(CTIS_MAP), "url": "https://euclinicaltrials.eu/search-for-clinical-trials/",
                 "datasetUrl": "https://euclinicaltrials.eu/"},
        "catalogue": {"fetchedAt": fetched_at(CNH_FILE),
                      "url": "https://www.sanidad.gob.es/estadEstudios/estadisticas/sisInfSanSNS/ofertaRecursos/hospitales/home.htm",
                      "datasetUrl": "https://www.sanidad.gob.es/estadEstudios/estadisticas/sisInfSanSNS/ofertaRecursos/hospitales/home.htm"},
        "isciii": {"fetchedAt": fetched_at(UNITS_FILE), "url": "https://www.isciii.es/",
                   "datasetUrl": "https://www.isciii.es/documents/d/guest/iis-acreditados_centros_feb_2026-1-?download=true"},
        "sermas": {"fetchedAt": fetched_at(sermas.RAW / "manifest.json"), "url": sermas.INDEX_URL, "datasetUrl": sermas.INDEX_URL},
        "ceim": {"fetchedAt": fetched_at(ceim.RAW),
                 "url": "https://www.aemps.gob.es/medicines-for-human-use/research-with-medicines-for-human-use/ceim-committed-to-ctis-procedure/?lang=es",
                 "datasetUrl": f"{ceim.BASE}/ceimbyccaa?ccaa=13"},
        "geo": {"fetchedAt": fetched_at(geo.REGISTER_FILE), "url": geo.REGISTER_PAGE, "datasetUrl": geo.REGISTER_PAGE},
        "commons": {"fetchedAt": fetched_at(images.CACHE_FILE), "url": "https://commons.wikimedia.org/",
                    "datasetUrl": "https://www.wikidata.org/wiki/Property:P18"},
        "osm": {"fetchedAt": fetched_at(geo.NOMINATIM_CACHE), "url": "https://www.openstreetmap.org/copyright",
                "datasetUrl": "https://nominatim.openstreetmap.org/"},
    }

    # Atomic writes: each file is written to a temp file and renamed into place, so the app never reads half-written JSON
    # (it keeps serving the previous dataset until all three files parse).
    def write_atomic(path: Path, text: str) -> None:
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(text)
        os.replace(tmp, path)

    write_atomic(OUT / "sites.json", json.dumps(out_sites, ensure_ascii=False, indent=1))
    write_atomic(OUT / "trials.json", json.dumps(trials, ensure_ascii=False))
    report = {
        "builtOn": date.today().isoformat(),
        "builtAt": built_at,
        "sourceDetails": source_details,
        "sources": {
            "hospitalCatalogue": "Catálogo Nacional de Hospitales 2025 (Ministerio de Sanidad), data as of 31 Dec 2024",
            "trials": "ClinicalTrials.gov API v2, interventional studies with a Comunidad de Madrid site",
            "reec": "REec (AEMPS) REST service: medicines trials authorised in Spain with a Madrid site",
            "researchInstitutes": "ISCIII list of accredited Institutos de Investigación Sanitaria (updated May 2026)",
            "geo": f"{geo.REGISTER_PAGE} (UTM ETRS89 30N → WGS84), cross-checked with OpenStreetMap Nominatim",
            "images": "Wikimedia Commons via Wikidata P18; free licences only (CC0 / CC BY / CC BY-SA / public domain)",
            "activity": f"SERMAS hospital annual reports, open data {activity_report['year']} ({sermas.INDEX_URL})",
            "ceim": f"AEMPS directory of accredited CEIm ({ceim.BASE}), checked {ceim_report['checkedOn']}",
        },
        "enrichment": {
            "coverage": {
                "geo": f"{sum(1 for s_ in out_sites if s_['geo'])}/{len(out_sites)}",
                "image": f"{sum(1 for s_ in out_sites if s_['image'])}/{len(out_sites)}",
                "activity": f"{sum(1 for s_ in out_sites if s_['activity'])}/{len(out_sites)} "
                            f"({sum(1 for s_ in out_sites if s_['ownership'] == 'public')} public-funded in catalogue)",
                "ceim": f"{ceim_report['sourced']} sourced (own or complex committee) + {ceim_report['defaultInferred']} "
                        f"inferred CEIm Regional default, of {len(out_sites)}",
            },
            "geo": geo_report,
            "images": image_report,
            "activity": activity_report,
            "ceim": ceim_report,
        },
        "trialsBySource": dict(Counter("+".join(t["sources"]) for t in trials)),
        "reec": {**{k: v for k, v in reec_stats.items() if k != "topUnmatched"}, **merge_stats},
        "reecTopUnmatched": reec_stats["topUnmatched"],
        "mergedByTitle": title_pairs,
        "hospitals": len(out_sites),
        "hospitalsWithTrials": sum(1 for s in out_sites if s["trialCount"]),
        "trials": len(trials),
        "locationMatching": dict(stats),
        "topUnmatchedFacilities": unmatched.most_common(60),
    }
    write_atomic(OUT / "build_report.json", json.dumps(report, ensure_ascii=False, indent=1))
    print(json.dumps({k: v for k, v in report.items() if k != "topUnmatchedFacilities"}, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
