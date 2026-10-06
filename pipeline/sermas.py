"""
Hospital activity from the SERMAS (Servicio Madrileño de Salud) annual reports, open-data version.

Index page: https://www.comunidad.madrid/servicios/salud/memorias-e-informes-servicio-madrileno-salud
Each year has a table "Memorias de la red de hospitales año YYYY" with one "datos abiertos" ZIP of xlsx files per
hospital. We take the latest year that has the per-hospital table and extract, per hospital:
  - outpatient first visits and total visits per specialty  (sheet "Consultas Externas", ESPECIALIDAD × Primeras / Total)
  - discharges                                                (row "Altas totales", column of the report year)
  - industry-funded research projects, new and active        (row "Financiados/promovidos por la industria",
                                                               columns Nuevos / Previos activos / Total; active = Total)
Only these aggregate counts are read: the research sheets also list project titles and investigators, which we never
touch. Private hospitals outside the SERMAS network have no report → null.

Reports that cover a hospital complex (La Paz + Carlos III + Cantoblanco, Infanta Leonor + Virgen de la Torre) are
attributed to the main hospital only, so no activity is counted twice; `reportName` says what the figures cover.

fetch(refresh) → raw/sermas/<year>/*.zip + manifest.json; build(cnh_rows) → ({CODCNH: SiteActivity}, report).
"""

import html
import io
import json
import re
import time
import unicodedata
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path

import openpyxl

RAW = Path(__file__).resolve().parent / "raw" / "sermas"
INDEX_URL = "https://www.comunidad.madrid/servicios/salud/memorias-e-informes-servicio-madrileno-salud"
UA = "Mozilla/5.0 (compatible; SoleraDataPipeline/1.0; open-data build script)"

