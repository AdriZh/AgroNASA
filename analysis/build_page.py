"""Inject data/summary.json into page_template.html -> field-shift-analysis.html"""
import json, pathlib
h = pathlib.Path(__file__).parent
data = json.loads((h / "data/summary.json").read_text())
for s in data["sites"].values():
    for c in s["crops"]:
        for y in c["years"]: y.pop("eta", None)
blob = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
(h / "field-shift-analysis.html").write_text((h / "page_template.html").read_text().replace("__DATA__", blob))
print("ok", (h / "field-shift-analysis.html").stat().st_size)
