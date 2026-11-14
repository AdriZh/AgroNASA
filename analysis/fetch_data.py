"""Fetch NASA POWER daily weather (2001-2025) and SoilGrids soil profile for pilot sites."""
import json, ssl, urllib.request, pathlib, time

CA = "/root/.ccr/ca-bundle.crt"
ctx = ssl.create_default_context(cafile=CA) if pathlib.Path(CA).exists() else ssl.create_default_context()
OUT = pathlib.Path(__file__).parent / "data"

SITES = {
    "north_kz": {"name": "Akmola steppe, North Kazakhstan", "lat": 52.60, "lon": 69.90},
    "south_kz": {"name": "Turkistan irrigated belt, South Kazakhstan", "lat": 42.90, "lon": 68.30},
    "iowa":     {"name": "Central Iowa, USA (reference)", "lat": 42.00, "lon": -93.60},
}
PARAMS = "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP,ALLSKY_SFC_SW_DWN,RH2M,WS2M"

def get(url):
    with urllib.request.urlopen(url, context=ctx, timeout=120) as r:
        return json.loads(r.read())

for key, s in SITES.items():
    f = OUT / f"power_{key}.json"
    if not f.exists():
        url = ("https://power.larc.nasa.gov/api/temporal/daily/point?"
               f"parameters={PARAMS}&community=AG&latitude={s['lat']}&longitude={s['lon']}"
               "&start=20010101&end=20251231&format=JSON")
        t = time.time(); d = get(url); f.write_text(json.dumps(d))
        print("POWER", key, f"{time.time()-t:.1f}s")
    f = OUT / f"soil_{key}.json"
    if not f.exists():
        props = "&".join(f"property={p}" for p in ["soc", "phh2o", "clay", "sand", "silt", "nitrogen", "bdod"])
        depths = "&".join(f"depth={d}" for d in ["0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm"])
        vals = "&".join(f"value={v}" for v in ["mean", "Q0.05", "Q0.95"])
        url = f"https://rest.isric.org/soilgrids/v2.0/properties/query?lon={s['lon']}&lat={s['lat']}&{props}&{depths}&{vals}"
        try:
            f.write_text(json.dumps(get(url))); print("SoilGrids", key)
        except Exception as e:
            print("SoilGrids failed", key, e)
        time.sleep(13)  # SoilGrids: 5 calls/min
(OUT / "sites.json").write_text(json.dumps(SITES, indent=1))
