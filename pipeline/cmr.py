"""Find NISAR granules in NASA's Common Metadata Repository (CMR).

CMR is NASA's public catalog. Searching it needs no login, so this module uses only the Python standard
library and runs on any machine with no install. Downloading the data itself does need a login; that is
pipeline/auth.py's job.

A "granule" is one product file (one radar pass over one frame). A "stack" is every granule taken from the
same orbit track, direction and frame (for example "030_A_019"): only images in one stack look at the ground
from the same position, so only they may be compared with each other.

Why umm_json and not the smaller granules.json: only umm_json carries the catalog's "additional attributes"
(stack, polarizations, bandwidth, full or partial frame), and we trust those over parsing the file name.
"""

from __future__ import annotations

import functools
import http.client
import json
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterable, Iterator
from dataclasses import dataclass

CMR_GRANULES_URL = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
# A generic name only: no personal details ever go to an outside service.
USER_AGENT = "nisar-pipeline"
# umm_json records are about 30 KB each, so 200 per page keeps a page near 6 MB. CMR's maximum is 2000,
# and its default is only 10, which is why we always send a page size.
PAGE_SIZE = 200
TIMEOUT_S = 60
TRIES = 3
FIRST_WAIT_S = 2.0

# CMR collection concept ids, checked against the live catalog on 2026-11-13 and 2026-11-14.
# There is no validated soil-moisture (SME2) collection yet.
COLLECTIONS: dict[str, dict[str, str]] = {
    "GCOV": {"validated": "C3622241360-ASF", "provisional": "C2854338529-ASF", "beta": "C3622214170-ASF"},
    "GUNW": {"validated": "C3622247503-ASF", "provisional": "C2854335566-ASF", "beta": "C2850261892-ASF"},
    "GOFF": {"validated": "C3622250865-ASF", "provisional": "C2854341702-ASF", "beta": "C2850263910-ASF"},
    "SME2": {"provisional": "C2854344945-ASF", "beta": "C2850265000-ASF"},
}
RELEASES = ("validated", "provisional", "beta")  # best first; the order dedupe() prefers
_RELEASE_BY_CONCEPT_ID = {cid: rel for by_rel in COLLECTIONS.values() for rel, cid in by_rel.items()}

# Two letters per frequency band in the file name. "NA" means the band is absent. The data guide also lists
# compact-polarization codes (CL, CR); none were seen in the catalog, so they map to nothing here and the
# catalog attributes (which always win) must supply them.
_POL_CODES = {
    "SH": ("HH",),
    "SV": ("VV",),
    "DH": ("HH", "HV"),
    "DV": ("VV", "VH"),
    "QP": ("HH", "HV", "VH", "VV"),
    "NA": (),
}
_TIME_TOKEN = re.compile(r"^\d{8}T\d{6}$")
_ISO_START = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")


class CatalogError(RuntimeError):
    """The catalog could not be searched. The message says what to do about it."""


@dataclass(frozen=True)
class Granule:
    name: str                 # granule name without ".h5", exactly as in the catalog
    product: str              # "GCOV", "GUNW", "GOFF", "SME2"
    release: str              # "validated" | "provisional" | "beta"
    collection: str           # catalog short name, e.g. "NISAR_L2_GCOV_PROVISIONAL_V1"
    stack: str                # "030_A_019" = track_direction_frame
    direction: str            # "ascending" | "descending"
    start: str                # acquisition start, ISO 8601 UTC with trailing Z
    date: str                 # UTC calendar date of start, "YYYY-MM-DD"
    version: str              # processing version (CRID) from the name, e.g. "P05023"
    counter: int              # trailing _001 counter from the name
    pols_a: tuple[str, ...]   # frequency A polarizations, e.g. ("HH", "HV"); empty if no frequency A
    pols_b: tuple[str, ...]
    bandwidth_mhz_a: float | None
    full_frame: bool
    urgent: bool              # urgent-response product
    size_bytes: int | None
    data_url: str | None      # the https .h5 link taken from the catalog record, never constructed
    browse_urls: tuple[str, ...]
    polygon: tuple[tuple[float, float], ...]   # (lon, lat) ring; may be empty



