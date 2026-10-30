// Gifts made by a signed-in member. Each is one member_info row, feature='GIFT',
// text_box_1=giftRef, text_box_2=JSON. The ref goes to Stripe as client_reference_id
// so a payment can be matched to its gift once Stripe's confirmation is handled.
const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';

export async function saveGift(member, gift) {
  const giftRef = `gift-${crypto.randomUUID()}`;
  const r = await fetch(`${API_BASE}/rest/v2/tables/member_info/records`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      member_id: member, feature: 'GIFT', text_box_1: giftRef,
      text_box_2: JSON.stringify({ ...gift, at: new Date().toISOString() }),
    }),
  });
  if (!r.ok) throw new Error(`save gift ${r.status}`);
  return giftRef;
}
