"""
Hospital coordinates (WGS84) for the map.

Primary source: Comunidad de Madrid open data "Centros, servicios y establecimientos sanitarios"
(regional register of health centres, CC BY), which carries UTM ETRS89 zone 30N coordinates per centre.
https://datos.comunidad.madrid/catalogo/dataset/centros_servicios_establecimientos_sanitarios
The register has no centre names, so hospitals are joined on their address (postcode + street + number), with a small
hand-checked table for hospitals whose catalogue address differs from the register's (e.g. registered office vs campus).

Cross-check: Nominatim (OpenStreetMap) geocode of the catalogue address, ≤1 request/s, cached under raw/geo/.
Every point must lie inside the Comunidad de Madrid bbox; a register point more than ~1.5 km from the address geocode
is reported as an outlier (build report → geo.outliers); it is kept only if the OSM geocode of the hospital NAME agrees
(≤ 1.5 km) or it was checked by hand (MANUAL / CHECKED_OUTLIERS). Otherwise the build stops.
Points that come from the OSM address-geocode fallback (no register match) get the same NAME second opinion: they must
agree with it (≤ 1.5 km) or be listed in CHECKED_OUTLIERS, otherwise the build stops — an address geocode of a
registered office is not the hospital.

fetch(refresh) downloads the register; build(cnh_rows) → {CODCNH: {"lat", "lon", "source"} | None}.
"""

import csv
import json
import math
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

RAW = Path(__file__).resolve().parent / "raw" / "geo"
REGISTER_FILE = RAW / "centros_sanitarios.csv"
NOMINATIM_CACHE = RAW / "nominatim.json"
REGISTER_URL = (
    "https://datos.comunidad.madrid/dataset/d8a0a444-adf5-4c04-8999-0eac3de52cb7/resource/"
    "2948b4da-8b39-42b7-b667-779a5284f39d/download/centros_servicios_establecimientos_sanitarios.csv"
)
REGISTER_PAGE = "https://datos.comunidad.madrid/catalogo/dataset/centros_servicios_establecimientos_sanitarios"
UA = "SoleraDataPipeline/1.0 (clinical-trial site search for Madrid; open-data build script)"

# Comunidad de Madrid bounding box (generous by ~1 km)
BBOX = {"lat": (39.88, 41.17), "lon": (-4.59, -3.05)}
MAX_DISTANCE_KM = 1.5

# Catalogue (CNH) code → regional register code, for hospitals whose two addresses differ. Each entry was checked by
# hand against the OpenStreetMap geocode of the hospital NAME (not the catalogue address) — see report notes.
MANUAL = {
    "280035": "CH0023",  # 12 de Octubre: CNH "Av. de Córdoba s/n", register "Glorieta de Málaga 11" (same campus)
    "280029": "CH0049",  # Ramón y Cajal: CNH lists "C/ Ayala 38" (old office); hospital is at Ctra. Colmenar km 9.1
    "280894": "CH0032",  # Móstoles: CNH "C/ Río Júcar s/n", register "C/ Doctor Luis Montes s/n" (same block)
    "280920": "CH0027",  # El Escorial: CNH "Ctra. de Guadarrama 6,255", register "Ctra. M-600 (Guadarrama) km 6,255"
    # The two below fell back to an OSM geocode of the catalogue (office) address, 1.8 km and 5 km off. The register has
    # a hospital centre at each hospital's real address; OSM's geocode of the hospital NAME agrees (checked 2026-10).
    "280323": "CH0068",  # N.S. del Rosario: CNH "C/ Cardenal Cisneros 7"; hospital is at C/ Príncipe de Vergara 53
    "280376": "CH0019",  # Viamed Santa Elena: CNH "C/ Abtao 25"; hospital (Clínica Santa Elena) is at C/ de la Granja 8
}

# Hospitals absent from the regional register (e.g. Ministry of Defence): coordinates fixed from the OSM geocode of the
# hospital itself, checked by hand on openstreetmap.org.
FIXED = {
    # Quirónsalud Valle del Henares, Av. Constitución 249: the register point is at Av. Constitución 86 (3.1 km off);
    # OSM has the hospital building at no. 249 (checked 2026-10).
    "281456": (40.466337, -3.440646),
}