def parse_name(name: str) -> dict:
    """Split a NISAR product name into its fields.

    Example (the sample site's first date):
    NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001
    reads as: level 2, production (PR; UR is urgent response), GCOV, cycle 001, track 030, Ascending,
    frame 019, bandwidth 28 MHz on frequency A and none on B (00), polarization SH (HH) on A and NA (no
    band) on B, a one-letter mode code this module does not use, start, end, processing version D00404,
    orbit quality N, Full frame, made at JPL, counter 001.

    Pair products (GUNW, GOFF) add a second cycle number and a second start/end, and may give only one
    two-letter polarization code. So we read the fixed fields from both ends and find the rest by shape,
    rather than trusting fixed positions.
    """
    parts = name.split("_")
    if len(parts) < 15 or parts[0] != "NISAR":
        raise ValueError(f"not a NISAR product name: {name!r}")
    middle = parts[8:-5]
    times = [p for p in middle if _TIME_TOKEN.match(p)]
    others = [p for p in middle if not _TIME_TOKEN.match(p)]
    mode_index = next((i for i, p in enumerate(others) if re.fullmatch(r"\d{4}", p)), None)
    if not times or mode_index is None or mode_index + 1 >= len(others):
        raise ValueError(f"cannot find the mode, polarization or times in {name!r}")
    mode = others[mode_index]
    pol_code = others[mode_index + 1]
    chunks = [pol_code[i:i + 2] for i in range(0, len(pol_code), 2)]
    if len(chunks) == 1 and mode[:2] == "00":
        chunks = ["NA"] + chunks  # a single code describes frequency B when A is absent
    pols = [_POL_CODES.get(c, ()) for c in chunks] + [(), ()]
    bw_a, bw_b = int(mode[:2]), int(mode[2:])
    first = times[0]
    return {
        "production": parts[2],
        "product": parts[3],
        "cycle": int(parts[4]),
        "track": int(parts[5]),
        "direction": {"A": "ascending", "D": "descending"}[parts[6]],
        "frame": int(parts[7]),
        "stack": f"{parts[5]}_{parts[6]}_{parts[7]}",
        "mode": mode,
        "pols_a": pols[0],
        "pols_b": pols[1],
        "bandwidth_mhz_a": float(bw_a) if bw_a else None,
        "bandwidth_mhz_b": float(bw_b) if bw_b else None,
        "start": f"{first[0:4]}-{first[4:6]}-{first[6:8]}T{first[9:11]}:{first[11:13]}:{first[13:15]}Z",
        "version": parts[-5],
        "orbit": parts[-4],
        "full_frame": parts[-3] == "F",
        "counter": int(parts[-1]),
    }


def bandwidth_mhz(granule: Granule, frequency: str) -> float | None:
    """Range bandwidth of frequency "A" or "B" in MHz. B comes from the name (the dataclass keeps only A)."""
    if frequency.upper() == "A":
        return granule.bandwidth_mhz_a
    return parse_name(granule.name)["bandwidth_mhz_b"]


def mode_label(granule: Granule) -> str:
    """Bandwidth mode as people write it, e.g. "20+5", "40+5", "77" or "5" (frequency B only)."""
    parsed = parse_name(granule.name)
    parts = [parsed["bandwidth_mhz_a"], parsed["bandwidth_mhz_b"]]
    return "+".join(f"{p:g}" for p in parts if p) or "?"


def pols_for(granule: Granule, frequency: str) -> tuple[str, ...]:
    return granule.pols_a if frequency.upper() == "A" else granule.pols_b


def _normalise_start(value: str) -> str:
    """CMR writes "2026-10-17T22:36:33.000000Z"; we keep whole seconds: "2026-10-17T22:36:33Z"."""
    if not _ISO_START.match(value or ""):
        raise ValueError(f"unexpected time format {value!r}")
    return value[:19] + "Z"


def _release_for(concept_id: str | None, short_name: str, urgent: bool) -> str:
    if concept_id in _RELEASE_BY_CONCEPT_ID:
        return _RELEASE_BY_CONCEPT_ID[concept_id]
    upper = short_name.upper()
    if "BETA" in upper:
        return "beta"
    if "PROVISIONAL" in upper or urgent:
        # Urgent-response products carry no maturity label and use lower-quality orbits, so we never call
        # them validated. dedupe() drops them anyway.
        return "provisional"
    return "validated"


def _polygon(umm: dict) -> tuple[tuple[float, float], ...]:
    geometry = umm.get("SpatialExtent", {}).get("HorizontalSpatialDomain", {}).get("Geometry", {})
    for poly in geometry.get("GPolygons", []):
        points = poly.get("Boundary", {}).get("Points", [])
        return tuple((float(p["Longitude"]), float(p["Latitude"])) for p in points)
    for rect in geometry.get("BoundingRectangles", []):
        w, s = rect["WestBoundingCoordinate"], rect["SouthBoundingCoordinate"]
        e, n = rect["EastBoundingCoordinate"], rect["NorthBoundingCoordinate"]
        return ((w, s), (e, s), (e, n), (w, n), (w, s))
    return ()


