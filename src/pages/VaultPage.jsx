// MyVault — the member's uploaded documents, live from user_document via
// lib/vault.js. Categories come from DOC_CATEGORY (single source of truth).
// Upload uses the Caspio DataPage in an iframe: Caspio attachment fields are
// read-only over REST, so the actual file write has to go through Caspio. The
// hardcoded files + message log from the v1 prototype are gone.
import { useEffect, useState, useCallback } from 'react';
import { MBH_SAGE, SAGE_BG, AMBER_BG, SLATE, CARD, BORDER, SOFT_RED } from '../lib/constants.js';
import { getStoredGuid } from '../lib/auth.js';
import { loadDocuments, loadDocCategories, softDeleteDocument, DEV_MEMBER } from '../lib/vault.js';

// Caspio submission DataPage for user_document (file upload). Passed the member
// GUID as legal_entity_id. Update if the deployed DataPage URL changes.
const UPLOAD_DATAPAGE_URL = 'https://mybiohealth.caspio.app/mybiohealth/data-vault-pop-up';
// Caspio Details DataPage that displays/serves a document's file attachment.
// Receives the row via ?document_id=<id> (query-string param filter on the page).
const VIEW_DATAPAGE_URL = 'https://mybiohealth.caspio.app/mybiohealth/data-vault-pop-up-for-view-for-react';

const ALL = '__all__';

export default function VaultPage() {
  const [member] = useState(() => getStoredGuid() || DEV_MEMBER);
  const [docs, setDocs] = useState(undefined);   // undefined=loading, null=error, []=empty, [..]=data
  const [cats, setCats] = useState([]);          // [{ code, display }]
  const [filter, setFilter] = useState(ALL);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState(null);  // doc being viewed (iframe modal)
  const [busyId, setBusyId] = useState(null);    // doc id mid-delete

  const refresh = useCallback(() => {
    setDocs(undefined);
    loadDocuments(member)
      .then(setDocs)
      .catch((e) => { console.warn('Vault load failed:', e); setDocs(null); });
  }, [member]);

  useEffect(() => {
    refresh();
    loadDocCategories()
      .then(setCats)
      .catch((e) => { console.warn('Vault categories failed:', e); setCats([]); });
  }, [refresh]);

  // Categories that actually have documents, ordered by the DOC_CATEGORY list.
  const present = new Set((docs || []).map((d) => d.category).filter(Boolean));
  const orderedCats = [
    ...cats.filter((c) => present.has(c.display)),
    ...[...present].filter((p) => !cats.some((c) => c.display === p)).map((p) => ({ code: p, display: p })),
  ];
  const visible = (docs || []).filter((d) => filter === ALL || d.category === filter);

  async function handleDelete(doc) {
    if (!window.confirm(`Remove "${doc.fileName}" from your vault?`)) return;
    setBusyId(doc.id);
    try {
      await softDeleteDocument(doc.id);
      setDocs((cur) => (cur || []).filter((d) => d.id !== doc.id));
    } catch (e) {
      console.error('Delete failed:', e);
      window.alert('Could not delete that document. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  function handleView(doc) {
    if (VIEW_DATAPAGE_URL) { setViewDoc(doc); return; }        // Caspio viewer DataPage
    if (doc.fileUrl) { window.open(doc.fileUrl, '_blank', 'noopener'); return; }
    window.alert(`"${doc.fileName}" can't be opened directly from here yet — the document viewer isn't wired up.`);
  }

  function closeUpload() {
    setUploadOpen(false);
    refresh(); // they may have just uploaded something
  }

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, marginBottom: 4, fontWeight: 'normal' }}>MyVault</h1>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 20 }}>Your documents — private and secure</div>

      {/* Category filter chips */}
      {docs && docs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <Chip label={`All (${docs.length})`} active={filter === ALL} onClick={() => setFilter(ALL)} />
          {orderedCats.map((c) => {
            const n = docs.filter((d) => d.category === c.display).length;
            return <Chip key={c.code} label={`${c.display} (${n})`} active={filter === c.display} onClick={() => setFilter(c.display)} />;
          })}
        </div>
      )}

      {/* States */}
      {docs === undefined && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading your documents…</div>}
      {docs === null && <div style={{ padding: 40, textAlign: 'center', color: SOFT_RED }}>Couldn't load your documents. Please try again.</div>}
      {docs && docs.length === 0 && (
        <div style={{ background: CARD, borderRadius: 14, padding: '48px 20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: SLATE, marginBottom: 4 }}>No documents yet</div>
          <div style={{ fontSize: 12.5, color: '#6b7280' }}>Upload your first document to get started.</div>
        </div>
      )}

      {/* Document list */}
      {docs && docs.length > 0 && (
        <div style={{ background: CARD, borderRadius: 14, padding: '6px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 14 }}>
          {visible.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12.5, color: '#6b7280' }}>No documents in this category.</div>
          )}
          {visible.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < visible.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: d.fileType === 'pdf' ? AMBER_BG : SAGE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 18 }}>{d.icon}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: SLATE, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.fileName}</div>
                <div style={{ fontSize: 11, color: '#374151' }}>
                  {d.uploadDateLabel}{d.category ? ` · ${d.category}` : ''}{d.description ? ` · ${d.description}` : ''}
                </div>
              </div>
              <button onClick={() => handleView(d)} style={btnStyle(false)}>View</button>
              <button onClick={() => handleDelete(d)} disabled={busyId === d.id} style={btnStyle(true, busyId === d.id)}>
                {busyId === d.id ? '…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload */}
      <button onClick={() => setUploadOpen(true)} style={{ width: '100%', background: SAGE_BG, border: `1.5px dashed ${MBH_SAGE}40`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <span style={{ fontSize: 24 }}>⬆️</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: MBH_SAGE }}>Upload a document</span>
        <span style={{ fontSize: 11, color: '#374151' }}>PDF, CSV, images — any format</span>
      </button>

      {uploadOpen && (
        <div onClick={closeUpload} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: CARD, borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: MBH_SAGE, color: 'white' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Upload Document</span>
              <button onClick={closeUpload} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
            <iframe
              title="Upload document"
              src={`${UPLOAD_DATAPAGE_URL}?legal_entity_id=${encodeURIComponent(member)}`}
              style={{ width: '100%', height: 460, border: 'none' }}
            />
          </div>
        </div>
      )}

      {viewDoc && (
        <div onClick={() => setViewDoc(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: CARD, borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: SLATE, color: 'white' }}>
              <span style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewDoc.fileName}</span>
              <button onClick={() => setViewDoc(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
            </div>
            <iframe
              title="View document"
              src={`${VIEW_DATAPAGE_URL}?document_id=${encodeURIComponent(viewDoc.id)}`}
              style={{ width: '100%', height: 540, border: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
      background: active ? SLATE : 'transparent', color: active ? 'white' : '#374151',
    }}>{label}</button>
  );
}

function btnStyle(danger, busy = false) {
  return {
    background: 'none',
    border: `1px solid ${danger ? '#f0c8c2' : BORDER}`,
    color: danger ? SOFT_RED : '#6b7280',
    borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 600,
    cursor: busy ? 'default' : 'pointer', flexShrink: 0, opacity: busy ? 0.6 : 1,
  };
}