# Centre name as published in the SERMAS table (normalised) → catalogue code (CODCNH). Names differ from the catalogue,
# so this is explicit; an unknown centre stops the build until it is added here.
CENTRES = {
    "hospital central de la cruz roja": "280148",
    "hospital central de la defensa gomez ulla": "280724",
    "hospital clinico san carlos": "280072",
    "hospital asociado universitario guadarrama": "280800",
    "hospital de la fuenfria": "280761",
    "hospital universitario dr rodriguez lafora": "280262",
    "hospital el escorial": "280920",
    "hospital fundacion jimenez diaz": "280421",
    "hospital general universitario gregorio maranon": "280246",
    "hospital universitario general de villalba": "281359",
    "hospital infantil universitario nino jesus": "280133",
    "hospital universitario 12 de octubre": "280035",
    "hospital universitario de fuenlabrada": "281146",
    "hospital universitario de getafe": "280989",
    "hospital universitario de la princesa": "280127",
    "hospital universitario de mostoles": "280894",
    "hospital universitario de torrejon": "281337",
    "hospital universitario del henares": "281269",
    "hospital universitario del sureste": "281281",
    "hospital universitario del tajo": "281292",
    "hospital universitario fundacion alcorcon": "281071",
    "hospital universitario infanta cristina": "281304",
    "hospital universitario infanta elena": "281236",
    "hospital universitario infanta leonor virgen de la torre": "281270",
    "hospital universitario infanta sofia": "281258",
    # two catalogue rows (C/ Aragón 17, 134 beds and C/ Luna 1, 41 beds): figures go to the main site
    "hospital universitario jose germain": "281438",
    "hospital universitario la paz h carlos iii y h cantoblanco": "280014",
    "hospital universitario principe de asturias": "280745",
    "hospital universitario puerta de hierro majadahonda": "281315",
    "hospital universitario ramon y cajal": "280029",
    "hospital universitario rey juan carlos": "281348",
    "hospital universitario santa cristina": "280112",
    "hospital universitario severo ochoa": "280838",
    "hospital asociado universitario virgen de la poveda": "280936",
    "hospital enfermera isabel zendal": "281445",
}
NOT_HOSPITALS = {"unidad central de radiodiagnostico", "centro de transfusion de la comunidad de madrid"}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _http(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def _parse_index(page: str) -> tuple[int, list[dict]]:
    tables = {}
    for m in re.finditer(r"<caption>\s*Memorias de la red de hospitales año (\d{4})\s*</caption>(.*?)</table>", page, re.S):
        centres = []
        for tr in re.findall(r"<tr>(.*?)</tr>", m.group(2), re.S):
            tds = re.findall(r"<td>(.*?)</td>", tr, re.S)
            if not tds:
                continue
            name = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", tds[0]))).strip()
            zips = [u for u in re.findall(r'href="([^"]+\.zip)"', tr)]
            if zips:
                url = zips[0] if zips[0].startswith("http") else "https://www.comunidad.madrid" + zips[0]
                centres.append({"name": name, "url": url})
        if centres:
            tables[int(m.group(1))] = centres
    year = max(tables)
    return year, tables[year]


def fetch(refresh: bool = False) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = RAW / "manifest.json"
    if manifest.exists() and not refresh:
        return
    page = _http(INDEX_URL).decode("utf-8", "replace")
    (RAW / "index.html").write_text(page)
    year, centres = _parse_index(page)
    folder = RAW / str(year)
    folder.mkdir(exist_ok=True)
    for c in centres:
        c["file"] = f"{year}/{c['url'].rsplit('/', 1)[1].split('?')[0]}"
        if refresh or not (RAW / c["file"]).exists():
            (RAW / c["file"]).write_bytes(_http(c["url"]))
            time.sleep(1)
    manifest.write_text(json.dumps({"year": year, "page": INDEX_URL, "centres": centres}, ensure_ascii=False, indent=1))


# --- workbook reading ------------------------------------------------------------------------------------------------
def _num(v) -> int | None:
    if isinstance(v, (int, float)):
        return int(round(v))
    s = str(v or "").replace("\xa0", "").replace(".", "").replace(" ", "").strip()
    return int(s) if s.isdigit() else None


def _label(v) -> str:
    """Row label without footnote markers: 'Altas totales1' → 'Altas totales'."""
    s = re.sub(r"\s+", " ", str(v or "").replace("\xa0", " ")).strip()
    return re.sub(r"[\d*¹²³]+$", "", s).strip()


def _workbooks(zpath: Path, centre_name: str):
    """Yield (filename, rows) for the folder of the ZIP whose cover sheet names this hospital."""
    z = zipfile.ZipFile(zpath)
    folders: dict[str, list[str]] = {}
    for n in z.namelist():
        if n.lower().endswith(".xlsx"):
            folders.setdefault(n.rsplit("/", 1)[0] if "/" in n else "", []).append(n)
    chosen = None
    if len(folders) > 1:  # e.g. the Infanta Elena ZIP also contains Infanta Cristina's folder
        want = set(_norm(centre_name).split()) - {"hospital", "universitario", "de", "del", "la", "h", "y"}
        best = -1
        for d, names in folders.items():
            cover = next((n for n in names if n.rsplit("/", 1)[-1].startswith("1.")), None)
            if not cover:
                continue
            wb = openpyxl.load_workbook(io.BytesIO(z.read(cover)), read_only=True, data_only=True)
            text = _norm(" ".join(str(c) for r in wb.worksheets[0].iter_rows(values_only=True) for c in r if c))
            score = len(want & set(text.split())) - d.count("/") * 0.1
            if score > best:
                best, chosen = score, d
    names = folders[chosen] if chosen is not None else [n for ns in folders.values() for n in ns]
    for n in sorted(names):
        wb = openpyxl.load_workbook(io.BytesIO(z.read(n)), read_only=True, data_only=True)
        for ws in wb.worksheets:
            yield n, ws.title, [list(r) for r in ws.iter_rows(values_only=True)]


def _spans(header: list) -> dict[int, range]:
    """Header column → the columns its value may sit in. Merged header cells (e.g. 'Primeras Consultas' over two columns)
    put the number one column to the right, so a header owns every column up to the next non-empty header."""
    cols = [j for j, c in enumerate(header) if c not in (None, "")]
    return {j: range(j, (cols[k + 1] if k + 1 < len(cols) else j + 2)) for k, j in enumerate(cols)}


def _cell(row: list, span: range | None) -> int | None:
    if span is None:
        return None
    for j in span:
        if j < len(row) and row[j] not in (None, ""):
            return _num(row[j])
    return None


def _outpatients(rows: list[list]) -> tuple[dict, dict] | None:
    for i, r in enumerate(rows):
        low = [_norm(c) for c in r]
        if "especialidad" not in low:
            continue
        first = next((j for j, c in enumerate(low) if c in ("primeras consultas", "consultas primeras")), None)
        total = next((j for j, c in enumerate(low) if c == "total"), None)
        if first is None:
            continue
        spans = _spans(r)
        name_col = low.index("especialidad")
        firsts, totals = {}, {}
        for r2 in rows[i + 1:]:
            name = _label(r2[name_col] if name_col < len(r2) else None)
            if not name:
                if firsts:
                    break
                continue
            if _norm(name) in ("total", "total general", "totales"):
                break
            f = _cell(r2, spans[first])
            if f is None:
                continue
            firsts[name] = f
            t = _cell(r2, spans.get(total))
            if t is not None:
                totals[name] = t
        return (firsts, totals) if firsts else None
    return None


def _year_value(rows: list[list], i: int, year: int) -> int | None:
    """Value of row i in the column headed by `year` (header searched upwards)."""
    for k in range(i, max(-1, i - 8), -1):
        header = rows[k]
        for j, c in enumerate(header):
            if (c == year or str(c).strip() == str(year)) and j < len(rows[i]):
                v = _num(rows[i][j])
                if v is not None:
                    return v
    return None


def _discharges(sheets: list, year: int) -> int | None:
    for _, title, rows in sheets:
        if _norm(title) != "actividad asistencial":
            continue
        for i, r in enumerate(rows):
            if r and _norm(_label(r[0])) == "altas totales":
                return _year_value(rows, i, year)
    return None


def _industry(sheets: list) -> dict | None:
    for _, _, rows in sheets:
        for i, r in enumerate(rows):
            labels = [c for c in r if isinstance(c, str)]
            if not labels or not _norm(labels[0]).startswith("financiados promovidos por la industria"):
                continue
            for k in range(i - 1, max(-1, i - 12), -1):
                low = [_norm(c) for c in rows[k]]
                if "nuevos" in low and "total" in low:
                    spans = _spans(rows[k])
                    new, tot = _cell(r, spans[low.index("nuevos")]), _cell(r, spans[low.index("total")])
                    if new is None and tot is None:
                        return None
                    return {"new": new, "active": tot}
            return None
    return None


def build(cnh_rows: list[dict]) -> tuple[dict[str, dict | None], dict]:
    fetch(False)
    manifest = json.loads((RAW / "manifest.json").read_text())
    year = manifest["year"]
    codes = {r["CODCNH"] for r in cnh_rows}
    out: dict[str, dict | None] = {c: None for c in codes}
    unknown, missing = [], {"firstVisits": [], "discharges": [], "industryStudies": []}
    for c in manifest["centres"]:
        key = _norm(c["name"])
        if key in NOT_HOSPITALS:
            continue
        code = CENTRES.get(key)
        if not code:
            unknown.append(c["name"])
            continue
        if code not in codes:
            raise SystemExit(f"sermas: {c['name']} → {code} is not a Madrid catalogue hospital")
        sheets = list(_workbooks(RAW / c["file"], c["name"]))
        op = next((x for x in (_outpatients(rows) for _, _, rows in sheets) if x), None)
        disch = _discharges(sheets, year)
        industry = _industry(sheets)
        if not op and disch is None and not industry:  # e.g. Isabel Zendal (emergency hospital): nothing usable
            missing["firstVisits"].append(c["name"])
            continue
        for k, v in (("firstVisits", op), ("discharges", disch), ("industryStudies", industry)):
            if v is None:
                missing[k].append(c["name"])
        out[code] = {
            "year": year,
            "source": c["url"],
            "reportName": c["name"],
            "firstVisitsBySpecialty": op[0] if op else {},
            "totalVisitsBySpecialty": op[1] if op and op[1] else None,
            "discharges": disch,
            "industryStudies": industry,
        }
    # one spelling per specialty across hospitals ("Cirugía Máxilofacial" / "Cirugía Maxilofacial", case, spaces)
    spellings: dict[str, Counter] = {}
    for v in out.values():
        for name in (v or {}).get("firstVisitsBySpecialty", {}):
            spellings.setdefault(_norm(name), Counter())[name] += 1
    canon = {name: c.most_common(1)[0][0] for c in spellings.values() for name in c}
    for v in out.values():
        for field in ("firstVisitsBySpecialty", "totalVisitsBySpecialty"):
            if v and v.get(field):
                merged: dict[str, int] = {}
                for name, n in v[field].items():
                    merged[canon.get(name, name)] = merged.get(canon.get(name, name), 0) + n
                v[field] = merged
    if unknown:
        raise SystemExit(f"sermas: add these centres to sermas.CENTRES: {unknown}")
    with_data = [v for v in out.values() if v]
    report = {
        "source": manifest["page"],
        "year": year,
        "hospitalsWithReport": len(with_data),
        "withFirstVisitsBySpecialty": sum(1 for v in with_data if v["firstVisitsBySpecialty"]),
        "withDischarges": sum(1 for v in with_data if v["discharges"] is not None),
        "withIndustryStudies": sum(1 for v in with_data if v["industryStudies"]),
        "missing": missing,
    }
    return out, report
