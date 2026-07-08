# mybiohealth-app

MyBioHealth V2 — Vite + React SPA. Data comes from Caspio through the
kenises-api-proxy; the member is identified by a UserGUID handed off from the
Caspio login (see `src/lib/auth.js`).

## Glucose Summary (CGM)

The Glucose page renders 14-day CGM cycles in the M4 design. It currently
runs on clearly-labeled **mock data** (`src/lib/glucoseSample.js`) and is
fully wired to go live — the sample retires automatically per member once the
`cgm_cycle` Caspio table has their rows.

- **Connecting the APIs**: step-by-step checklist, table schema, payload
  contract, and troubleshooting in [`pipeline/CASPIO_CGM_API.md`](pipeline/CASPIO_CGM_API.md).
- **Code touchpoints**: grep the source for `API-CONNECT` — each tag marks a
  request the Caspio side must serve (cycles GET, voices GET/PUT/POST).
- **Pipeline**: `pipeline/deid.py` (strip PII from Libre 2 exports) →
  `pipeline/build_payload.py` (export → one JSON record per cycle).
  Tests: `python -m unittest discover -s tests`.
