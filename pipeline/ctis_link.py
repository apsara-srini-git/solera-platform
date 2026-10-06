"""
EU CT number → EudraCT number for trials transitioned from the old EU directive to CTIS.

REec lists a transitioned trial only under its new EU CT number, while ClinicalTrials.gov often still
lists only the old EudraCT number, so the two records never join and the trial is counted twice.
CTIS publishes the link (authorizedApplication.eudraCt). Results are cached in raw/ctis/eudract_map.json
(value null = looked up, not transitioned) so each id is fetched once, ever.
Source: CTIS public portal (euclinicaltrials.eu), © EMA — reproduced with acknowledgement.
"""

import json
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

URL = "https://euclinicaltrials.eu/ctis-public-api/retrieve/{}"


def is_euct(trial_id: str) -> bool:
    """EU CT numbers look like 2023-506402-39-00 (middle block starts with 5); EudraCT like 2021-004854-46."""
    parts = trial_id.split("-")
    return len(parts) == 4 and parts[1].startswith("5")


def _lookup(i: str) -> str | None:
    for attempt in range(4):
        try:
            req = urllib.request.Request(URL.format(i), headers={"User-Agent": "Solera-pipeline/0.1"})
            with urllib.request.urlopen(req, timeout=60) as r:
                app = (json.loads(r.read()).get("authorizedApplication") or {}).get("eudraCt") or {}
            return app.get("eudraCtCode") if app.get("isTransitioned") else None
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(5 * (attempt + 1))  # 403/429 on bursts
        except Exception:
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"CTIS lookup failed for {i}")


def eudract_map(ids: list[str], cache_file: Path, workers: int = 3, delay: float = 1.0) -> dict[str, str | None]:
    """Looks up uncached ids with a few polite parallel workers (~1 request/s overall). Failed lookups are
    left out of the cache and retried on the next build."""
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache: dict[str, str | None] = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    todo = [i for i in dict.fromkeys(ids) if is_euct(i) and i not in cache]
    if not todo:
        return cache
    print(f"  CTIS: looking up {len(todo)} EU CT numbers (≈{len(todo) * delay / 60:.0f} min, cached after)", flush=True)
    lock = threading.Lock()

    def one(i):
        try:
            v = _lookup(i)
            with lock:
                cache[i] = v
        except RuntimeError as e:
            print(f"    {e}", flush=True)
        time.sleep(delay * workers)

    with ThreadPoolExecutor(workers) as pool:
        for n, _ in enumerate(pool.map(one, todo), 1):
            if n % 100 == 0:
                with lock:
                    cache_file.write_text(json.dumps(cache))
                print(f"    {n}/{len(todo)}", flush=True)
    cache_file.write_text(json.dumps(cache))
    return cache
