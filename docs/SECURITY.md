# Security

Field Shift is a static single-page app (Vite + React 18 + TypeScript) served from GitHub Pages at
`https://adrizh.github.io/AgroNASA/`. It has no backend, no accounts and no API keys. Farm data stays in the
browser: scenarios in `localStorage`, cached public datasets in IndexedDB. The attack surface is therefore
(1) untrusted input that reaches the page (share links, imported files, device storage, third-party API
responses), (2) the third-party code and hosts the page loads, and (3) the build and deploy pipeline.

Review date: 2026-11-15.

## What was checked and the results

| Area | Result | Fix |
| --- | --- | --- |
| **Secrets** in the working tree, the full git history (`git log -p --all`, grepped for API keys, tokens, passwords, private keys and common key formats such as `AKIA…`, `ghp_…`, `AIza…`, `sk-…`), `.env` files, `dist/` and the workflow | **None found.** No `.env` file has ever been committed. The only hits are React and Recharts internals in `dist/` and `secrets.GITHUB_TOKEN` in the workflow, which GitHub injects at run time. The app reads no `VITE_*` variables. | None needed. |
| **`npm audit`** | Before: 2 critical (vitest / tinypool prototype pollution leading to remote code execution), 1 high (vite), 2 moderate (esbuild dev server, `@vitest/mocker`). All are **dev-only**: none of this code ships to the browser. `npm audit fix` without `--force` could not resolve them. | Upgraded to vite 6.4.6, vitest 4.1.12 and `@vitejs/plugin-react` 4.7.0, and made `vite-node` 3.2.4 a direct dev dependency for the data scripts. **0 vulnerabilities.** Verified that `npm ci` (npm 10, as in CI), the tests, the build and `npm run demo:print` all pass. |
| **XSS sinks** (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write`, `insertAdjacentHTML`) | **None in `src/`.** All user text (farm name, place label, notes, inflow labels, fertilizer names) is rendered as React text, so it is escaped. The printable report and the PDF (the browser's print-to-PDF of the same DOM) are covered by the same escaping. | None needed. |
| **`href` from data** | **Medium.** NASA EONET event links were rendered as `<a href>` straight from the API payload, and React 18 does not block `javascript:` URLs. | `safeHttpUrl()` keeps only absolute `http(s)` URLs. Every other `href` comes from bundled constants or URLs the app builds itself. |
| **Share links** (`#/compare?s=<base64url JSON>`) | Already validated by type and range, with these gaps: crop ids were checked with `CROPS[id]`, so `"constructor"` passed (**low**: it could crash the plan view); over-long strings and open-ended amounts were not bounded; the token limit was 8000 characters. | Tokens over **8 kB** are rejected before decoding. The scenario is built field by field, so unknown keys, `__proto__` and `constructor` are never copied. Crop ids must be own keys of `CROPS`. Price-override keys must match `crop:item`. Strings are capped and stripped of control and bidi-override characters. Lists are capped. Money, quantity and price values are clamped to 0–10¹³. |
| **Imported scenario file** (Report → Import) | **Medium (persistent denial of service).** The only check was `location` plus a `history` array. A file with, say, `"name": {}` was saved to `localStorage` and crashed the app on every later load until the site data was cleared. | Files over 2 MB are refused. The file goes through `sanitizeScenario()`, which applies the same rules as a share link, and a failure shows a message. |
| **Device storage** (`localStorage` scenarios, IndexedDB caches) | Read back without checks. Corrupted entries, or entries from an older version, could crash the app. | Stored scenarios are validated on load, and invalid ones are skipped. Fields that older versions did not save get the old defaults, and ids and exact coordinates are kept. `idbGet()` takes a shape check (weather series, soil profile, GIBS point), and a malformed cache entry is refetched. |
| **External fetches** | All API requests go to fixed **HTTPS** hosts through `fetchWithTimeout` (8–40 s timeouts, `AbortController`). Nothing fetched is ever evaluated. **Low:** a few response shapes were trusted. A non-string Nominatim label or EONET title would crash React, and a POWER body with absurd date keys could allocate a huge array. | EONET, Open-Meteo, Nominatim, NASA POWER (keys must be `YYYYMMDD`, at most 22 000 days) and SoilGrids payloads are type-checked. Bad items are skipped, and a bad response gives a handled error. GIBS tiles are only decoded as images. Colormap XML is parsed with regexes, never inserted into the DOM. |
| **External links** | 4 `target="_blank"` links had `rel="noreferrer"`, which implies noopener in modern browsers. | All now have `rel="noopener noreferrer"`. |
| **GitHub Actions** (`.github/workflows/deploy.yml`) | `contents: write` was granted to the whole workflow. Actions were pinned to moving major tags. The token was templated into the `run:` script. No untrusted event data (PR titles, branch names) reaches a `run:` line, and the workflow only runs on `push` to `main` and `workflow_dispatch`. | `permissions: {}` at workflow level, with `contents: write` only on the job that pushes. `actions/checkout` and `actions/setup-node` are pinned to full commit SHAs (v4.4.0). Checkout runs with `persist-credentials: false`. The token reaches the push through an environment variable. The deploy mechanism is unchanged: it force-pushes `dist/` to `gh-pages`, then verifies the live URL. |

Tests: `tests/security.test.ts` covers an oversized token, `__proto__` and `constructor` pollution in links and
files, prototype-key crop ids, wrong types, `javascript:` and markup strings, clamping and caps, round-trips of
stored and older-version scenarios, and malformed EONET, Open-Meteo, Nominatim, POWER and SoilGrids payloads.

## Content Security Policy

GitHub Pages cannot set response headers, so the policy is a `<meta http-equiv="Content-Security-Policy">` in
`index.html`. The built page carries:

```
default-src 'self';
script-src 'self' 'sha256-<inline preload script>' 'unsafe-hashes' 'sha256-<fonts onload handler>';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https://{a,b,c}.tile.openstreetmap.org https://gibs.earthdata.nasa.gov;
connect-src 'self' https://power.larc.nasa.gov https://rest.isric.org https://gibs.earthdata.nasa.gov
            https://eonet.gsfc.nasa.gov https://api.open-meteo.com https://nominatim.openstreetmap.org;
media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'
```

Why each part is there:

- **`script-src` has no `'unsafe-inline'`.** All application code is bundled same-origin chunks. The build adds two
  inline items that the policy allows **by hash only**: the small script that preloads the first screen's data
  chunk, and the `onload="this.media='all'"` handler that loads Google Fonts without blocking first paint. That
  handler needs `'unsafe-hashes'`, which allows only that exact handler text. The `cspHashes` plugin in
  `vite.config.ts` computes the hashes from the final HTML on every build, so they cannot go stale. The
  dev server removes the tag, because Vite injects its own inline React-refresh script there.
- **`style-src 'unsafe-inline'`** is needed because React `style={…}` props, framer-motion animations, Recharts
  and Leaflet all set inline styles. CSS injection is a much smaller risk than script injection, and no user text is
  ever written into a style. Google Fonts CSS comes from `fonts.googleapis.com` and the font files from
  `fonts.gstatic.com`.
- **`connect-src`** lists exactly the APIs the code calls. Everything is HTTPS, so a mixed-content or
  attacker-chosen endpoint is refused.
- **`img-src`** covers OSM base tiles (Leaflet uses the `a`, `b` and `c` subdomains), GIBS imagery tiles, and
  `data:`/`blob:` for the inline favicon and generated images. **`media-src 'self'`** covers the bundled MP4 and M4A
  files.
- **`object-src 'none'`, `base-uri 'self'`** block plugin content and `<base>` hijacking of the relative asset URLs.
  `frame-ancestors` is not available in a meta tag (see residual risks).

Verified against `vite preview` with `scripts/smoke.cjs`, online and `--offline`: 0 errors and no CSP
violations (Chrome reports them as console errors, which the smoke script fails on). A separate browser check
confirmed that OSM and GIBS map tiles load on Farm and Evidence → Satellite layers, that GIBS point decoding
works, and that the Inter font loads (so the onload hash is accepted). The check found no
`securitypolicyviolation` events.

## Residual risks

- **No `frame-ancestors` and no other headers.** GitHub Pages cannot send `Content-Security-Policy`,
  `X-Frame-Options` or `Permissions-Policy` headers, so the site can be framed (clickjacking). The only actions
  are local, such as "delete all local data", and they ask for confirmation. Moving to a host that sets headers would close this.
- **`style-src 'unsafe-inline'`** stays for the reasons above.
- **Third-party availability and integrity.** The app trusts NASA, ISRIC, Open-Meteo, OpenStreetMap and Google over
  HTTPS. Their responses are validated, but a compromised provider could still return plausible wrong numbers.
  The Google Fonts stylesheet is loaded without subresource integrity (SRI), because Google serves different
  CSS to each browser.
- **Share links are not signed.** Anyone can craft a link. It is validated and only ever adds a new local scenario,
  but it can contain misleading farm data.
- **Local data is not encrypted.** Anyone with access to the device or browser profile can read the scenarios.
  "Delete all local data" on the Report page clears them.
- **Supply chain.** `npm ci` runs dependency install scripts in CI with a job token that can push `gh-pages`. Pinned
  versions in the lockfile and `npm audit` reduce the risk but cannot remove it. Recharts 2.x is
  deprecated upstream (no known vulnerabilities).
- `.gitignore` does not list `.env*`. No env files exist today, but adding the pattern would guard against an
  accidental commit.
