"""
Research ethics committee (CEIm) per hospital, from the AEMPS directory of accredited CEIm (REec services).

Endpoints (public JSON, no auth):
  ceimbyccaa?ccaa=13       → accredited CEIm in the Comunidad de Madrid, with this month's / next month's CTIS slots
  ceimstrabajactis         → CEIm that take part in CTIS evaluations (all of Spain), with slot occupancy
  ceimsevaluacionrapida    → CEIm offering fast-track evaluation

GDPR: the responses name the committee's responsible person (nombre_responsable) and give an email "of the responsible".
The name is dropped before anything is written to disk; the email is kept only when it is a committee mailbox
(e.g. ceic.hulp@salud.madrid.org) — anything that looks like a person's address is set to null.

Mapping (SiteCeim.basis):
  "own"     — the committee named after the hospital (ownCommittee=true; the HM Hospitales group committee counts as own
              for HM hospitals). Sourced: source = AEMPS directory URL.
  "complex" — member of a hospital complex → the main hospital's committee (ownCommittee=false). Sourced: same URL.
  "default" — no committee of its own in the directory → the CEIm Regional de la Comunidad de Madrid, INFERRED (the
              directory never says which hospitals the Regional committee serves). source = "", email = null, and
              `note` says it is not confirmed; the UI must present it as "not confirmed", never as a fact.
`source` is always a plain URL (or "" when there is none); prose goes in `note`.

fetch(refresh) → raw/ceim/*.json; build(cnh_rows) → ({CODCNH: SiteCeim}, report).
"""

import json
import re
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

RAW = Path(__file__).resolve().parent / "raw" / "ceim"
BASE = "https://reec.aemps.es/reec-services"
ENDPOINTS = {
    "madrid": "ceimbyccaa?ccaa=13",
    "ctis": "ceimstrabajactis",
    "fasttrack": "ceimsevaluacionrapida",
}
UA = "SoleraDataPipeline/1.0 (clinical-trial site search for Madrid; open-data build script)"
KEEP = {"idceim", "nombre_ceic", "idccaa", "email_responsable", "actual_slot", "siguiente_slot"}
REGIONAL_ID = "95"  # CEIM REGIONAL DE LA COMUNIDAD DE MADRID
NOT_A_HOSPITAL_COMMITTEE = {"190"}  # AEMPS: Centro Coordinador de CEIm
HM_GROUP_ID = "310"  # CEIM HM HOSPITALES

# committee mailboxes: the local part names the committee / its secretariat, never a person
COMMITTEE_WORD = re.compile(r"cei|etic|comit|secret|ensayo|investig")
# segments without a committee word must be a hospital abbreviation (hulp, hgugm, h12o…) or a known unit name —
# so 'maria.secretaria' or 'jgarcia.ceic' (a person's name next to a keyword) is rejected
COMMITTEE_SEGMENT = re.compile(r"^(h[a-z0-9]{1,4}|regional|defensa|rbi)$")


