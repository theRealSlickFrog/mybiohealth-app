"""Build cgm_cycle payloads from a Libre 2 CSV export (raw or deid-cleaned).

Turns the LibreView table into one record per 14-day cycle, in the payload
contract the V2 frontend consumes (see CASPIO_CGM_API.md):

  - historic readings (Record Type 0) snapped to the 15-minute grid,
    de-duplicated (median when several land on one slot)
  - watched events from scan bursts (Record Type 1): consecutive scans no more
    than 15 minutes apart, at least 6 taps
  - notes (Record Type 6, non-blank) keyed to the day index
  - sensor coverage %

Cycle segmentation: contiguous wear runs (gap > 12 h between historic
readings = sensor change), each run chunked into consecutive 14-day cycles
from its first date. A trailing chunk shorter than --min-cycle-days is
dropped (the few hours of a sensor's 15th calendar date, typically).

Output: one JSON file per cycle shaped like the Caspio row
  {cycle_number, start_date, end_date, label, payload}
(payload is a compact JSON string). Pass --member-id to stamp the member's
Caspio UserGUID for direct POSTing to /rest/v2/tables/cgm_cycle/records.
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

SLICE_MIN = 15
CYCLE_DAYS = 14
WEAR_GAP_HOURS = 12
EVENT_GAP_MIN = 15          # scans further apart than this start a new burst
EVENT_MIN_TAPS = 6
TH_HI = 7.8                 # HIGH when a burst reaches this
TH_LO = 3.9                 # LOW when a burst dips below this
MMOL_PER_MGDL = 1 / 18.016
MAX_PAYLOAD_CHARS = 60000   # safety margin under Caspio's 64k text field

TS_FORMATS = ("%d-%m-%Y %H:%M", "%m-%d-%Y %I:%M %p", "%Y-%m-%d %H:%M")


def _parse_ts(value: str) -> datetime:
    for fmt in TS_FORMATS:
        try:
            return datetime.strptime(value.strip(), fmt)
        except ValueError:
            continue
    raise ValueError(f"unrecognised timestamp: {value!r}")


def _table(rows: list[list[str]]) -> tuple[list[str], list[list[str]]]:
    """Locate the header row (deid.py-compatible) and return (header, data)."""
    for index, row in enumerate(rows):
        cells = {c.strip().lower() for c in row}
        if "device timestamp" in cells and "record type" in cells:
            return row, rows[index + 1:]
    raise ValueError("could not locate CGM table header row")


def _col(header: list[str], *needles: str) -> int:
    for i, name in enumerate(header):
        low = name.strip().lower()
        if all(n in low for n in needles):
            return i
    raise ValueError(f"no column matching {needles!r}")


def parse_export(csv_path: Path) -> dict:
    """Read a Libre export → {readings, scans, notes}, glucose in mmol/L."""
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))
    header, data = _table(rows)

    c_ts = _col(header, "device timestamp")
    c_type = _col(header, "record type")
    c_hist = _col(header, "historic glucose")
    c_scan = _col(header, "scan glucose")
    c_note = _col(header, "notes")
    to_mmol = MMOL_PER_MGDL if "mg/dl" in header[c_hist].lower() else 1.0

    readings: list[tuple[datetime, float]] = []   # historic
    scans: list[tuple[datetime, float]] = []
    notes: list[tuple[datetime, str]] = []
    for row in data:
        if len(row) <= max(c_ts, c_type, c_hist, c_scan, c_note):
            continue
        rtype = row[c_type].strip()
        if rtype not in ("0", "1", "6"):
            continue
        ts = _parse_ts(row[c_ts])
        if rtype == "0" and row[c_hist].strip():
            readings.append((ts, round(float(row[c_hist]) * to_mmol, 1)))
        elif rtype == "1" and row[c_scan].strip():
            scans.append((ts, round(float(row[c_scan]) * to_mmol, 1)))
        elif rtype == "6":
            text = " · ".join(part.strip() for part in row[c_note].splitlines() if part.strip())
            if text:
                notes.append((ts, text))

    readings.sort(key=lambda x: x[0])
    scans.sort(key=lambda x: x[0])
    notes.sort(key=lambda x: x[0])
    return {"readings": readings, "scans": scans, "notes": notes}


def wear_runs(readings: list[tuple[datetime, float]]) -> list[list[tuple[datetime, float]]]:
    """Split historic readings into contiguous wear runs (gap > 12 h splits)."""
    runs: list[list[tuple[datetime, float]]] = []
    gap = timedelta(hours=WEAR_GAP_HOURS)
    for point in readings:
        if not runs or point[0] - runs[-1][-1][0] > gap:
            runs.append([])
        runs[-1].append(point)
    return runs


def cycle_windows(runs: list[list[tuple[datetime, float]]], min_days: int) -> list[tuple[date, date]]:
    """Chunk each run's calendar dates into consecutive 14-day cycles."""
    windows: list[tuple[date, date]] = []
    for run in runs:
        start, last = run[0][0].date(), run[-1][0].date()
        while start <= last:
            end = start + timedelta(days=CYCLE_DAYS - 1)
            covered = (min(end, last) - start).days + 1
            if covered >= min_days:
                windows.append((start, end))
            start = end + timedelta(days=1)
    return windows


