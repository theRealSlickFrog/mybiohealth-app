import { SLATE, OFFWHITE } from '../lib/constants.js';
export default function ContextSignalsPage() {
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: OFFWHITE, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: SLATE }}>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, marginBottom: 10 }}>Context Signals</div>
        <div style={{ fontSize: 14, color: '#9ca3af' }}>Pending</div>
      </div>
    </div>
  );
}
