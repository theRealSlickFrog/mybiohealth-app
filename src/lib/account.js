// Account data layer — the member's contact info, addresses, and linked doctor.
// Ported from the V1 Account.html, but through the proxy + JWT (no browser creds).
// Sources: legal_entity (by UserGUID), electronic_address + physical_address
// (by legal_entity_id), doctor_x_member (member_id -> doctor_id).
import { DEV_MEMBER } from './biomarkers.js';

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';
export { DEV_MEMBER };

async function get(path) {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`account ${r.status}`);
  return (await r.json()).Result || [];
}
const whereId = (field, v) => encodeURIComponent(`${field}='${String(v).replace(/'/g, "''")}'`);

// Caspio dropdown fields can be string or object — unwrap to a display string.
function fieldVal(f) {
  if (!f) return '';
  if (typeof f === 'string') return f;
  if (typeof f === 'object') { const v = Object.values(f); return v.length ? v.join(', ') : ''; }
  return String(f);
}

function shapeEntity(e, contacts) {
  const emails = contacts.filter((c) => (c.value || '').includes('@')).map((c) => c.value);
  const phones = contacts.filter((c) => c.value && !c.value.includes('@')).map((c) => c.value);
  return {
    name: `${e.First_Name || ''} ${e.Last_Name || ''}`.trim() || e.entity_name || '—',
    email: e.Email || '',
    phone: e.PhoneNumber || '',
    altEmail: emails[0] || '',
    altPhone: phones[0] || '',
  };
}

function shapeAddr(a) {
  return {
    type: fieldVal(a.address_type) || 'Address',
    mailing: !!a.mailing_address,
    line1: a.address_line1 || '',
    line2: a.address_line2 || '',
    city: a.city || '',
    state: a.state || '',
    postal: a.postal_code || '',
    country: a.country || '',
  };
}
// Mailing address first, then by type.
function sortAddrs(list) {
  return [...list].sort((a, b) => (b.mailing - a.mailing) || a.type.localeCompare(b.type));
}

export async function loadAccount(member) {
  const me = (await get(`/rest/v2/tables/legal_entity/records?q.where=${whereId('UserGUID', member)}&q.limit=1`))[0];
  if (!me) return null;

  const [myContacts, myAddrs, docLink] = await Promise.all([
    get(`/rest/v2/tables/electronic_address/records?q.where=${whereId('legal_entity_id', member)}`),
    get(`/rest/v2/tables/physical_address/records?q.where=${whereId('legal_entity_id', member)}`),
    get(`/rest/v2/tables/doctor_x_member/records?q.where=${whereId('member_id', member)}&q.limit=1`),
  ]);

  let doctor = null;
  let doctorAddresses = [];
  const docId = docLink[0] && docLink[0].doctor_id;
  if (docId) {
    const docEntity = (await get(`/rest/v2/tables/legal_entity/records?q.where=${whereId('UserGUID', docId)}&q.limit=1`))[0];
    if (docEntity) {
      const [docContacts, dAddrs] = await Promise.all([
        get(`/rest/v2/tables/electronic_address/records?q.where=${whereId('legal_entity_id', docId)}`),
        get(`/rest/v2/tables/physical_address/records?q.where=${whereId('legal_entity_id', docId)}`),
      ]);
      doctor = shapeEntity(docEntity, docContacts);
      doctorAddresses = sortAddrs(dAddrs.map(shapeAddr));
    }
  }

  return {
    me: shapeEntity(me, myContacts),
    addresses: sortAddrs(myAddrs.map(shapeAddr)),
    doctor,
    doctorAddresses,
  };
}
