// Per-page personal notes ("MyNote"). Generalizes V1's CGM personal-note
// pattern: one member_info row per (member, page), feature='PAGE_NOTE',
// text_box_2 = page key, text_box_1 = note text. Same POST/PUT path the V1
// glucose page uses, so it's a known-good write through the proxy.

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';
const TABLE = 'member_info';
const FEATURE = 'PAGE_NOTE';

const whereFor = (member, key) =>
  `member_id='${member}' AND feature='${FEATURE}' AND text_box_2='${key}'`;

// Returns { id, text } — id is null when no note exists yet.
export async function loadNote(member, key) {
  const url = `${API_BASE}/rest/v2/tables/${TABLE}/records?q.where=${encodeURIComponent(whereFor(member, key))}&q.limit=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`load ${r.status}`);
  const row = ((await r.json()).Result || [])[0];
  return row ? { id: row.member_info_id, text: row.text_box_1 || '' } : { id: null, text: '' };
}

// Inserts (POST) or updates (PUT). Returns the row id for subsequent updates.
export async function saveNote(member, key, text, existingId) {
  if (existingId) {
    const url = `${API_BASE}/rest/v2/tables/${TABLE}/records?q.where=${encodeURIComponent(`member_info_id=${existingId}`)}`;
    const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text_box_1: text }) });
    if (!r.ok) throw new Error(`save ${r.status}`);
    return existingId;
  }
  const url = `${API_BASE}/rest/v2/tables/${TABLE}/records?response=rows`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ member_id: member, feature: FEATURE, text_box_2: key, text_box_1: text }),
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
