"""
Hospital photos from Wikimedia Commons, found through Wikidata. Never from hospital websites.

For each catalogue hospital (needs its geo point):
  1. One regional candidate pool from the regular Wikidata search API (`nearcoord:` around Madrid, by hospital class
     and by keyword); the SPARQL endpoint is avoided because it is often rate-limited.
  2. Keep items whose P31 is a hospital-type class (label hospital / clinic / sanatorium / medical centre…) and whose
     coordinates (P625), when present, are within 1.5 km of the hospital. Pick the item whose label best matches the
     hospital's distinctive name words (all of them must be present; extra words such as "Infantil" or "Instituto de
     Investigación" cost points).
  3. Use that item's P18 image. Licence, author and URLs come from the Commons API (imageinfo + extmetadata).
     Only CC0, CC BY, CC BY-SA and public-domain files are accepted. URLs point at Commons (no re-hosting):
     thumbUrl ≈ 640 px requested (Commons
     serves the next standard thumbnail step, currently 960 px), url ≤ 1600 px wide.

Wikimedia User-Agent policy: a descriptive UA is sent; all responses are cached under raw/images/.
fetch(refresh) clears the cache on refresh; build(cnh_rows, geo) → ({CODCNH: SiteImage | None}, report).
"""

import hashlib
import html
import json
import math
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RAW = Path(__file__).resolve().parent / "raw" / "images"
CACHE_FILE = RAW / "api_cache.json"
UA = "SoleraDataPipeline/1.0 (Madrid clinical-trial site search; open-data build script; python-urllib)"
WIKIDATA = "https://www.wikidata.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"
RADIUS_KM = 1.5

FREE = re.compile(r"^(cc0|cc[ -]by(-sa)?( \d\.\d)?( [a-z\-]+)?|public domain|pd[ -].*|pdm.*)$", re.I)
HOSPITAL_TYPE = re.compile(r"hospital|clinic|sanatori|medical (center|centre|facility)|health facility|health care", re.I)
NOT_THE_HOSPITAL = re.compile(r"instituto de investigaci|biblioteca|fundaci[oó]n para la investigaci|estaci[oó]n|metro|"
                              r"escuela|facultad|fuente|estatua|mural", re.I)
GENERIC = {"hospital", "universitario", "universitaria", "general", "clinica", "de", "del", "la", "el", "los", "las", "y",
           "madrid", "s", "a", "l", "sa", "sl", "centro", "asociado", "complejo", "h", "u", "hu", "grupo"}

# Hand-checked overrides: CODCNH → Wikidata item, or None to block an automatic match that is wrong.
OVERRIDES: dict[str, str | None] = {}

# Hand-checked photos that are licensed and attributed correctly but don't show the hospital well enough for a card:
# the site falls back to the no-photo placeholder rather than a misleading image (keyed by CODCNH → Commons file).
REJECTED_PHOTOS: dict[str, tuple[str, str]] = {
    "281315": ("Puerta_de_Hierro_Hospital.jpg", "rooftop view at dusk over Majadahonda; mostly sky and park"),
    "281270": ("(Hospital Universitario Infanta Leonor) Santa Eugenia, Infanta Leonor, Palomeras Sureste. 01 (cropped).JPG",
               "district panorama of Santa Eugenia; the hospital is far in the background"),
    "280246": ("Hospital Gregorio Marañón - IMG659.jpg", "taken during the 2012 general strike; protest banners on the facade"),
}

_cache: dict | None = None
_last = [0.0]


def _get(base: str, params: dict) -> dict:
    global _cache
    if _cache is None:
        _cache = json.loads(CACHE_FILE.read_text()) if CACHE_FILE.exists() else {}
    url = base + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": 2}, doseq=True)
    if url in _cache:
        return _cache[url]
    for attempt in range(7):
        wait = 1.1 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < 6:
                retry = e.headers.get("Retry-After")
                time.sleep(min(int(retry) if retry and retry.isdigit() else 15, 90) + 1)
                continue
            raise
    _last[0] = time.time()
    _cache[url] = data
    _save()
    return data


def _save() -> None:
    if _cache is not None:
        CACHE_FILE.write_text(json.dumps(_cache, ensure_ascii=False))