def parse_umm(item: dict) -> Granule:
    """Turn one umm_json search result into a Granule.

    Where the catalog states a fact as an attribute (stack, polarizations, bandwidth, full frame, version,
    counter) we use it, and fall back to the file name only when the attribute is missing.
    """
    umm = item["umm"]
    meta = item.get("meta", {})
    name = umm["GranuleUR"]
    from_name = parse_name(name)
    attrs = {a["Name"]: a.get("Values") or [] for a in umm.get("AdditionalAttributes", [])}
    idents = umm.get("DataGranule", {}).get("Identifiers", [])

    def attr(key: str, default=None):
        values = attrs.get(key)
        return values[0] if values else default

    def ident(kind: str, label: str | None = None):
        for i in idents:
            if i.get("IdentifierType") == kind and (label is None or i.get("IdentifierName") == label):
                return i.get("Identifier")
        return None

    frequencies = attrs.get("FREQUENCIES")
    has_a = "A" in frequencies if frequencies else bool(from_name["pols_a"])
    has_b = "B" in frequencies if frequencies else bool(from_name["pols_b"])
    pols_a = tuple(attrs.get("FREQUENCY_A_POLARIZATION") or from_name["pols_a"]) if has_a else ()
    pols_b = tuple(attrs.get("FREQUENCY_B_POLARIZATION") or from_name["pols_b"]) if has_b else ()
    bw_attr = attr("FREQUENCY_A_RANGE_BANDWIDTH")
    bandwidth_a = (float(bw_attr) if bw_attr else from_name["bandwidth_mhz_a"]) if has_a else None

    production = attr("PRODUCTION_PIPELINE", from_name["production"])
    urgent = production == "UR"
    collection = umm.get("CollectionReference", {}).get("ShortName", "")
    direction_attr = attr("ASCENDING_DESCENDING")
    full_attr = attr("FULL_FRAME")
    start_raw = umm.get("TemporalExtent", {}).get("RangeDateTime", {}).get("BeginningDateTime")
    start = _normalise_start(start_raw) if start_raw else from_name["start"]
    counter = ident("Other", "ProductCounter")

    size_bytes = None
    for f in umm.get("DataGranule", {}).get("ArchiveAndDistributionInformation", []):
        if f.get("Name") == name + ".h5" and f.get("SizeInBytes") is not None:
            size_bytes = int(f["SizeInBytes"])

    # Data links differ between collections (validated GUNW lives under a different folder), so we take
    # the link from the record and never build one from the collection name.
    data_url = None
    browse = []
    for link in umm.get("RelatedUrls", []):
        url = link.get("URL", "")
        if not url.startswith("https://"):
            continue  # s3:// links only work inside Amazon's us-west-2 region
        if link.get("Type") == "GET DATA" and url.endswith("/" + name + ".h5"):
            data_url = url
        elif link.get("Type") == "GET RELATED VISUALIZATION":
            browse.append(url)

    return Granule(
        name=name,
        product=attr("PRODUCT_TYPE", from_name["product"]),
        release=_release_for(meta.get("collection-concept-id"), collection, urgent),
        collection=collection,
        stack=attr("STACK_ID", from_name["stack"]),
        direction=direction_attr.lower() if direction_attr else from_name["direction"],
        start=start,
        date=start[:10],
        version=ident("CRID") or from_name["version"],
        counter=int(counter) if counter else from_name["counter"],
        pols_a=pols_a,
        pols_b=pols_b,
        bandwidth_mhz_a=bandwidth_a,
        full_frame=(full_attr == "TRUE") if full_attr else from_name["full_frame"],
        urgent=urgent,
        size_bytes=size_bytes,
        data_url=data_url,
        browse_urls=tuple(browse),
        polygon=_polygon(umm),
    )

@functools.cache
def ssl_context() -> ssl.SSLContext:
    """HTTPS trust settings for every request the pipeline makes with urllib.

    We start from the operating system's certificates (which on Windows include any a school or venue
    network adds) and, when the certifi package is installed, add its up-to-date list too. Python from
    python.org on macOS ships with no certificates of its own until "Install Certificates.command" is run,
    and without this every NASA request there fails with CERTIFICATE_VERIFY_FAILED.
    """
    context = ssl.create_default_context()
    try:
        import certifi
    except ImportError:
        return context
    context.load_verify_locations(cafile=certifi.where())
    return context