# Address joins where the OSM geocode of the catalogue address lands > 1.5 km away, checked by hand: the register point
# is on the hospital and the OSM address geocode is wrong (typically a road-kilometre address resolved to the road).
CHECKED_OUTLIERS = {
    "280604": "La Zarzuela: OSM 'Hospital de la Zarzuela' (Pléyades, Aravaca) is 50 m from the register point",
    "280262": "Rodríguez Lafora: OSM 'Hospital Dr. Rodríguez Lafora' is 0.9 km away (large campus, same site)",
    "280409": "Clínica N.S. de la Paz: register point is at the east end of López de Hoyos (no. 259); OSM resolves "
              "the address to the street's west half",
    "280323": "N.S. del Rosario: catalogue address is an office; MANUAL → register CH0068 (Príncipe de Vergara 53), "
              "40 m from OSM 'Hospital Universitario Nuestra Señora del Rosario'",
    "280376": "Viamed Santa Elena: catalogue address (Abtao 25) is an office; MANUAL → register CH0019 (C/ de la Granja 8), "
              "where OSM has 'Clínica Santa Elena'",
    "281326": "Casta Guadarrama: register point is the former Sanatorio Militar on the A-6 km 50, where the hospital is",
}


def _http(url: str, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def fetch(refresh: bool = False) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    if refresh or not REGISTER_FILE.exists():
        REGISTER_FILE.write_bytes(_http(REGISTER_URL, timeout=300))


# --- UTM (ETRS89 / zone 30N) → geographic. ETRS89 and WGS84 differ by < 1 m in Spain, below map precision. ---------
def utm_to_wgs84(easting: float, northing: float, zone: int = 30) -> tuple[float, float]:
    """Inverse transverse Mercator on the GRS80 ellipsoid (Krüger series, sub-millimetre within a zone)."""
    a, f = 6378137.0, 1 / 298.257222101
    k0, e0 = 0.9996, 500000.0
    n = f / (2 - f)
    A = a / (1 + n) * (1 + n**2 / 4 + n**4 / 64)
    beta = [
        n / 2 - 2 * n**2 / 3 + 37 * n**3 / 96,
        n**2 / 48 + n**3 / 15,
        17 * n**3 / 480,
    ]
    delta = [
        2 * n - 2 * n**2 / 3 - 2 * n**3,
        7 * n**2 / 3 - 8 * n**3 / 5,
        56 * n**3 / 15,
    ]
    xi = northing / (k0 * A)
    eta = (easting - e0) / (k0 * A)
    xi_p = xi - sum(b * math.sin(2 * j * xi) * math.cosh(2 * j * eta) for j, b in enumerate(beta, 1))
    eta_p = eta - sum(b * math.cos(2 * j * xi) * math.sinh(2 * j * eta) for j, b in enumerate(beta, 1))
    chi = math.asin(math.sin(xi_p) / math.cosh(eta_p))
    lat = chi + sum(d * math.sin(2 * j * chi) for j, d in enumerate(delta, 1))
    lon0 = math.radians(zone * 6 - 183)
    lon = lon0 + math.atan2(math.sinh(eta_p), math.cos(xi_p))
    return math.degrees(lat), math.degrees(lon)


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def in_bbox(lat: float, lon: float) -> bool:
    return BBOX["lat"][0] <= lat <= BBOX["lat"][1] and BBOX["lon"][0] <= lon <= BBOX["lon"][1]


# --- address normalisation ----------------------------------------------------------------------------------------
STREET_TYPES = r"(calle|c|avenida|avda|av|paseo|plaza|pza|glorieta|gta|carretera|ctra|camino|cmno|ronda|travesia)"
STOP = {"de", "del", "la", "las", "los", "el", "y", "a", "al"}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _tokens(s: str) -> frozenset[str]:
    """Address as a set of words and numbers, without street-type words, articles, 's/n' or 'km'."""
    s = _norm(s).replace("s n", " ")
    words = s.split()
    return frozenset(w for w in words if w not in STOP and not re.fullmatch(STREET_TYPES, w) and w not in {"km", "k"})


def _load_register() -> dict[str, dict]:
    """One entry per hospital-type centre (code CH…), with its address and converted coordinates."""
    centres = {}
    with open(REGISTER_FILE, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            code = r["centro_nro_registro"]
            if not code.startswith("CH") or code in centres:
                continue
            try:
                x, y = float(r["localizacion_coordenada_x"]), float(r["localizacion_coordenada_y"])
            except ValueError:
                continue
            lat, lon = utm_to_wgs84(x, y)
            street = r["direccion_vial_nombre"]
            centres[code] = {
                "code": code,
                "postcode": r["direccion_codigo_postal"].strip(),
                "tokens": _tokens(f'{street} {r["direccion_vial_nro"]}'),
                "address": f'{r["direccion_vial_tipo"]} {street} {r["direccion_vial_nro"]}, {r["direccion_codigo_postal"]} {r["municipio_nombre"]}',
                "lat": round(lat, 6),
                "lon": round(lon, 6),
            }
    return centres


def _match(row: dict, centres: dict[str, dict]) -> dict | None:
    """Exact address join: same postcode and the same street name + number tokens."""
    tokens, pc = _tokens(row["Dirección"]), str(row["Código Postal"]).strip()
    hits = [c for c in centres.values() if c["postcode"] == pc and tokens and tokens == c["tokens"]]
    return hits[0] if len(hits) == 1 else None


# --- Nominatim cross-check ----------------------------------------------------------------------------------------
_last_call = [0.0]


def _nominatim(query: str, cache: dict) -> tuple[float, float] | None:
    if query in cache:
        v = cache[query]
        return tuple(v) if v else None
    wait = 1.1 - (time.time() - _last_call[0])
    if wait > 0:
        time.sleep(wait)
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "json", "limit": 1, "countrycodes": "es"}
    )
    try:
        res = json.loads(_http(url))
    except Exception as e:  # network trouble: don't cache, try again next build
        print(f"  nominatim failed for {query!r}: {e}")
        return None
    finally:
        _last_call[0] = time.time()
    v = (round(float(res[0]["lat"]), 6), round(float(res[0]["lon"]), 6)) if res else None
    cache[query] = list(v) if v else None
    return v


