# LynxEye — Vibration Diagnostic Engine

Browser-based vibration analysis platform. ISO 10816 / ISO 13379 / ISO 13381 / ISO 13373 / ISO 55001 ringfenced.

**Live app:** https://kairosaxiom.github.io/AxiomAnare

> Note: the product is **LynxEye**; the GitHub repo and live-URL path remain `AxiomAnare` by design
> (display-name-only rebrand — the repo was intentionally not renamed). See CONTEXT.md / DECISIONS.md
> for the full naming map.

## What it does
- Upload any vibration data file (CSV, TSV, XLSX, XLS, JSON, TXT)
- Runs 6-stage diagnostic chain (Ingest → Baseline → Trend → ISO Zone → Fault Classification → RUL)
- Detects shaft frequency via harmonic comb search
- Classifies faults from FFT spectrum using ISO 13379-1 frequency rules
- Generates ISO-cited recommendations via Claude AI

## Tech
- Pure HTML/JS — no build step, no framework
- Chart.js for FFT + radar charts
- PapaParse + SheetJS for file parsing
- Anthropic Claude API for AI recommendations
- All thresholds and rules in CONFIG layer — zero hardcoding in logic

## Development
Edit `index.html` directly. Push to `main` → GitHub Pages auto-deploys.
