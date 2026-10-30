// Up Next: the member's checklist, as designed in Ken's container prototype.
//
// The task list is fixed here for now (the prototype calls it server data; move
// it when a server decides per member). What the member has done is saved to
// Caspio as one member_info row, feature='UP_NEXT', text_box_2=JSON:
//   { tasks: {doctor: true}, subs: {'doctor.visit': true},
//     plans: {'doctor.labwork': {mode, date}}, address: {home, shipTo} }
// The address stays here too until physical_address writes are worked out.

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';
const FEATURE = 'UP_NEXT';

export const LINKS = {
  explainer: '/docs/physician-explainer.pdf',
  // TODO: orientation booking link from the client.
  orientation: '',
  cgmOrder: 'https://buy.stripe.com/8x2bJ14J81g6gAb80YbbG09',
  dexaBook: 'https://mybenchmarkhealth.janeapp.com/#/discipline/5/treatment/1',
};

export const UP_NEXT = [
  { id: 'start', type: 'group', title: 'Starting Point', desc: 'Doctor visit, CGM and DEXA scan.', items: [
    { id: 'doctor', title: 'Doctor visit and lab visit', desc: '', repeat: '3 months', subs: [
      { id: 'explainer', title: 'An explainer for your physician that includes a lab requisition.', link: { label: 'Download', url: LINKS.explainer } },
      { id: 'visit', title: 'Visit with your physician' },
      { id: 'labwork', type: 'plan', title: 'Lab visit', checkable: true },
    ] },
    { id: 'cgm', title: 'CGM - Continuous Glucose Monitor',
      info: 'A continuous glucose monitor is a small sensor worn on the skin, usually on the back of the upper arm. It measures glucose in the fluid beneath the skin every few minutes, day and night, for up to two weeks. The readings show how glucose moves through the day, which a single blood test cannot.',
      desc: 'Start your CGM when you are comfortable, or start it during an orientation meeting.',
      links: [{ label: 'Book an orientation', url: LINKS.orientation }, { label: 'Order a CGM', url: LINKS.cgmOrder }],
      subs: [{ id: 'cgmstatus', type: 'plan', title: 'CGM', opts: [['ordered', 'Ordered'], ['started', 'Started']], dateMode: 'started' }] },
    { id: 'dexa', title: 'DEXA scan', desc: 'Lean mass and visceral fat.', link: { label: 'Book a DEXA', url: LINKS.dexaBook } },
  ] },
  { id: 'address', type: 'task', title: 'Address', desc: 'Home address, and a Ship to address if different.', form: 'address' },
];

export const emptyState = () => ({ tasks: {}, subs: {}, plans: {}, address: null });

const recordsUrl = (where) =>
  `${API_BASE}/rest/v2/tables/member_info/records${where ? `?q.where=${encodeURIComponent(where)}` : ''}`;
const whereRow = (member) => `member_id='${String(member).replace(/'/g, "''")}' AND feature='${FEATURE}'`;

export async function loadUpNext(member) {
  const r = await fetch(recordsUrl(whereRow(member)));
  if (!r.ok) throw new Error(`load up next ${r.status}`);
  const row = ((await r.json()).Result || [])[0];
  if (!row) return emptyState();
  try { return { ...emptyState(), ...JSON.parse(row.text_box_2 || '{}') }; } catch { return emptyState(); }
}

// Saves run one at a time, so two quick ticks can't each insert a row.
let queue = Promise.resolve();
export function saveUpNext(member, state) {
  const run = async () => {
    const body = { text_box_2: JSON.stringify(state) };
    const check = await fetch(recordsUrl(whereRow(member)));
    if (!check.ok) throw new Error(`save up next ${check.status}`);
    const row = ((await check.json()).Result || [])[0];
    const r = row
      ? await fetch(recordsUrl(`member_info_id=${row.member_info_id}`), {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      : await fetch(recordsUrl(), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: member, feature: FEATURE, ...body }),
        });
    if (!r.ok) throw new Error(`save up next ${r.status}`);
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}
