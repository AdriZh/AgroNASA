"""Turn NASA POWER + SoilGrids records into field-profile indicators for the Field Shift analysis.

Outputs data/summary.json, consumed by the visualisation page.
Methods: FAO-56 Penman-Monteith ET0, FAO-56 daily soil-water bucket, FAO-33 yield response (Ky),
Saxton & Rawls (2006) available water, Theil-Sen slope + Mann-Kendall test.
"""
import json, math, pathlib
import numpy as np, pandas as pd

HERE = pathlib.Path(__file__).parent
DATA = HERE / "data"
SITES = json.loads((DATA / "sites.json").read_text())
YEARS = list(range(2001, 2026))

# ---------- crops: FAO-56 stage lengths (days) & Kc, root depth (m), p, FAO-33 Ky ----------
# Ky values marked * are not in FAO-33 and are assumptions to be checked by an agronomist.
CROPS = {
    "Spring wheat": dict(stages=(20, 25, 40, 20), kc=(0.30, 1.15, 0.25), root=1.2, p=0.55, ky=1.15, family="cereal", fixes_n=False),
    "Field pea":    dict(stages=(15, 25, 35, 15), kc=(0.50, 1.15, 0.30), root=0.8, p=0.35, ky=1.15, family="legume", fixes_n=True),
    "Lentil":       dict(stages=(20, 25, 35, 15), kc=(0.40, 1.10, 0.30), root=0.8, p=0.50, ky=1.00, family="legume", fixes_n=True),   # Ky*
    "Chickpea":     dict(stages=(20, 30, 35, 15), kc=(0.40, 1.00, 0.35), root=1.0, p=0.50, ky=0.85, family="legume", fixes_n=True),   # Ky*
    "Flax":         dict(stages=(20, 30, 40, 20), kc=(0.35, 1.10, 0.25), root=1.0, p=0.50, ky=1.00, family="oilseed", fixes_n=False), # Ky*
    "Spring canola":dict(stages=(20, 30, 35, 20), kc=(0.35, 1.10, 0.35), root=1.0, p=0.60, ky=1.00, family="oilseed", fixes_n=False), # Ky*
    "Sunflower":    dict(stages=(25, 35, 45, 25), kc=(0.35, 1.10, 0.35), root=1.5, p=0.45, ky=0.95, family="oilseed", fixes_n=False),
    "Maize":        dict(stages=(30, 40, 50, 30), kc=(0.30, 1.20, 0.60), root=1.5, p=0.55, ky=1.25, family="cereal", fixes_n=False),
    "Soybean":      dict(stages=(20, 30, 60, 25), kc=(0.40, 1.15, 0.50), root=1.2, p=0.50, ky=0.85, family="legume", fixes_n=True),
    "Cotton":       dict(stages=(30, 50, 60, 40), kc=(0.35, 1.18, 0.60), root=1.4, p=0.65, ky=0.85, family="fibre", fixes_n=False),
}
# Sowing day (month, day) per site — typical regional calendars.
SOWING = {
    "north_kz": {"Spring wheat": (5, 15), "Field pea": (5, 5), "Lentil": (5, 10), "Chickpea": (5, 10),
                 "Flax": (5, 15), "Spring canola": (5, 20), "Sunflower": (5, 15)},
    "south_kz": {"Cotton": (4, 20), "Maize": (4, 25), "Sunflower": (4, 15), "Chickpea": (3, 25), "Soybean": (5, 1)},
    "iowa":     {"Maize": (5, 1), "Soybean": (5, 15), "Spring wheat": (4, 10), "Field pea": (4, 5), "Spring canola": (4, 15)},
}
MAIN_CROP = {"north_kz": "Spring wheat", "south_kz": "Cotton", "iowa": "Maize"}

# ---------- helpers ----------
def load_power(key):
    d = json.loads((DATA / f"power_{key}.json").read_text())
    p = d["properties"]["parameter"]
    df = pd.DataFrame({k: pd.Series(v) for k, v in p.items()})
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    df = df.replace(-999.0, np.nan).interpolate(limit=5)
    return df, d["geometry"]["coordinates"][2]

