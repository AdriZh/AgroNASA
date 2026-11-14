# Field Shift: problem analysis

Data analysis behind the team's problem framing for NASA Space Apps 2026, Challenge 6.

- `fetch_data.py` downloads NASA POWER daily weather (2001–2025) and ISRIC SoilGrids profiles for three sites into `data/`.
- `analyze.py` computes FAO-56 ET0, a daily soil-water bucket replay per crop, the post-harvest window, and Theil–Sen / Mann–Kendall trends into `data/summary.json`.
- `build_page.py` injects the summary into `page_template.html` and writes `field-shift-analysis.html` (open it in a browser).

```bash
python3 analysis/fetch_data.py && python3 analysis/analyze.py && python3 analysis/build_page.py
```

Requires `numpy` and `pandas`. Ky values for lentil, chickpea, flax and canola are assumptions to be reviewed by an agronomist.
