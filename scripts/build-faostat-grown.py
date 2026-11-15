"""Build src/data/faostat/grown.json: which Field Shift crops are commonly grown in each country (FAOSTAT QCL).

Input: the FAOSTAT "Production_Crops_Livestock_E_All_Data_(Normalized).zip" bulk download (read inside the zip).
Element 5312 = Area harvested (ha). For each country and crop: the mean harvested area over the latest five years
of the release. A crop counts as "commonly grown" when that mean is at least 1,000 ha and at least 0.5% of the
country's summed harvested area of all Field Shift crops. Values are copied as published; nothing is estimated.
Countries are keyed by ISO alpha-2 through the M49 codes already in src/data/faostat/countries.json.

Usage: python3 -I scripts/build-faostat-grown.py <QCL.zip> src/data/faostat/countries.json src/data/faostat/grown.json
"""
import csv, io, json, sys, zipfile
from collections import defaultdict

zpath, countries_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
ITEMS = {  # Field Shift crop id → FAOSTAT item code (as in scripts/build-faostat.py)
    'millet': '79', 'sorghum': '83', 'maize': '56', 'groundnut': '242', 'cowpea': '195', 'sesame': '289',
    'wheat': '15', 'winterwheat': '15', 'barley': '44', 'flax': '333', 'rapeseed': '270', 'winterrapeseed': '270',
    'sunflower': '267', 'lentil': '201', 'soybean': '236', 'potato': '116', 'rice': '27', 'bean': '176',
    'chickpea': '191', 'cotton': '328', 'pigeonpea': '197', 'mustard': ('292', '270'), 'fababean': '181', 'oats': '75', 'pea': '187',
}
# a tuple: the largest of several items (South Asian rapeseed-mustard is reported under 270 rapeseed)
CODES = {c for v in ITEMS.values() for c in (v if isinstance(v, tuple) else (v,))}
MIN_HA, MIN_SHARE, NYEARS = 1000, 0.005, 5

m49_to_iso2 = {}
for a2, c in json.load(open(countries_path))['countries'].items():
    if c.get('m49'):
        m49_to_iso2[c['m49'].strip("'").lstrip('0') or '0'] = a2

area = defaultdict(lambda: defaultdict(dict))  # iso2 → item → year → ha
names = {}
with zipfile.ZipFile(zpath) as z:
    member = next(n for n in z.namelist() if n.endswith('All_Data_(Normalized).csv'))
    with z.open(member) as f:
        for r in csv.DictReader(io.TextIOWrapper(f, encoding='latin-1', newline='')):
            if r['Element Code'] != '5312' or r['Item Code'] not in CODES or not r['Value']:
                continue
            a2 = m49_to_iso2.get(r['Area Code (M49)'].strip("'").lstrip('0') or '0')
            if not a2:
                continue
            names[a2] = r['Area']
            area[a2][r['Item Code']][int(r['Year'])] = float(r['Value'])

last_year = max(y for c in area.values() for it in c.values() for y in it)
years = list(range(last_year - NYEARS + 1, last_year + 1))
result = {}
for a2, items in area.items():
    means = {}
    for code, by_year in items.items():
        v = [by_year[y] for y in years if y in by_year]
        if v:
            means[code] = sum(v) / len(v)
    total = sum(means.values())  # each FAOSTAT item once
    grown = {}
    for crop, code in ITEMS.items():
        ha = max(means.get(c, 0) for c in (code if isinstance(code, tuple) else (code,)))
        if total and ha >= MIN_HA and ha / total >= MIN_SHARE:
            grown[crop] = round(ha)
    if grown:
        result[a2] = grown

json.dump({
    'source': 'FAOSTAT, Crops and livestock products (QCL), element 5312 Area harvested (ha), bulk download',
    'faostatPage': 'https://www.fao.org/faostat/en/#data/QCL',
    'years': [years[0], years[-1]],
    'rule': f'mean harvested area {years[0]}–{years[-1]} ≥ {MIN_HA} ha and ≥ {MIN_SHARE * 100:g}% of the country total over Field Shift crops',
    'countries': result,
}, open(out, 'w'), separators=(',', ':'), ensure_ascii=False)
print(f'{len(result)} countries, years {years[0]}–{years[-1]}')