def et0_pm(df, lat, z):
    """FAO-56 Penman-Monteith daily reference ET (mm/day)."""
    tmax, tmin, t = df.T2M_MAX, df.T2M_MIN, df.T2M
    rs = df.ALLSKY_SFC_SW_DWN.clip(lower=0)
    u2 = df.WS2M
    e0 = lambda T: 0.6108 * np.exp(17.27 * T / (T + 237.3))
    es = (e0(tmax) + e0(tmin)) / 2
    ea = df.RH2M / 100 * e0(t)
    delta = 4098 * e0(t) / (t + 237.3) ** 2
    P = 101.3 * ((293 - 0.0065 * z) / 293) ** 5.26
    gamma = 0.000665 * P
    J = df.index.dayofyear.values
    phi = math.radians(lat)
    dr = 1 + 0.033 * np.cos(2 * np.pi * J / 365)
    dec = 0.409 * np.sin(2 * np.pi * J / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(dec), -1, 1))
    ra = 24 * 60 / np.pi * 0.0820 * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))
    rso = (0.75 + 2e-5 * z) * ra
    rns = 0.77 * rs
    ratio = np.clip(np.where(rso > 0, rs / np.where(rso > 0, rso, 1), 0.5), 0.25, 1.0)
    rnl = 4.903e-9 * ((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2 * (0.34 - 0.14 * np.sqrt(ea.clip(lower=0))) * (1.35 * ratio - 0.35)
    rn = rns - rnl
    et0 = (0.408 * delta * rn + gamma * 900 / (t + 273) * u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * u2))
    return et0.clip(lower=0)

def mann_kendall(y):
    y = np.asarray(y, float); n = len(y)
    s = sum(np.sign(y[j] - y[i]) for i in range(n - 1) for j in range(i + 1, n))
    var = n * (n - 1) * (2 * n + 5) / 18
    z = (s - np.sign(s)) / math.sqrt(var) if s != 0 else 0.0
    p = math.erfc(abs(z) / math.sqrt(2))
    slopes = [(y[j] - y[i]) / (j - i) for i in range(n - 1) for j in range(i + 1, n)]
    slope = float(np.median(slopes))
    intercept = float(np.median(y - slope * np.arange(n)))
    return dict(slope_per_decade=round(slope * 10, 3), p=round(p, 3), significant=bool(p < 0.05),
                line=[round(intercept, 2), round(intercept + slope * (n - 1), 2)])

def longest_run(mask):
    best = cur = 0
    for m in mask:
        cur = cur + 1 if m else 0; best = max(best, cur)
    return best

def soil_profile(key):
    d = json.loads((DATA / f"soil_{key}.json").read_text())
    out = {}
    for L in d["properties"]["layers"]:
        f = L["unit_measure"]["d_factor"]
        rows = []
        for dep in L["depths"]:
            v = dep["values"]
            g = lambda k: None if v.get(k) is None else round(v[k] / f, 2)
            rows.append(dict(depth=dep["label"], mean=g("mean"), q05=g("Q0.05"), q95=g("Q0.95")))
        out[L["name"]] = dict(unit=L["unit_measure"]["target_units"], rows=rows)
    return out

def saxton_rawls_awc(sand_pct, clay_pct, om_pct):
    S, C, OM = sand_pct / 100, clay_pct / 100, min(om_pct, 8)
    t1500 = -0.024*S + 0.487*C + 0.006*OM + 0.005*S*OM - 0.013*C*OM + 0.068*S*C + 0.031
    th1500 = t1500 + (0.14 * t1500 - 0.02)
    t33 = -0.251*S + 0.195*C + 0.011*OM + 0.006*S*OM - 0.027*C*OM + 0.452*S*C + 0.299
    th33 = t33 + (1.283 * t33**2 - 0.374 * t33 - 0.015)
    return max(th33 - th1500, 0.05) * 1000, th33, th1500  # mm per m

def kc_curve(c):
    i, d, m, l = c["stages"]; ki, km, ke = c["kc"]
    kc = [ki] * i + list(np.linspace(ki, km, d)) + [km] * m + list(np.linspace(km, ke, l))
    return np.array(kc)

def crop_replay(df, key, crop, awc_mm_m, th33, th1500):
    c = CROPS[crop]; mo, dy = SOWING[key][crop]
    kc = kc_curve(c); n = len(kc)
    taw = awc_mm_m * c["root"]; raw = c["p"] * taw
    res = []
    for y in YEARS:
        start = pd.Timestamp(y, mo, dy)
        w = df.loc[start: start + pd.Timedelta(days=n - 1)]
        if len(w) < n: continue
        # initial depletion from MERRA-2 root-zone wetness (fraction of saturation, theta_sat ~0.45)
        theta = w.GWETROOT.iloc[0] * 0.45
        rel = np.clip((theta - th1500) / max(th33 - th1500, 1e-3), 0, 1)
        dr = taw * (1 - rel)
        etc_sum = eta_sum = 0.0; stress_days = 0
        for k, (p_mm, e0) in enumerate(zip(w.PRECTOTCORR.values, w.ET0.values)):
            etc = kc[k] * e0
            ks = 1.0 if dr <= raw else max(0.0, (taw - dr) / (taw - raw))
            eta = ks * etc
            if ks < 1: stress_days += 1
            dr = min(max(dr - p_mm + eta, 0.0), taw)
            etc_sum += etc; eta_sum += eta
        yi = max(0.0, 1 - c["ky"] * (1 - eta_sum / etc_sum))
        res.append(dict(year=y, etc=round(etc_sum), eta=round(eta_sum), rain=round(w.PRECTOTCORR.sum()),
                        yield_index=round(yi, 3), stress_days=stress_days))
    yi = np.array([r["yield_index"] for r in res])
    return dict(crop=crop, family=c["family"], fixes_n=c["fixes_n"], season_days=n,
                sow=f"{mo:02d}-{dy:02d}", years=res,
                median_yi=round(float(np.median(yi)), 3), p10_yi=round(float(np.percentile(yi, 10)), 3),
                p90_yi=round(float(np.percentile(yi, 90)), 3),
                fail_years=int((yi < 0.5).sum()),
                median_demand=int(np.median([r["etc"] for r in res])),
                median_rain=int(np.median([r["rain"] for r in res])))

# ---------- main ----------
summary = {"generated_from": "NASA POWER daily (community AG, MERRA-2/CERES), 2001-2025; ISRIC SoilGrids 2.0", "sites": {}}
for key, s in SITES.items():
    df, z = load_power(key)
    df["ET0"] = et0_pm(df, s["lat"], z)
    df["year"], df["month"] = df.index.year, df.index.month
    df = df[df.year.isin(YEARS)]

    # annual indicators
    rows = []
    for y, g in df.groupby("year"):
        gs = g[g.month.between(5, 8)]
        spring = g[(g.index.month < 7) & (g.T2M_MIN < 0)]
        autumn = g[(g.index.month >= 7) & (g.T2M_MIN < 0)]
        last_spring = spring.index.max() if len(spring) else pd.Timestamp(y, 1, 1)
        first_autumn = autumn.index.min() if len(autumn) else pd.Timestamp(y, 12, 31)
        gdd = (g[g.month.between(4, 10)].T2M - 5).clip(lower=0).sum()
        rows.append(dict(
            year=int(y), rain=round(g.PRECTOTCORR.sum()), rain_gs=round(gs.PRECTOTCORR.sum()),
            et0=round(g.ET0.sum()), aridity=round(g.PRECTOTCORR.sum() / g.ET0.sum(), 3),
            tmean=round(g.T2M.mean(), 2), tmean_gs=round(gs.T2M.mean(), 2), gdd5=round(gdd),
            frost_free=int((first_autumn - last_spring).days), last_frost_doy=int(last_spring.dayofyear),
            first_frost_doy=int(first_autumn.dayofyear),
            heat_days=int((g[g.month.isin([6, 7])].T2M_MAX >= 30).sum()),
            dry_spell=longest_run((gs.PRECTOTCORR < 1).values),
            heavy_rain_days=int((g.PRECTOTCORR >= 20).sum()),
            rootzone_wet_gs=round(gs.GWETROOT.mean(), 3)))
    annual = pd.DataFrame(rows)
    trends = {c: mann_kendall(annual[c]) for c in ["rain", "rain_gs", "et0", "aridity", "tmean", "tmean_gs", "gdd5",
                                                    "frost_free", "heat_days", "dry_spell", "heavy_rain_days", "rootzone_wet_gs"]}

    # monthly climatology
    mon = df.groupby(["year", "month"]).agg(P=("PRECTOTCORR", "sum"), ET0=("ET0", "sum"), W=("GWETROOT", "mean"), T=("T2M", "mean"))
    clim = mon.groupby("month").mean().round(1).reset_index().to_dict("records")
    # root-zone wetness monthly anomaly series (for heat strip)
    wclim = mon.W.groupby("month").transform("mean")
    anom = (mon.W - wclim).round(3).reset_index().rename(columns={"W": "anom"})[["year", "month", "anom"]].to_dict("records")

    # soil
    soil = soil_profile(key)
    def topsoil_avg(prop, stat="mean"):
        vals = [r[stat] for r in soil[prop]["rows"] if r[stat] is not None]
        return float(np.mean(vals)) if vals else None
    sand, clay, soc = topsoil_avg("sand"), topsoil_avg("clay"), topsoil_avg("soc")
    soil_ok = None not in (sand, clay, soc)
    if soil_ok:
        sand, clay = sand / 10 if sand > 100 else sand, clay / 10 if clay > 100 else clay
        awc, th33, th1500 = saxton_rawls_awc(sand, clay, soc * 1.724 / 10)
    else:
        awc, th33, th1500 = 150.0, 0.30, 0.15  # loam fallback

    crops = [crop_replay(df, key, c, awc, th33, th1500) for c in SOWING[key]]

    # bare / cover-crop window after the main crop's harvest
    main = CROPS[MAIN_CROP[key]]; mo, dy = SOWING[key][MAIN_CROP[key]]; L = sum(main["stages"])
    win = []
    for y in YEARS:
        h = pd.Timestamp(y, mo, dy) + pd.Timedelta(days=L)
        after = df.loc[h: pd.Timestamp(y, 12, 31)]
        frost = after[after.T2M_MIN < -2]
        end = frost.index.min() if len(frost) else pd.Timestamp(y, 12, 31)
        w = df.loc[h:end]
        win.append(dict(year=y, harvest=h.strftime("%m-%d"), days=int((end - h).days),
                        gdd4=round((w.T2M - 4).clip(lower=0).sum()), rain=round(w.PRECTOTCORR.sum()),
                        et0=round(w.ET0.sum())))
    # snow-free days with no crop (erosion exposure proxy): mean T > 0 outside main-crop season
    exposed = []
    for y in YEARS:
        g = df[df.year == y]; st = pd.Timestamp(y, mo, dy); en = st + pd.Timedelta(days=L)
        outside = g[(g.index < st) | (g.index > en)]
        exposed.append(int((outside.T2M > 0).sum()))

    summary["sites"][key] = dict(
        **s, elevation=z, main_crop=MAIN_CROP[key],
        annual=annual.to_dict("records"), trends=trends, climatology=clim, wet_anom=anom,
        soil=soil, soil_derived=dict(sand_pct=round(sand, 1) if soil_ok else None, clay_pct=round(clay, 1) if soil_ok else None,
                                     soc_gkg=round(soc, 1) if soil_ok else None, awc_mm_per_m=round(awc), from_map=soil_ok),
        crops=crops, cover_window=win, exposed_days_median=int(np.median(exposed)),
        means={c: round(float(annual[c].mean()), 2) for c in annual.columns if c != "year"})
    print(key, "rain", summary["sites"][key]["means"]["rain"], "AI", summary["sites"][key]["means"]["aridity"],
          "AWC", round(awc), "exposed", int(np.median(exposed)))
    for c in crops:
        print("   ", c["crop"], "median YI", c["median_yi"], "p10", c["p10_yi"], "fail<0.5:", c["fail_years"], "demand", c["median_demand"], "rain", c["median_rain"])
    print("   trends:", {k: (v["slope_per_decade"], v["p"]) for k, v in trends.items()})
    print("   cover window median days/gdd/rain:", np.median([w["days"] for w in win]), np.median([w["gdd4"] for w in win]), np.median([w["rain"] for w in win]))

(DATA / "summary.json").write_text(json.dumps(summary, separators=(",", ":")))
print("wrote", DATA / "summary.json", (DATA / "summary.json").stat().st_size, "bytes")
