// First-login onboarding: the answers collected in the Welcome modal.
//
// Every step is saved to Caspio as the member completes it, and everything is
// loaded back when the modal opens, so a refresh mid-flow resumes where the
// member left off. Nothing lives only in browser memory.
//
// Where each answer lands:
//   expectations       member_info, feature='PAGE_NOTE', text_box_1='ONBOARDING_EXPECTATIONS',
//                      text_box_2=text (the notes table, via lib/notes.js)
//   membership type    member_info, feature='MEMBERSHIP_TYPE', text_box_1=one|one_plus|gift|gifted
//   mobile             legal_entity.PhoneNumber
//   comms preference   member_info, feature='COMMS_PREFERENCE', text_box_1=Email|Text|Both
//   date of birth      member_info, feature='DATE_OF_BIRTH', text_box_1='YYYY-MM-DD'
//   other members      member_info, feature='GROUP_MEMBERS', text_box_2=JSON [{name,email,how}]
//                      (how = spoken|contact|advise, as in Ken's prototype)
//   gift recipient     member_info, feature='GIFT_RECIPIENT', text_box_2=JSON {first,last,email}
//   gift code          member_info, feature='GIFT_CODE', text_box_1=gifter's email or
//                      invitation code (gifted members, or "Have an invitation?")
//   doctor visit       member_info, feature='DOCTOR_VISIT', text_box_1=week|two_weeks|month,
//                      text_box_2=JSON {when, byDate:'YYYY-MM-DD', committedAt: ISO}
//   progress           member_info, feature='ONBOARDING_STEP', text_box_1=step key
//
// legal_entity has no date-of-birth or comms-preference field (checked against a
// table export, Oct 2026: UserGUID, names, alias, PhoneNumber, Email, password,
// user_role, dates, allowed_pages, is_admin, app_preference, eula_*), so those
// two live in member_info.
// All values are text: nothing here writes to a Caspio Number field.
import { loadNote, saveNote } from './notes.js';

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';
const EXPECTATIONS_KEY = 'ONBOARDING_EXPECTATIONS';

const FEATURES = {
  type: 'MEMBERSHIP_TYPE',
  comms: 'COMMS_PREFERENCE',
  dob: 'DATE_OF_BIRTH',
  group: 'GROUP_MEMBERS',
  giftRecipient: 'GIFT_RECIPIENT',
  giftCode: 'GIFT_CODE',
  doctorVisit: 'DOCTOR_VISIT',
  step: 'ONBOARDING_STEP',
};
// Answers kept as JSON in the wide text_box_2 rather than text_box_1 (255 chars).
const JSON_KEYS = new Set(['group', 'giftRecipient']);

const q = (s) => String(s).replace(/'/g, "''");
const recordsUrl = (table, where) =>
  `${API_BASE}/rest/v2/tables/${table}/records${where ? `?q.where=${encodeURIComponent(where)}` : ''}`;

async function getRows(table, where) {
  const r = await fetch(recordsUrl(table, where));
  if (!r.ok) throw new Error(`load ${table} ${r.status}`);
  return (await r.json()).Result || [];
}

function parseJson(s, fallback) {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}

// Everything saved so far, plus the member's email and mobile from legal_entity.
export async function loadOnboarding(member) {
  const featureList = Object.values(FEATURES).map((f) => `'${f}'`).join(',');
  const [me, rows, note] = await Promise.all([
    getRows('legal_entity', `UserGUID='${q(member)}'`).then((r) => r[0] || {}),
    getRows('member_info', `member_id='${q(member)}' AND feature IN (${featureList})`),
    loadNote(member, EXPECTATIONS_KEY),
  ]);
  const byFeature = Object.fromEntries(rows.map((r) => [r.feature, r]));
  const read = (key) => {
    const row = byFeature[FEATURES[key]];
    if (!row) return undefined;
    return JSON_KEYS.has(key) ? parseJson(row.text_box_2, undefined) : (row.text_box_1 || undefined);
  };
  return {
    email: me.Email || '',
    mobile: me.PhoneNumber || '',
    expectations: note.text,
    expectationsId: note.id,
    type: read('type'),
    comms: read('comms'),
    dob: read('dob'),
    group: read('group'),
    giftRecipient: read('giftRecipient'),
    giftCode: read('giftCode'),
    doctorVisit: read('doctorVisit'),
    step: read('step'),
  };
}

// One member_info row per (member, feature): update it if it exists, else insert.
// `detail`, when given, goes to text_box_2 as JSON beside a text_box_1 value.
async function saveFeature(member, key, value, detail) {
  const feature = FEATURES[key];
  const body = JSON_KEYS.has(key) ? { text_box_2: JSON.stringify(value) } : { text_box_1: String(value ?? '') };
  if (detail !== undefined) body.text_box_2 = JSON.stringify(detail);
  const where = `member_id='${q(member)}' AND feature='${feature}'`;
  const existing = await getRows('member_info', where);
  const r = existing.length
    ? await fetch(recordsUrl('member_info', `member_info_id=${existing[0].member_info_id}`), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    : await fetch(recordsUrl('member_info'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member, feature, ...body }),
      });
  if (!r.ok) throw new Error(`save ${feature} ${r.status}`);
}

// member_info PAGE_NOTE row, text_box_2 (via lib/notes.js). Returns the row id.
export function saveExpectations(member, text, existingId) {
  return saveNote(member, EXPECTATIONS_KEY, text, existingId);
}

// member_info MEMBERSHIP_TYPE, text_box_1
export const saveMembershipType = (member, type) => saveFeature(member, 'type', type);

// Mobile -> legal_entity.PhoneNumber; comms -> member_info COMMS_PREFERENCE;
// date of birth -> member_info DATE_OF_BIRTH (all text_box_1).
export async function saveMemberDetails(member, { mobile, comms, dob }) {
  const r = await fetch(recordsUrl('legal_entity', `UserGUID='${q(member)}'`), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ PhoneNumber: mobile }),
  });
  if (!r.ok) throw new Error(`save legal_entity ${r.status}`);
  await Promise.all([saveFeature(member, 'comms', comms), saveFeature(member, 'dob', dob)]);
}

// member_info GROUP_MEMBERS, text_box_2 (JSON list)
export const saveGroupMembers = (member, list) => saveFeature(member, 'group', list);
// member_info GIFT_RECIPIENT, text_box_2 (JSON)
export const saveGiftRecipient = (member, recipient) => saveFeature(member, 'giftRecipient', recipient);
// member_info GIFT_CODE, text_box_1
export const saveGiftCode = (member, code) => saveFeature(member, 'giftCode', code);
// member_info DOCTOR_VISIT: text_box_1 = when, text_box_2 = JSON with the by-date.
export const saveDoctorVisit = (member, when, byDate) =>
  saveFeature(member, 'doctorVisit', when, { when, byDate, committedAt: new Date().toISOString() });
// member_info ONBOARDING_STEP, text_box_1 — where to resume after a refresh.
export const saveStep = (member, step) => saveFeature(member, 'step', step);