CERTIFICATE_HELP = (
    "Python could not check the HTTPS certificate of {host}. Run `npm run setup` (it installs the certifi "
    "package into .venv) and use `npm run pipeline -- ...`. On macOS with Python from python.org you can "
    "also run 'Install Certificates.command' in the Python folder under Applications. If you are on a "
    "school or venue network that inspects HTTPS, try another network."
)


def _fetch_page(url: str, search_after: str | None) -> tuple[dict, str | None]:
    """GET one page of results. Retries network trouble and server overload; explains anything else."""
    headers = {"User-Agent": USER_AGENT}
    if search_after:
        headers["CMR-Search-After"] = search_after
    last_error: Exception | None = None
    for attempt in range(TRIES):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=TIMEOUT_S, context=ssl_context()) as response:
                # resp.headers is case-insensitive; dict(resp.headers) would not be.
                return json.load(response), response.headers.get("CMR-Search-After")
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504):
                raise CatalogError(_explain_http_error(error)) from None
            last_error = error
        except urllib.error.URLError as error:
            if isinstance(error.reason, ssl.SSLCertVerificationError):  # retrying will not fix this
                raise CatalogError(CERTIFICATE_HELP.format(host="cmr.earthdata.nasa.gov")) from None
            last_error = error
        except (TimeoutError, ConnectionError, http.client.HTTPException, json.JSONDecodeError) as error:
            last_error = error
        if attempt < TRIES - 1:
            time.sleep(FIRST_WAIT_S * 2 ** attempt)  # 2 s, then 4 s: be polite to a busy server
    raise CatalogError(
        f"Could not get an answer from NASA's catalog (cmr.earthdata.nasa.gov) after {TRIES} tries. "
        f"Last error: {last_error}. Check that this computer is online and that a school or venue network "
        "is not blocking nasa.gov, look at https://status.earthdata.nasa.gov for outages, then run the "
        "command again."
    )


def _explain_http_error(error: urllib.error.HTTPError) -> str:
    try:
        detail = "; ".join(json.loads(error.read().decode("utf-8", "replace")).get("errors", []))
    except (ValueError, AttributeError, OSError):
        detail = ""
    return (
        f"NASA's catalog refused the search (HTTP {error.code}){': ' + detail if detail else ''}. "
        "This usually means a bad search value: check that longitude comes before latitude, that a box is "
        "west, south, east, north, and that the product name is one of " + ", ".join(COLLECTIONS) + "."
    )


def _search(params: list[tuple[str, str]], limit: int | None = None) -> Iterator[dict]:
    """Yield every umm_json item matching params, following CMR-Search-After from page to page.

    CMR asks the client to repeat the identical query and send back the header value it received. A page
    shorter than the page size is the last one (CMR still sends the header on it, so we stop by length).
    """
    page_size = PAGE_SIZE if limit is None else min(PAGE_SIZE, limit)
    url = f"{CMR_GRANULES_URL}?{urllib.parse.urlencode(params + [('page_size', str(page_size))])}"
    search_after = None
    returned = 0
    while True:
        page, search_after = _fetch_page(url, search_after)
        items = page.get("items", [])
        for item in items:
            yield item
            returned += 1
            if limit is not None and returned >= limit:
                return
        if len(items) < page_size or not search_after:
            return


def collection_ids(product: str, releases: Iterable[str]) -> list[str]:
    """Concept ids for one product in the requested releases. A release the product lacks is skipped."""
    product = product.upper()
    if product not in COLLECTIONS:
        raise ValueError(f"unknown product {product!r}; use one of {', '.join(COLLECTIONS)}")
    wanted = [r.strip().lower() for r in releases if r.strip()]
    unknown = [r for r in wanted if r not in RELEASES]
    if unknown:
        raise ValueError(f"unknown release {unknown[0]!r}; use any of {', '.join(RELEASES)}")
    ids = [COLLECTIONS[product][r] for r in wanted if r in COLLECTIONS[product]]
    if not ids:
        raise ValueError(f"{product} has no collection in releases {', '.join(wanted)}")
    return ids


