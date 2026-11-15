"""Build src/data/faostat/countries.json from FAOSTAT bulk files.

Inputs (FAOSTAT "Normalized" bulk downloads, unzipped into <dir>/prices, <dir>/exch, <dir>/nutrient, <dir>/temp):
  PP  Prices_E_All_Data_(Normalized).csv                       — producer prices, USD/tonne
  PE  Exchange_rate_E_All_Data_(Normalized).csv                — local currency units per USD
  ESB Environment_Cropland_nutrient_budget_E_All_Data_(Normalized).csv
  ET  Environment_Temperature_change_E_All_Data_(Normalized).csv
Usage: python scripts/build-faostat.py <dir> src/data/faostat/countries.json
Requires: pycountry (M49 → ISO 3166 alpha-2).
"""
import csv, json, sys
from collections import defaultdict
import pycountry

src, out = sys.argv[1], sys.argv[2]
ITEMS = {  # Field Shift crop id → FAOSTAT item code
    'millet': '79', 'sorghum': '83', 'maize': '56', 'groundnut': '242', 'cowpea': '195', 'sesame': '289',
    'wheat': '15', 'winterwheat': '15', 'barley': '44', 'flax': '333', 'rapeseed': '270', 'sunflower': '267',
    'lentil': '201', 'soybean': '236', 'potato': '116', 'rice': '27', 'bean': '176', 'chickpea': '191',
    'cotton': '328', 'pigeonpea': '197', 'mustard': '292', 'cassava': '125', 'fababean': '181', 'sweetpotato': '122',
    'oats': '75', 'pea': '187',
}
CODE2CROPS = defaultdict(list)
for k, v in ITEMS.items():
    CODE2CROPS[v].append(k)


def iso2(m49):
    m = m49.strip("'").lstrip('0') or '0'
    try:
        c = pycountry.countries.get(numeric=m.zfill(3))
        return c.alpha_2 if c else None
    except Exception:
        return None


def rows(path):
    with open(path, encoding='latin-1', newline='') as f:
        yield from csv.DictReader(f)


countries = {}
def entry(m49, name):
    a2 = iso2(m49)
    if not a2:
        return None
    if a2 not in countries:
        countries[a2] = {'iso2': a2, 'name': name, 'm49': m49.strip("'"), 'prices': {}}
    return countries[a2]

# --- producer prices (USD/tonne): latest year ≥ 2010 per crop ---
for r in rows(f'{src}/prices/Prices_E_All_Data_(Normalized).csv'):
    if r['Element Code'] != '5532' or r['Item Code'] not in CODE2CROPS or r['Months Code'] != '7021':
        continue
    y = int(r['Year'])
    if y < 2010 or not r['Value']:
        continue
    e = entry(r['Area Code (M49)'], r['Area'])
    if not e:
        continue
    for crop in CODE2CROPS[r['Item Code']]:
        cur = e['prices'].get(crop)
        if not cur or y > cur['year']:
            e['prices'][crop] = {'usdPerT': round(float(r['Value']), 1), 'year': y}

# --- exchange rates: latest annual LCU per USD ---
for r in rows(f'{src}/exch/Exchange_rate_E_All_Data_(Normalized).csv'):
    if r['Element Code'] != 'LCU' or r['Months Code'] != '7021' or not r['Value']:
        continue
    e = entry(r['Area Code (M49)'], r['Area'])
    if not e:
        continue
    y = int(r['Year'])
    if y >= e.get('fxYear', 0):
        e.update(currency=r['ISO Currency Code'], currencyName=r['Currency'], lcuPerUsd=float(r['Value']), fxYear=y)

# --- cropland nutrient budget (kg/ha of cropland): latest year ---
NUT = {('5081', '7276'): 'nBalanceKgHa', ('5087', '7276'): 'nMineralKgHa', ('5089', '7276'): 'nManureKgHa', ('5081', '7290'): 'nUsePct', ('5081', '7281'): 'pBalanceKgHa'}
for r in rows(f'{src}/nutrient/Environment_Cropland_nutrient_budget_E_All_Data_(Normalized).csv'):
    key = NUT.get((r['Item Code'], r['Element Code']))
    if not key or not r['Value']:
        continue
    e = entry(r['Area Code (M49)'], r['Area'])
    if not e:
        continue
    y = int(r['Year'])
    nb = e.setdefault('nutrients', {})
    if y >= nb.get(f'{key}_year', 0):
        nb[key] = round(float(r['Value']), 1)
        nb[f'{key}_year'] = y

# --- temperature change vs 1951–1980 (meteorological year), mean of the last 10 years ---
temp = defaultdict(dict)
for r in rows(f'{src}/temp/Environment_Temperature_change_E_All_Data_(Normalized).csv'):
    if r['Element Code'] != '7271' or r['Months Code'] != '7020' or not r['Value']:
        continue
    temp[(r['Area Code (M49)'], r['Area'])][int(r['Year'])] = float(r['Value'])
for (m49, name), by in temp.items():
    e = entry(m49, name)
    if not e or not by:
        continue
    last = max(by)
    yrs = [y for y in by if y > last - 10]
    e['warming'] = {'meanC': round(sum(by[y] for y in yrs) / len(yrs), 2), 'from': min(yrs), 'to': last, 'series': {str(y): round(v, 2) for y, v in sorted(by.items()) if y >= 1990}}

for e in countries.values():
    nb = e.get('nutrients')
    if nb:
        e['nutrientsYear'] = max(v for k, v in nb.items() if k.endswith('_year'))
        e['nutrients'] = {k: v for k, v in nb.items() if not k.endswith('_year')}
    e['pricesYearMax'] = max((p['year'] for p in e['prices'].values()), default=None)

import statistics
medians = {}
for crop in ITEMS:
    vals = [c['prices'][crop]['usdPerT'] for c in countries.values() if crop in c['prices'] and c['prices'][crop]['year'] >= 2018]
    if vals:
        medians[crop] = {'usdPerT': round(statistics.median(vals), 1), 'n': len(vals)}

data = {'globalMedianUsdPerT': medians, 'source': 'FAOSTAT bulk downloads: PP (producer prices), PE (exchange rates), ESB (cropland nutrient budget), ET (temperature change)',
        'retrieved': '2026-11-15', 'countries': dict(sorted(countries.items()))}
with open(out, 'w') as f:
    json.dump(data, f, separators=(',', ':'))
print(len(countries), 'countries;', sum(len(c['prices']) for c in countries.values()), 'prices')
for k in ['SN', 'KZ', 'KE', 'IN', 'BR', 'US', 'UA', 'ET', 'NG', 'VN']:
    c = countries.get(k, {})
    print(k, c.get('currency'), c.get('lcuPerUsd'), c.get('fxYear'), {p: v['usdPerT'] for p, v in list(c.get('prices', {}).items())[:6]}, c.get('nutrients'), c.get('warming', {}).get('meanC'))
