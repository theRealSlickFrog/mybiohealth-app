// Reading values bound for Caspio Number fields.
//
// The strategy builder keeps what the member typed as text, and lab readings
// arrive with qualifiers ("<0.5"). Caspio refuses the whole insert with
// InvalidInputValue if any Number field gets a non-numeric string, so values
// are read into real numbers only where the payload is built. The inputs keep
// showing exactly what was typed.
//
// readCaspioNumber(value, field) -> { ok: true, value: number | null } | { ok: false }
//   null / undefined / "" / whitespace    -> ok, null (the caller leaves it out)
//   a finite number                       -> ok, unchanged
//   "<0.5" ">90" "≤ 3" "≥3"               -> ok, the number; the sign is dropped
//   "1,234.5" (comma and point)           -> 1234.5 (comma = thousands)
//   "6,2" (comma only)                    -> 6.2    (comma = decimal)
//   "6.2 mmol/L"                          -> 6.2    (units stripped)
//   no number, or more than one ("4.5-5.5") -> not ok

const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

export function readCaspioNumber(value, field) {
  if (value == null) return { ok: true, value: null };
  if (typeof value === 'number') return Number.isFinite(value) ? { ok: true, value } : { ok: false };
  let s = String(value).trim();
  if (s === '') return { ok: true, value: null };

  const qualifier = s.match(/^([<>≤≥]=?)\s*/);
  if (qualifier) {
    console.info(`[caspio] ${field || 'value'}: dropped "${qualifier[1]}" from "${s}" and sent the number`);
    s = s.slice(qualifier[0].length);
  }

  s = s.includes('.') ? s.replace(/,/g, '') : s.replace(/,/g, '.');
  const found = s.match(NUMBER) || [];
  if (found.length !== 1) return { ok: false };
  const n = Number(found[0]);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
}
