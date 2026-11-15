"""Extract national yields for the hindcast from FAOSTAT QCL bulk files (values copied as published; nothing estimated).

Usage: python3 -I scripts/build-faostat-yields.py <Africa.csv> <Asia.csv> src/data/hindcast/faostat-yields.json
Inputs: Production_Crops_Livestock_E_Africa.csv / _Asia.csv unzipped from
  https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_{Africa,Asia}.zip
Element 5412 = Yield (kg/ha) in the current QCL release (formerly 5419, hg/ha).
"""
import csv, json, sys

africa, asia, out = sys.argv[1:4]
WANT = [  # (file, FAOSTAT area code, M49, item code, key)
    (africa, '195', '686', '79', 'SN-millet'),
    (africa, '195', '686', '242', 'SN-groundnut'),
    (asia, '108', '398', '15', 'KZ-wheat'),
]
series = {}
for path, area, m49, item, key in WANT:
    with open(path, encoding='latin-1', newline='') as f:
        for r in csv.DictReader(f):
            if r['Area Code'] == area and r['Item Code'] == item and r['Element Code'] == '5412':
                pts = []
                for y in range(2001, 2031):
                    v = r.get(f'Y{y}')
                    if v:
                        pts.append({'year': y, 'kgHa': round(float(v), 1), 'flag': r.get(f'Y{y}F', '')})
                series[key] = {'area': r['Area'], 'areaCode': int(area), 'm49': m49, 'item': r['Item'], 'itemCode': int(item),
                               'element': 'Yield', 'elementCode': 5412, 'unit': r['Unit'], 'points': pts}
doc = {
    'source': 'FAOSTAT, Crops and livestock products (QCL), regional bulk download (wide CSV)',
    'urls': ['https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_Africa.zip',
             'https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_Asia.zip'],
    'faostatPage': 'https://www.fao.org/faostat/en/#data/QCL',
    'retrieved': '2026-11-15',
    'fileLastModified': '2025-12-31',
    'flags': 'A official, E estimated, I imputed, X from international organizations (FAOSTAT flag codes)',
    'series': series,
}
with open(out, 'w') as f:
    json.dump(doc, f, indent=1)
print({k: len(v['points']) for k, v in series.items()})