def fetch(refresh: bool = False) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    if refresh and CACHE_FILE.exists():
        CACHE_FILE.unlink()


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _words(s: str) -> set[str]:
    return {w for w in _norm(s).split() if w not in GENERIC and len(w) > 1}


def _km(a, b) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def _claim_values(ent: dict, prop: str) -> list:
    return [c["mainsnak"].get("datavalue", {}).get("value") for c in ent.get("claims", {}).get(prop, [])
            if c.get("rank") != "deprecated" and c["mainsnak"].get("datavalue")]


def _entities(ids: list[str]) -> dict:
    out = {}
    for i in range(0, len(ids), 50):
        r = _get(WIKIDATA, {"action": "wbgetentities", "ids": "|".join(sorted(ids[i:i + 50])),
                            "props": "labels|claims|aliases", "languages": "es|en"})
        out.update(r.get("entities", {}))
    return out


_type_ok: dict[str, bool] = {}


def _is_hospital_type(qids: list[str]) -> bool:
    todo = [q for q in qids if q not in _type_ok]
    if todo:
        for q, ent in _entities(todo).items():
            labels = " ".join(v["value"] for v in ent.get("labels", {}).values())
            _type_ok[q] = bool(HOSPITAL_TYPE.search(labels))
    return any(_type_ok.get(q) for q in qids)


def _label(ent: dict) -> str:
    labels = ent.get("labels", {})
    return (labels.get("es") or labels.get("en") or {}).get("value", "")


# One candidate pool for the whole region (a handful of requests instead of several per hospital).
REGION_CENTRE, REGION_RADIUS = (40.42, -3.70), "90km"
POOL_QUERIES = [
    "haswbstatement:P31=Q16917",   # hospital
    "haswbstatement:P31=Q1059324",  # university hospital
    "hospital", "clínica", "sanatorio", "hospitales",
]
_pool: dict | None = None


def _candidate_pool() -> dict:
    global _pool
    if _pool is None:
        ids: set[str] = set()
        for q in POOL_QUERIES:
            offset = 0
            while offset is not None and offset < 2000:
                r = _get(WIKIDATA, {"action": "query", "list": "search", "srnamespace": 0, "srlimit": 500,
                                    "sroffset": offset, "srprop": "",
                                    "srsearch": f"{q} nearcoord:{REGION_RADIUS},{REGION_CENTRE[0]},{REGION_CENTRE[1]}"})
                ids.update(x["title"] for x in r.get("query", {}).get("search", []))
                offset = r.get("continue", {}).get("sroffset")
        print(f"  images: {len(ids)} Wikidata candidates in the region")
        _pool = _entities(sorted(ids))
        types = {v.get("id") for e in _pool.values() for v in _claim_values(e, "P31") if isinstance(v, dict)}
        _is_hospital_type(sorted(t for t in types if t))  # one batched lookup of every type's labels
    return _pool


def _candidates(name: str, point: tuple[float, float]) -> dict:
    return _candidate_pool()


def _pick(name: str, point: tuple[float, float]) -> tuple[str, dict, float] | None:
    want = _words(name)
    best = None
    for qid, ent in _candidates(name, point).items():
        label = _label(ent)
        if not label or NOT_THE_HOSPITAL.search(label):
            continue
        p31 = [v.get("id") for v in _claim_values(ent, "P31") if isinstance(v, dict)]
        if not p31 or not _is_hospital_type(p31):
            continue
        coords = [v for v in _claim_values(ent, "P625") if isinstance(v, dict) and "latitude" in v]
        if coords:
            dist = min(_km(point, (c["latitude"], c["longitude"])) for c in coords)
            if dist > RADIUS_KM:
                continue
        else:
            continue  # no coordinates → can't confirm it is this hospital in Madrid
        names = [label] + [a["value"] for lang in ("es", "en") for a in ent.get("aliases", {}).get(lang, [])]
        for n in names:
            got = _words(n)
            if not want or not want <= got:
                continue
            score = len(want) - 0.5 * len(got - want) - dist * 0.2
            if best is None or score > best[2]:
                best = (qid, ent, score)
    return best


def _plain(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def _clean_url(u: str | None) -> str | None:
    """Commons URLs without the utm_* tracking parameters the API appends."""
    if not u:
        return u
    parts = urllib.parse.urlsplit(u)
    q = [(k, v) for k, v in urllib.parse.parse_qsl(parts.query) if not k.startswith("utm_")]
    return urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(q)))