def _address_query(row: dict) -> str:
    addr = re.sub(r"\b(s/n|km\.?\s*[\d,]+|k\.\s*[\d,]+)\b", "", row["Dirección"], flags=re.I)
    addr = re.sub(r"\s+", " ", addr).strip(" ,")
    return f'{addr}, {row["Código Postal"]} {row["Municipio"]}, España'


def build(cnh_rows: list[dict]) -> tuple[dict[str, dict | None], dict]:
    """Returns ({CODCNH: geo | None}, report)."""
    fetch(False)
    centres = _load_register()
    cache = json.loads(NOMINATIM_CACHE.read_text()) if NOMINATIM_CACHE.exists() else {}
    out, outliers = {}, []
    methods = {"address": 0, "manual": 0, "fixed": 0, "nominatimFallback": 0, "sharedPointAdjusted": 0, "none": 0}
    method_of: dict[str, str] = {}
    cross_checked = 0  # points compared with an independent OSM geocode (address, or the hospital name for fallbacks)
    try:
        for row in cnh_rows:
            code = row["CODCNH"]
            osm = _nominatim(_address_query(row), cache)
            centre = None if code in FIXED else centres.get(MANUAL[code]) if code in MANUAL else _match(row, centres)
            method = "manual" if code in MANUAL else "address"
            if centre:
                point = (centre["lat"], centre["lon"])
                source = f"Comunidad de Madrid, registro de centros sanitarios ({centre['code']})"
            elif code in FIXED:
                point, source, method = FIXED[code], "OpenStreetMap, hospital location checked by hand", "fixed"
            elif osm:
                point, source, method = osm, "OpenStreetMap (Nominatim) geocode of the catalogue address", "nominatim"
            else:
                out[code] = None
                methods["none"] += 1
                continue
            if not in_bbox(*point):
                raise SystemExit(f"geo: {code} {row['Nombre Centro']} at {point} is outside the Comunidad de Madrid")
            if method == "nominatim":
                # fallback point = the address geocode itself, so compare it with the geocode of the hospital NAME
                by_name = _nominatim(f'{row["Nombre Centro"]}, {row["Municipio"]}', cache)
                name_km = round(haversine_km(point, by_name), 2) if by_name else None
                if name_km is not None:
                    cross_checked += 1
                if name_km is None or name_km > MAX_DISTANCE_KM:
                    outliers.append({
                        "id": code, "name": row["Nombre Centro"], "address": row["Dirección"], "distanceKm": None,
                        "nameGeocodeKm": name_km, "note": CHECKED_OUTLIERS.get(code),
                        "explained": code in CHECKED_OUTLIERS, "registerAddress": None, "method": "nominatimFallback",
                    })
                methods["nominatimFallback"] += 1
                out[code] = {"lat": point[0], "lon": point[1], "source": source}
                continue
            dist = round(haversine_km(point, osm), 2) if osm else None
            if dist is not None:
                cross_checked += 1
            if dist is not None and dist > MAX_DISTANCE_KM:
                # second opinion: OSM geocode of the hospital's NAME (address geocodes on long streets or road
                # kilometres often resolve to the street's midpoint)
                by_name = _nominatim(f'{row["Nombre Centro"]}, {row["Municipio"]}', cache)
                name_km = round(haversine_km(point, by_name), 2) if by_name else None
                outliers.append({
                    "id": code, "name": row["Nombre Centro"], "address": row["Dirección"], "distanceKm": dist,
                    "nameGeocodeKm": name_km,
                    "note": CHECKED_OUTLIERS.get(code),
                    "explained": (name_km is not None and name_km <= MAX_DISTANCE_KM)
                    or code in CHECKED_OUTLIERS or method in ("manual", "fixed"),
                    "registerAddress": centre["address"] if centre else None,
                })
            methods[method] += 1
            method_of[code] = method
            out[code] = {"lat": point[0], "lon": point[1], "source": source}
        # Two hospitals on one register point (e.g. Juan Bravo 39 and 49 share a coordinate) would hide each other
        # on the map: use each one's own OSM address point when it is close by.
        shared = {}
        for code, g in out.items():
            if g:
                shared.setdefault((g["lat"], g["lon"]), []).append(code)
        rows_by_code = {r["CODCNH"]: r for r in cnh_rows}
        for codes in (c for c in shared.values() if len(c) > 1):
            for code in codes:
                osm = _nominatim(_address_query(rows_by_code[code]), cache)
                g = out[code]
                if method_of.get(code) not in ("address", "manual"):
                    continue
                if osm and haversine_km((g["lat"], g["lon"]), osm) <= 0.5:
                    out[code] = {"lat": osm[0], "lon": osm[1], "source": "OpenStreetMap (Nominatim) geocode of the "
                                 "catalogue address (register point shared with a neighbouring hospital)"}
                    methods["sharedPointAdjusted"] += 1
                    methods[method_of[code]] -= 1
    finally:
        NOMINATIM_CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
    unexplained = [o for o in outliers if not o["explained"]]
    if unexplained:  # register and OSM disagree and nobody has looked: don't trust either silently
        raise SystemExit("geo: unexplained outliers (check by hand, then add to CHECKED_OUTLIERS):\n"
                         + "\n".join(json.dumps(o, ensure_ascii=False) for o in unexplained))
    report = {
        "source": REGISTER_PAGE,
        "crossCheck": "OpenStreetMap Nominatim geocode of the catalogue address (of the hospital name for points that "
                      "come from the OSM fallback)",
        "withGeo": sum(1 for v in out.values() if v),
        "byMethod": methods,
        "crossChecked": cross_checked,
        "outliers": outliers,
    }
    return out, report
