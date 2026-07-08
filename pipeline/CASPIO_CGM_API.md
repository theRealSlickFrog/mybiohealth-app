# CGM Cycle — Caspio API contract

The V2 Glucose Summary page (`src/pages/GlucoseSummaryPage.jsx`, data layer
`src/lib/glucoseCycle.js`) renders one 14-day CGM cycle per record from a new
Caspio table, fetched through the existing proxy
(`kenises-api-proxy.netlify.app`). The frontend computes **all** derived
figures client-side (percentile bands, per-day medians, time-above-7.8,
weekday/weekend splits, sensor coverage) — Caspio stores data, not math.
Until a member has rows here, the app shows a clearly-labeled sample cycle.

## 0. Connection checklist

The frontend is **fully wired already** — every request below ships in the
app today, and the mock sample cycle retires automatically per member once
real rows come back. Nothing in `src/` needs to change to go live. Grep the
code for **`API-CONNECT`** to see each touchpoint:

| Tag                         | Where                                    | Call                                        |
| --------------------------- | ---------------------------------------- | ------------------------------------------- |
| `API-CONNECT(proxy)`        | `src/lib/glucoseCycle.js` (API_BASE)     | proxy base URL, dev `/api` vs prod          |
| `API-CONNECT(cycles)`       | `glucoseCycle.js` → `loadGlucoseCycles`  | `GET cgm_cycle` by member GUID              |
| `API-CONNECT(voices-read)`  | `glucoseCycle.js` → `loadVoices`         | `GET member_info` CGM_VOICE_* rows          |
| `API-CONNECT(voices-write)` | `glucoseCycle.js` → `saveVoice`          | `PUT`/`POST member_info` (autosave)         |
| (mock)                      | `src/lib/glucoseSample.js`               | fallback data — keep; it's the empty state  |

Steps to connect, in order:

1. **Create the `cgm_cycle` table** in Caspio with the fields in §1.
2. **Proxy allowlist** on kenises-api-proxy: allow `GET` for `cgm_cycle`, and
   confirm `PUT` passes through for `member_info` (`POST` already works —
   activity_log uses it). No frontend origin changes needed.
3. **Generate cycle records** from a member's Libre export (§4):
   ```
   python pipeline/deid.py export.csv --member-code M1 --registry members.json --out-dir cleaned/
   python pipeline/build_payload.py cleaned/M1_*_cleaned.csv --out-dir cycles/ --member-id <UserGUID>
   ```
4. **Upload** each file (or paste rows into Caspio while volume is low):
   ```
   curl -X POST "https://kenises-api-proxy.netlify.app/rest/v2/tables/cgm_cycle/records" \
        -H "Content-Type: application/json" \
        -d @cycles/cycle_01_2025-12-07.json
   ```
   (Each file is exactly one row: member_id, cycle_number, start_date,
   end_date, label, payload. Add auth headers if/when the proxy enforces them.)
5. **Verify in the app**, logged in as that member (or admin view-as):
   - the amber "Sample cycle" banner is gone and the newest cycle shows;
   - the header pager reads "cycle 1 / N" and walks older cycles;
   - typing in the Member voice box settles to "saved" (not "couldn't save").

Troubleshooting:

| Symptom                              | Likely cause                                                        |
| ------------------------------------ | ------------------------------------------------------------------- |
| Sample banner won't go away          | `GET cgm_cycle` blocked by proxy, or no rows for this exact GUID (console shows `cgm_cycle fetch failed`) |
| Cycle missing/blank chart            | `payload` not valid JSON or missing `days` — the row is skipped (console warning) |
| Voice box stuck on "couldn't save"   | proxy rejects `PUT member_info`, or `date_2` stored with a time component so the where-clause never matches |
| Voices save but vanish on reload     | `date_2` on the row ≠ cycle `end_date` (must match, date-only)      |

## 1. Table: `cgm_cycle`

One row per member per 14-day cycle.

| Field          | Caspio type      | Notes                                                       |
| -------------- | ---------------- | ----------------------------------------------------------- |
| `member_id`    | Text (255)       | The member's UserGUID (same GUID used everywhere in V2).    |
| `cycle_number` | Number (integer) | 1, 2, 3… per member. Newest = highest. Drives sort order.   |
| `start_date`   | Date/Time        | First day of the cycle (date only).                         |
| `end_date`     | Date/Time        | Last day of the cycle (date only).                          |
| `label`        | Text (255)       | Optional. Blank → frontend derives "Jun 11 – Jun 24, 2026". |
| `payload`      | Text (64000)     | The JSON blob below. M4's real cycle is ~13k chars.         |

Frontend read (already implemented):

```
GET /rest/v2/tables/cgm_cycle/records?q.where=member_id='<GUID>'&q.limit=100
```

The proxy must allow this table for GET (and the pipeline's upload path needs
POST, however that side is authenticated).

## 2. `payload` JSON

Produced by the pipeline from the de-identified Libre 2 export
(`pipeline/deid.py` → 15-min grid, 14-day cycle). Compact form — no
pretty-printing, points as `[minute, mmol]` pairs:

