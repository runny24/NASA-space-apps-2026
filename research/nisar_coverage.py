"""Check NISAR coverage for any point on Earth. No login, no dependencies beyond Python 3.
Usage:  python3 nisar_coverage.py <lon> <lat> [GCOV|GUNW|GOFF|GSLC|SME2]
Prints one line per repeat-pass stack (track_direction_frame): how many dates, date range,
polarizations, bandwidth mode, median file size, and which release (B=beta, P=provisional, V=validated).
"""
import collections, json, statistics, sys, urllib.parse, urllib.request

COLLECTIONS = {  # CMR concept ids, verified 2026-11-13
    "GCOV": {"B": "C3622214170-ASF", "P": "C2854338529-ASF", "V": "C3622241360-ASF"},
    "GUNW": {"B": "C2850261892-ASF", "P": "C2854335566-ASF", "V": "C3622247503-ASF"},
    "GOFF": {"B": "C2850263910-ASF", "P": "C2854341702-ASF", "V": "C3622250865-ASF"},
    "GSLC": {"B": "C2850259510-ASF", "P": "C2854332392-ASF", "V": "C3622244601-ASF"},
    "SME2": {"B": "C2850265000-ASF", "P": "C2854344945-ASF"},
}
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"


def granules(concept_id, lon, lat):
    search_after = None
    while True:
        query = urllib.parse.urlencode({"collection_concept_id": concept_id, "point": f"{lon},{lat}", "page_size": 2000})
        headers = {"User-Agent": "nisar-coverage-check"}
        if search_after:
            headers["CMR-Search-After"] = search_after
        with urllib.request.urlopen(urllib.request.Request(f"{CMR}?{query}", headers=headers), timeout=90) as resp:
            search_after = resp.headers.get("CMR-Search-After")
            items = json.load(resp).get("items", [])
        yield from items
        if len(items) < 2000 or not search_after:
            return


def main(lon, lat, product="GCOV"):
    stacks = collections.defaultdict(lambda: {"dates": set(), "rel": collections.Counter(), "mb": [], "pol": set(), "bw": set()})
    for release, concept_id in COLLECTIONS[product].items():
        for item in granules(concept_id, lon, lat):
            umm = item["umm"]
            attrs = {a["Name"]: a["Values"][0] for a in umm.get("AdditionalAttributes", [])}
            s = stacks[attrs.get("STACK_ID", "?")]
            s["dates"].add(umm["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10])
            s["rel"][release] += 1
            s["pol"].add(attrs.get("FREQUENCY_A_POLARIZATION_CONCAT", "?"))
            s["bw"].add(attrs.get("RANGE_BANDWIDTH_CONCAT", "?"))
            for f in umm["DataGranule"]["ArchiveAndDistributionInformation"]:
                if f["Name"].endswith(".h5") and "QA_STATS" not in f["Name"]:
                    s["mb"].append(f.get("SizeInBytes", 0) / 1e6)
    print(f"{product} at lon={lon} lat={lat}: {len(stacks)} stack(s)")
    for stack_id, s in sorted(stacks.items(), key=lambda kv: -len(kv[1]["dates"])):
        dates = sorted(s["dates"])
        print(f"  {stack_id:10s} {len(dates):3d} dates  {dates[0]} .. {dates[-1]}  pol={'/'.join(sorted(s['pol']))}  "
              f"bw={'/'.join(sorted(s['bw']))} MHz  ~{statistics.median(s['mb']):.0f} MB/file  releases={dict(s['rel'])}")
        print("             " + " ".join(d[5:] if d[:4] == dates[0][:4] else d for d in dates))


if __name__ == "__main__":
    main(float(sys.argv[1]), float(sys.argv[2]), sys.argv[3].upper() if len(sys.argv) > 3 else "GCOV")