def _snap(ts: datetime) -> tuple[date, int]:
    """Snap to the nearest 15-min slot; 24:00 rolls into the next day."""
    minute = ts.hour * 60 + ts.minute
    slot = round(minute / SLICE_MIN) * SLICE_MIN
    if slot >= 1440:
        return ts.date() + timedelta(days=1), 0
    return ts.date(), slot


def grid_days(readings: list[tuple[datetime, float]], start: date) -> list[list[list[float]]]:
    """14 day-arrays of [minute, mmol] pairs, deduped (median per slot)."""
    slots: list[dict[int, list[float]]] = [dict() for _ in range(CYCLE_DAYS)]
    end = start + timedelta(days=CYCLE_DAYS - 1)
    for ts, g in readings:
        day, slot = _snap(ts)
        if start <= day <= end:
            slots[(day - start).days].setdefault(slot, []).append(g)
    return [
        [[t, round(statistics.median(vals), 1)] for t, vals in sorted(day.items())]
        for day in slots
    ]


def burst_events(scans: list[tuple[datetime, float]], start: date) -> list[dict]:
    """Cluster scan taps into watched events for one cycle window."""
    end = start + timedelta(days=CYCLE_DAYS - 1)
    window = [s for s in scans if start <= s[0].date() <= end]

    clusters: list[list[tuple[datetime, float]]] = []
    for point in window:
        if not clusters or point[0] - clusters[-1][-1][0] > timedelta(minutes=EVENT_GAP_MIN):
            clusters.append([])
        clusters[-1].append(point)

    events = []
    for cluster in clusters:
        if len(cluster) < EVENT_MIN_TAPS:
            continue
        day0 = cluster[0][0].date()
        # minute-of-day relative to the burst's first day; a burst crossing
        # midnight continues past 1440 so it stays monotonic for display
        burst = [
            [(ts.date() - day0).days * 1440 + ts.hour * 60 + ts.minute, g]
            for ts, g in cluster
        ]
        values = [g for _, g in burst]
        lo, hi = min(values), max(values)
        kind = "LOW" if lo < TH_LO else "HIGH" if hi >= TH_HI else "MID"
        slot = min(round(burst[0][0] / SLICE_MIN) * SLICE_MIN, 1425)
        events.append({
            "day": (day0 - start).days,
            "taps": len(cluster),
            "lo": lo, "hi": hi,
            "kind": kind,
            "t0": f"{slot // 60:02d}:{slot % 60:02d}",
            "slot": slot,
            "burst": burst,
        })
    events.sort(key=lambda e: (e["day"], e["slot"]))
    return events


def day_notes(notes: list[tuple[datetime, str]], start: date) -> dict[str, list[dict]]:
    end = start + timedelta(days=CYCLE_DAYS - 1)
    out: dict[str, list[dict]] = {}
    for ts, text in notes:
        if start <= ts.date() <= end:
            key = str((ts.date() - start).days)
            out.setdefault(key, []).append({"time": f"{ts.hour:02d}:{ts.minute:02d}", "text": text})
    return out


def _trim_to_fit(payload: dict) -> dict:
    """Keep the payload under Caspio's text limit by shedding smallest events."""
    while len(json.dumps(payload, separators=(",", ":"))) > MAX_PAYLOAD_CHARS and payload["events"]:
        payload["events"].remove(min(payload["events"], key=lambda e: e["taps"]))
    return payload


def build_cycles(parsed: dict, min_days: int) -> list[dict]:
    """All cycle records for one export: [{cycle_number, start_date, …, payload}]."""
    windows = cycle_windows(wear_runs(parsed["readings"]), min_days)
    records = []
    for number, (start, end) in enumerate(windows, 1):
        days = grid_days(parsed["readings"], start)
        n_readings = sum(len(d) for d in days)
        payload = _trim_to_fit({
            "v": 1,
            "days": days,
            "events": burst_events(parsed["scans"], start),
            "notes": day_notes(parsed["notes"], start),
            "sensor": round(100 * n_readings / (CYCLE_DAYS * 96)),
        })
        records.append({
            "cycle_number": number,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "label": f"{start.strftime('%b')} {start.day} – {end.strftime('%b')} {end.day}, {end.year}",
            "payload": json.dumps(payload, separators=(",", ":")),
        })
    return records


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Libre 2 CSV → cgm_cycle payload JSON files.")
    parser.add_argument("csv_file", type=Path, help="Libre export (raw or deid-cleaned)")
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--member-id", default=None, help="Caspio UserGUID to stamp into each record")
    parser.add_argument("--min-cycle-days", type=int, default=10,
                        help="drop trailing chunks with fewer covered days (default 10)")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    parsed = parse_export(args.csv_file)
    records = build_cycles(parsed, args.min_cycle_days)
    args.out_dir.mkdir(parents=True, exist_ok=True)

    for rec in records:
        if args.member_id:
            rec = {"member_id": args.member_id, **rec}
        out = args.out_dir / f"cycle_{rec['cycle_number']:02d}_{rec['start_date']}.json"
        out.write_text(json.dumps(rec, indent=2), encoding="utf-8")
        payload = json.loads(rec["payload"])
        print(f"{out.name}: {rec['label']}"
              f" · {sum(len(d) for d in payload['days'])} readings"
              f" · {len(payload['events'])} events"
              f" · {sum(len(v) for v in payload['notes'].values())} notes"
              f" · sensor {payload['sensor']}%"
              f" · {len(rec['payload'])} chars")
    print(f"{len(records)} cycle(s) written to {args.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