def _commons_image(filename: str) -> dict | None:
    title = "File:" + filename
    r = _get(COMMONS, {"action": "query", "titles": title, "prop": "imageinfo",
                       "iiprop": "url|size|extmetadata", "iiurlwidth": 640})
    pages = r.get("query", {}).get("pages", [])
    if not pages or "imageinfo" not in pages[0]:
        return None
    info = pages[0]["imageinfo"][0]
    meta = {k: v.get("value") for k, v in (info.get("extmetadata") or {}).items()}
    lic = _plain(meta.get("LicenseShortName") or "")
    if not FREE.match(lic):
        return {"rejected": lic or "no licence"}
    url = info["url"]
    if (info.get("width") or 0) > 1600:
        big = _get(COMMONS, {"action": "query", "titles": title, "prop": "imageinfo", "iiprop": "url", "iiurlwidth": 1600})
        url = big["query"]["pages"][0]["imageinfo"][0].get("thumburl") or url
    author = _plain(meta.get("Artist") or "") or _plain(meta.get("Credit") or "") or "Unknown author (see file page)"
    author = re.sub(r"\(\s+", "(", re.sub(r"\s+\)", ")", author))  # "Luis García ( Zaqarbal )" → "(Zaqarbal)"
    return {
        "url": _clean_url(url),
        "thumbUrl": _clean_url(info.get("thumburl") or url),
        "author": author[:200],
        "license": lic,
        "licenseUrl": meta.get("LicenseUrl") or None,
        "sourcePage": info.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(title)}",
    }


def build(cnh_rows: list[dict], geo: dict, names: dict[str, str] | None = None) -> tuple[dict, dict]:
    """geo: {code: {"lat","lon"}}; names: display names (better than catalogue legal names, e.g. 'ID Dalud Móstoles')."""
    fetch(False)
    out, matched, rejected, no_item, no_photo = {}, [], [], 0, 0
    error = None
    try:
        _candidate_pool()
    except (urllib.error.URLError, TimeoutError) as e:  # Wikimedia unreachable / rate-limited: photos stay null
        error = f"Wikidata unavailable ({e}); photos skipped this build"
        print(f"  images: {error}")
        return {r["CODCNH"]: None for r in cnh_rows}, {"source": "Wikidata → Wikimedia Commons", "withImage": 0,
                                                       "error": error}
    try:
        for row in cnh_rows:
            code = row["CODCNH"]
            g = geo.get(code)
            out[code] = None
            if not g:
                continue
            name = (names or {}).get(code) or row["Nombre Centro"]
            if code in OVERRIDES:
                qid = OVERRIDES[code]
                if qid is None:
                    no_item += 1
                    continue
                ent = _entities([qid])[qid]
            else:
                pick = _pick(name, (g["lat"], g["lon"]))
                if not pick:
                    no_item += 1
                    continue
                qid, ent, _ = pick
            files = [v for v in _claim_values(ent, "P18") if isinstance(v, str)]
            if not files:
                no_photo += 1
                matched.append({"id": code, "wikidata": qid, "label": _label(ent), "image": None})
                continue
            rej = REJECTED_PHOTOS.get(code)
            if rej and _norm(rej[0]) == _norm(files[0]):
                rejected.append({"id": code, "file": files[0], "reason": f"checked by hand: {rej[1]}"})
                continue
            try:
                img = _commons_image(files[0])
            except (urllib.error.URLError, TimeoutError) as e:
                error = f"Commons unavailable ({e}); some photos skipped"
                continue
            if not img or "rejected" in img:
                rejected.append({"id": code, "file": files[0], "licence": (img or {}).get("rejected")})
                continue
            out[code] = img
            matched.append({"id": code, "wikidata": qid, "label": _label(ent), "image": files[0]})
    finally:
        _save()
    report = {
        "source": "Wikidata (P18 of the hospital's item) → Wikimedia Commons; free licences only",
        "withImage": sum(1 for v in out.values() if v),
        "wikidataItemWithoutPhoto": no_photo,
        "noWikidataItem": no_item,
        "rejected": rejected,  # non-free licence, or a photo rejected by hand (REJECTED_PHOTOS)
        "matches": matched,
        **({"error": error} if error else {}),
    }
    return out, report