def _http(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def fetch(refresh: bool = False) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    stamp = RAW / "fetched_on.txt"
    if not refresh and stamp.exists() and all((RAW / f"{k}.json").exists() for k in ENDPOINTS):
        return
    for key, ep in ENDPOINTS.items():
        rows = json.loads(_http(f"{BASE}/{ep}"))
        # drop the responsible person's name (and any field we don't know) before writing to disk
        clean = [{k: v for k, v in r.items() if k in KEEP} for r in rows]
        (RAW / f"{key}.json").write_text(json.dumps(clean, ensure_ascii=False, indent=1))
    stamp.write_text(date.today().isoformat())


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


GENERIC = {"ceim", "ceic", "h", "hospital", "universitario", "general", "infantil", "central", "de", "del", "la", "el",
           "las", "los", "y"}


def _key_words(committee: str) -> set[str]:
    return {w for w in _norm(committee).split() if w not in GENERIC}


def committee_mailbox(email: str | None) -> str | None:
    if not email or "@" not in email:
        return None
    local = email.strip().lower().split("@")[0]
    # firstname.lastname-style or anything without a committee word → treated as personal and dropped
    if not re.fullmatch(r"[a-z0-9._-]+", local) or not COMMITTEE_WORD.search(local):
        return None
    for seg in re.split(r"[._-]+", local):
        if seg and not COMMITTEE_WORD.search(seg) and not COMMITTEE_SEGMENT.match(seg):
            return None
    return email.strip().lower()


def _slots(value: str, month: str, checked_on: str) -> tuple[dict | None, bool]:
    """'2/10' → used 2 of 10. '100%' means full with no published capacity → (None, full=True)."""
    m = re.fullmatch(r"\s*(\d+)\s*/\s*(\d+)\s*", value or "")
    if m and int(m.group(2)) > 0:
        used, cap = int(m.group(1)), int(m.group(2))
        return {"month": month, "used": used, "capacity": cap, "checkedOn": checked_on}, used >= cap
    return None, (value or "").strip() == "100%"


def build(cnh_rows: list[dict]) -> tuple[dict[str, dict], dict]:
    fetch(False)
    madrid = [r for r in json.loads((RAW / "madrid.json").read_text()) if r["idceim"] not in NOT_A_HOSPITAL_COMMITTEE]
    ctis = {r["idceim"]: r for r in json.loads((RAW / "ctis.json").read_text())}
    fast = {r["idceim"] for r in json.loads((RAW / "fasttrack.json").read_text())}
    checked_on = (RAW / "fetched_on.txt").read_text().strip()
    month = checked_on[:7]
    by_id = {r["idceim"]: r for r in madrid}

    def committee(cid: str, own: bool, basis: str) -> dict:
        r = by_id[cid]
        slots, full = _slots(r.get("actual_slot", ""), month, checked_on)
        return {
            "name": _title(r["nombre_ceic"]),
            "ownCommittee": own,
            "ctisEvaluator": cid in ctis,
            "fastTrack": cid in fast,
            "slots": slots if cid in ctis else None,
            # not in SiteCeim yet (optional): CTIS slots full this month although capacity isn't published ("100%")
            "slotsFull": bool(full) if cid in ctis else None,
            "email": None if basis == "default" else committee_mailbox(r.get("email_responsable")),
            "basis": basis,
            "source": "" if basis == "default" else f"{BASE}/{ENDPOINTS['madrid']}",
            "note": (f"Inferred, not confirmed: the hospital has no committee of its own in the AEMPS directory "
                     f"(checked {checked_on}); hospitals without their own committee are usually served by the "
                     f"CEIm Regional." if basis == "default"
                     else f"AEMPS directory of accredited CEIm, checked {checked_on}"
                     + ("; committee of the main hospital of the complex" if basis == "complex" else "")),
        }

    # 1) own committee by hospital name
    own: dict[str, str] = {}
    hospitals = {r["CODCNH"]: r for r in cnh_rows}
    for cid, r in by_id.items():
        if cid in (REGIONAL_ID, HM_GROUP_ID):
            continue
        words = _key_words(r["nombre_ceic"])
        hits = [code for code, h in hospitals.items()
                if words and words <= set(_norm(f'{h["Nombre Centro"]} {h["Municipio"]}').split())]
        if len(hits) > 1:  # e.g. two catalogue rows: prefer the one whose name has no extra words
            hits.sort(key=lambda c: len(_norm(hospitals[c]["Nombre Centro"]).split()))
            hits = hits[:1]
        for code in hits:
            own[code] = cid
    # 2) HM Hospitales group committee
    for code, h in hospitals.items():
        if code not in own and re.search(r"\bhm\b", _norm(h["Nombre Centro"])):
            own[code] = HM_GROUP_ID

    # 3) complex members → main hospital's committee
    complex_main = {}
    for code, h in hospitals.items():
        if h.get("Nombre del Complejo") and code in own:
            complex_main[h["Nombre del Complejo"]] = own[code]

    out, how = {}, {"own": 0, "complex": 0, "default": 0}
    for code, h in hospitals.items():
        if code in own:
            k = "own"
            out[code] = committee(own[code], True, k)
        elif h.get("Nombre del Complejo") in complex_main:
            k = "complex"
            out[code] = committee(complex_main[h["Nombre del Complejo"]], False, k)
        else:
            k = "default"
            out[code] = committee(REGIONAL_ID, False, k)
        how[k] += 1
    unused = [by_id[c]["nombre_ceic"] for c in by_id if c not in set(own.values()) | {REGIONAL_ID}]
    report = {
        "source": f"{BASE} ({', '.join(ENDPOINTS.values())})",
        "checkedOn": checked_on,
        "madridCommittees": len(madrid),
        "withCeim": sum(1 for v in out.values() if v),
        "sourced": how["own"] + how["complex"],
        "defaultInferred": how["default"],
        "byMapping": how,
        "committeesNotMatchedToAHospital": unused,
        "mailboxesDropped": sum(1 for r in madrid if r.get("email_responsable") and not committee_mailbox(r["email_responsable"])),
    }
    return out, report


SMALL = {"de", "del", "la", "las", "los", "el", "y"}
UPPER = {"ceim": "CEIm", "hm": "HM", "h.": "H."}


def _title(name: str) -> str:
    words = []
    for i, w in enumerate(name.lower().split()):
        if w in UPPER:
            words.append(UPPER[w])
        elif i and w in SMALL and not (w in {"la", "el"} and words[-1] in {"Universitario", "Hospital", "H."}):
            words.append(w)
        else:
            words.append(w[:1].upper() + w[1:])
    return " ".join(words)