def search_granules(
    product, *, point=None, bbox=None, releases=("validated", "provisional"), stack=None
) -> list[Granule]:
    """Every granule of a product touching a point (lon, lat) or box (west, south, east, north).

    Returns all of them, duplicates and partial frames included, oldest first; use dedupe() to keep one per
    pass. Urgent-response products live in a separate collection and are never returned here.
    """
    if point is None and bbox is None and stack is None:
        raise ValueError("give a point, a bbox or a stack; a search of the whole planet is too big")
    params = [("collection_concept_id[]", cid) for cid in collection_ids(product, releases)]
    params.append(("sort_key", "start_date"))
    if point is not None:
        lon, lat = (float(v) for v in point)
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise ValueError(f"point ({lon}, {lat}) is not (longitude, latitude); longitude comes first")
        params.append(("point", f"{lon},{lat}"))
    if bbox is not None:
        west, south, east, north = (float(v) for v in bbox)
        if not (-90 <= south < north <= 90 and -180 <= west <= 180 and -180 <= east <= 180):
            raise ValueError(f"bbox {bbox} must be west, south, east, north in degrees")
        params.append(("bounding_box", f"{west},{south},{east},{north}"))
    if stack:
        params.append(("attribute[]", f"string,STACK_ID,{stack}"))
    return [parse_umm(item) for item in _search(params)]


def latest_granule(product: str = "GCOV", release: str = "validated") -> Granule | None:
    """The most recent granule of a product that has a data link. Used to test a login on a real file."""
    params = [("collection_concept_id[]", COLLECTIONS[product][release]), ("sort_key", "-start_date")]
    for item in _search(params, limit=10):
        granule = parse_umm(item)
        if granule.data_url:
            return granule
    return None



def preference(g: Granule) -> tuple:
    """Sort key, best first: validated over provisional over beta, then the highest counter (a re-issue).

    The last three keys only break ties the rule above leaves open. They matter in real data: a pass can
    have a full frame and a partial strip with the same start second, or an HH-only and a quad-pol variant
    of the same frame. We prefer the full frame, then more polarizations, then the name, so the choice is
    repeatable.
    """
    return (RELEASES.index(g.release) if g.release in RELEASES else len(RELEASES),
            -g.counter, not g.full_frame, -len(g.pols_a), g.name)


URGENT_REASON = "urgent-response product (lower-quality orbit, deleted after 30 days)"


def split_duplicates(granules: Iterable[Granule]) -> tuple[list[Granule], list[tuple[Granule, str]]]:
    """Like dedupe(), but also return every dropped granule with the reason it was dropped."""
    best: dict[tuple[str, str], Granule] = {}
    dropped: list[tuple[Granule, str]] = []
    candidates: dict[tuple[str, str], list[Granule]] = {}
    for g in granules:
        if g.urgent:
            dropped.append((g, URGENT_REASON))
            continue
        # TODO(builder): pair products (GUNW, GOFF) key on the reference start only, so different pairs collide.
        candidates.setdefault((g.stack, g.start), []).append(g)
    for key, group in candidates.items():
        group.sort(key=preference)
        best[key] = winner = group[0]
        for loser in group[1:]:
            reason = f"same pass as {winner.name} ({winner.release}, counter {winner.counter}), which was kept"
            dropped.append((loser, reason))
    kept = sorted(best.values(), key=lambda g: (g.start, g.stack))
    return kept, dropped


def dedupe(granules: Iterable[Granule]) -> list[Granule]:
    """One granule per (stack, start): validated over provisional over beta, then highest counter.

    Urgent-response products are dropped. Note that a date can still have two granules after this: a full
    frame and a partial strip that starts later in the same pass.
    """
    return split_duplicates(granules)[0]


def group_by_stack(granules: Iterable[Granule]) -> dict[str, list[Granule]]:
    """{stack: granules oldest first}, stacks in name order."""
    groups: dict[str, list[Granule]] = {}
    for g in granules:
        groups.setdefault(g.stack, []).append(g)
    return {s: sorted(groups[s], key=lambda g: g.start) for s in sorted(groups)}


def polygon_contains(polygon: tuple[tuple[float, float], ...], lon: float, lat: float) -> bool:
    """Ray-casting point-in-polygon test in plain degrees. Footprints that cross the 180th meridian are not
    handled. TODO(builder): handle the antimeridian if a site ever needs it."""
    inside = False
    n = len(polygon)
    for i in range(n):
        (x1, y1), (x2, y2) = polygon[i], polygon[(i + 1) % n]
        if (y1 > lat) != (y2 > lat):
            x_cross = x1 + (lat - y1) * (x2 - x1) / (y2 - y1)
            if lon < x_cross:
                inside = not inside
    return inside


def covers_bbox(granule: Granule, bbox) -> bool | None:
    """True if all four corners of the box are inside the footprint (footprints are near-rectangles, so the
    corners are enough). None when the record has no footprint and we cannot tell."""
    if not granule.polygon:
        return None
    west, south, east, north = bbox
    return all(polygon_contains(granule.polygon, x, y) for x, y in ((west, south), (east, south),
                                                                       (east, north), (west, north)))