```json
{
  "v": 1,
  "days": [
    [[0, 7.7], [675, 6.1], [690, 5.7]],
    [[15, 9.9], [30, 11.2]]
  ],
  "events": [
    { "day": 1, "taps": 6, "lo": 6.4, "hi": 9.2, "kind": "HIGH",
      "t0": "20:00", "slot": 1200,
      "burst": [[1195, 9.2], [1196, 9.2], [1201, 7.8]] }
  ],
  "notes": {
    "0":  [{ "time": "11:25", "text": "First reading on June 11" }],
    "12": [{ "time": "20:59", "text": "Golfing low food intake this afternoon" }]
  },
  "sensor": 81,
  "band": { "src": "MBH phenotype", "on": [4.5, 5.5], "day": [4.8, 6.0], "floor": 3.9 }
}
```

- **`days`** (required) — one array per calendar day, in order from
  `start_date`. Each point is `[minute-of-day (0…1425, 15-min grid), mmol/L]`.
  Gaps are simply missing points. Historic (de-duplicated) readings only.
  `{ "t": 0, "g": 7.7 }` object form is also accepted.
- **`events`** (optional) — "watched moments": bursts of scans clustered in
  time (Libre scan records). `kind` is `HIGH` / `MID` / `LOW`; `burst` points
  are minute-resolution (not snapped to the grid); `t0` is a display time;
  `slot` is the nearest 15-min slot; `lo`/`hi` are the burst extremes.
- **`notes`** (optional) — keyed by day index (string), each entry
  `{ time: "HH:MM" | null, text }`. From Libre note records.
- **`sensor`** (optional) — % of expected readings present. Omitted →
  computed as `readings / (days × 96)`.
- **`band`** (optional) — reference-band override (member→unit→phenotype→
  literature resolution done upstream). Omitted → frontend defaults
  (overnight 4.5–5.5, daytime 4.8–6.0, floor 3.9, src "MBH phenotype").

Everything else the page shows (p25/p50/p75 bands per 15-min slice, per-day
medians, TAR hours, weekday/weekend splits, midnight–3 AM medians) is derived
in `glucoseCycle.js` — verified to reproduce the design's reference values to
±0.01 across 900+ comparisons.

## 3. Voices — `member_info` rows (already-existing table)

The three free-text boxes (Member / MBH / Clinician) per cycle, mirroring how
`CGM_NOTE` works today:

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| `member_id`  | UserGUID                                                        |
| `feature`    | `CGM_VOICE_MEMBER` \| `CGM_VOICE_MBH` \| `CGM_VOICE_CLINICIAN` |
| `date_2`     | Cycle **end date** (date only — the frontend matches on it)    |
| `text_box_1` | The text                                                        |

Frontend behavior (already implemented):

- Load: `GET member_info?q.where=member_id='<GUID>' AND feature IN (…)`,
  matched client-side on `date_2` = cycle end date.
- Save: autosaved ~1.2 s after typing stops. `PUT` with
  `q.where=member_id='…' AND feature='…' AND date_2='YYYY-MM-DD'`; if
  0 records affected (or the row never existed) it falls back to `POST`.
  ⚠ `date_2` must be stored date-only (no time component) or the PUT match
  fails and duplicates could accumulate.
- Permissions: the Member box is editable by the member; MBH and Clinician
  boxes are editable only in admin sessions (JWT role/impersonation via
  `isAdminSession()`), read-only otherwise. Adjust in
  `GlucoseSummaryPage.jsx` if policy differs.

The proxy must allow `member_info` PUT for these rows (POST is already used
for `activity_log`; confirm PUT is passed through).

## 4. Pipeline

Implemented — `pipeline/build_payload.py` turns a Libre 2 export (raw or
deid-cleaned, mmol/L or mg/dL, either LibreView header variant) into one JSON
file per cycle, ready to POST:

```
python pipeline/deid.py export.csv --member-code M1 --registry members.json --out-dir cleaned/
python pipeline/build_payload.py cleaned/M1_*_cleaned.csv --out-dir cycles/ [--member-id <UserGUID>]
```

Rules (tested in `tests/test_build_payload.py`):

- **Readings** (Record Type 0) snapped to the nearest 15-min slot (24:00 rolls
  into the next day); several readings on one slot → median.
- **Cycles**: contiguous wear runs (gap > 12 h between historic readings =
  sensor change), each run chunked into consecutive 14-day windows from its
  first date; a trailing chunk under `--min-cycle-days` (default 10) is
  dropped — typically the few hours on a sensor's 15th calendar date.
- **Events** (Record Type 1 scans): consecutive taps ≤ 15 min apart, ≥ 6 taps.
  `LOW` if the burst dips below 3.9, else `HIGH` if it reaches 7.8, else `MID`.
  Bursts crossing midnight keep minutes > 1440 so they stay monotonic.
- **Notes** (Record Type 6, non-blank): multi-line text joined with " · ",
  keyed to the day index. Food-flag rows (Type 5) are ignored.
- Payloads exceeding ~60k chars shed their smallest events to fit Caspio's
  64k field (real cycles run 15–23k, so this is a safety net).

Remaining (Caspio side):

1. Upload: `POST /rest/v2/tables/cgm_cycle/records` per cycle file (or paste
   into Caspio directly while volume is low).
2. Map the pipeline's de-identified `member_id` (UUID from `deid.py`'s
   registry) to the Caspio UserGUID at upload time (`--member-id`) — the
   registry file is the only place both are known together.

Note on `deid.py`: the pre-table region of the export is now **dropped
entirely** (replaced with a `member_uuid,<uuid>` provenance row) instead of
pattern-matched, because LibreView's "Patient report" variant carries the
member's bare name/DOB with no field labels. What isn't kept can't leak.
