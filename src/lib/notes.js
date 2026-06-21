// Per-page personal notes ("MyNote"). One member_info row per (member, page),
// feature='PAGE_NOTE'.
//   text_box_1 = the note KEY (page identifier) — short, Text(255).
//   text_box_2 = the note TEXT — Text(64000), so notes aren't length-capped.
// (text_box_2 holds the body deliberately: it's the wide field. text_box_1's
// 255 cap is fine for the key.)

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';
const TABLE = 'member_info';
const FEATURE = 'PAGE_NOTE';

const whereFor = (member, key) =>
  `member_id='${member}' AND feature='${FEATURE}' AND text_box_1='${key}'`;

// Returns { id, text } — id is null when no note exists yet.
export async function loadNote(member, key) {
  const url = `${API_BASE}/rest/v2/tables/${TABLE}/records?q.where=${encodeURIComponent(whereFor(member, key))}&q.limit=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`load ${r.status}`);
  const row = ((await r.json()).Result || [])[0];
  return row ? { id: row.member_info_id, text: row.text_box_2 || '' } : { id: null, text: '' };
}

// Inserts (POST) or updates (PUT). Returns the row id for subsequent updates.
export async function saveNote(member, key, text, existingId) {
  if (existingId) {
    const url = `${API_BASE}/rest/v2/tables/${TABLE}/records?q.where=${encodeURIComponent(`member_info_id=${existingId}`)}`;
    const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text_box_2: text }) });
    if (!r.ok) throw new Error(`save ${r.status}`);
    return existingId;
  }
  const url = `${API_BASE}/rest/v2/tables/${TABLE}/records?response=rows`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ member_id: member, feature: FEATURE, text_box_1: key, text_box_2: text }),
  });
  if (!r.ok) throw new Error(`save ${r.status}`);
  // Try to read the new id from the response; otherwise re-load to get it.
  try {
    const j = JSON.parse(await r.text());
    const id = j && j.Result && j.Result[0] && j.Result[0].member_info_id;
    if (id) return id;
  } catch (e) { /* fall through to reload */ }
  return (await loadNote(member, key)).id;
}
