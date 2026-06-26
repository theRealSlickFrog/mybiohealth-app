// MyVault — the member's uploaded documents, live from user_document via
// lib/vault.js. Categories come from DOC_CATEGORY (single source of truth).
// Upload is a native form posting to the proxy's /upload route: the proxy stamps
// legal_entity_id from the session JWT (server-side, unspoofable) and writes the
// file to user_document's ATTACHMENT field. View is also native: it fetches the
// file Blob through the proxy and renders it in-app (image/PDF inline, else a
// download) — both replace the old Caspio DataPage iframes (which dropped
// legal_entity_id, put the raw GUID in a URL, and broke in Firefox/Safari).
import { useEffect, useState, useCallback } from 'react';
import { MBH_SAGE, SAGE_BG, AMBER_BG, SLATE, CARD, BORDER, SOFT_RED } from '../lib/constants.js';
import { getStoredGuid } from '../lib/auth.js';
import { loadDocuments, loadDocCategories, softDeleteDocument, uploadDocument, fetchDocumentBlob, DEV_MEMBER } from '../lib/vault.js';

const ALL = '__all__';

// Categories offered in the UPLOADER from now on — Ken's decision (Meeting Notes
// & To-Dos, action #3: "Restrict Vault categories to Lab Results, Medical Reports,
// Other"). This only limits NEW uploads; existing documents in other categories
// (Imaging, Prescriptions, etc.) stay in the DB and still display + filter.
// Display labels come from the DOC_CATEGORY reference when present (fallback here).
const UPLOAD_CATEGORIES = [
  { code: 'LAB_RESULTS', display: 'Lab Results' },
  { code: 'MEDICAL_REPORTS', display: 'Medical Reports' },
  { code: 'OTHER', display: 'Other' },
];

export default function VaultPage() {
  const [member] = useState(() => getStoredGuid() || DEV_MEMBER);
  const [docs, setDocs] = useState(undefined);   // undefined=loading, null=error, []=empty, [..]=data
  const [cats, setCats] = useState([]);          // [{ code, display }]
  const [filter, setFilter] = useState(ALL);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upFile, setUpFile] = useState(null);    // selected File for upload
  const [upCategory, setUpCategory] = useState('');
  const [upDesc, setUpDesc] = useState('');
  const [upBusy, setUpBusy] = useState(false);
  const [upError, setUpError] = useState('');
  const [viewDoc, setViewDoc] = useState(null);  // doc being viewed
  const [viewUrl, setViewUrl] = useState(null);  // object URL for the fetched file blob
  const [viewError, setViewError] = useState('');
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

  // Fetch the selected document's file (Blob → object URL) for the in-app viewer.
  // Revoke the URL on close/change so blobs don't leak.
  useEffect(() => {
    if (!viewDoc) { setViewUrl(null); setViewError(''); return; }
    let objUrl = null, cancelled = false;
    setViewUrl(null); setViewError('');
    fetchDocumentBlob(viewDoc.id)
      .then((blob) => { if (cancelled) return; objUrl = URL.createObjectURL(blob); setViewUrl(objUrl); })
      .catch((e) => { if (!cancelled) { console.warn('View failed:', e); setViewError('Could not load this document.'); } });
    return () => { cancelled = true; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [viewDoc]);

  // Categories that actually have documents, ordered by the DOC_CATEGORY list.
  const present = new Set((docs || []).map((d) => d.category).filter(Boolean));
  const orderedCats = [
    ...cats.filter((c) => present.has(c.display)),
    ...[...present].filter((p) => !cats.some((c) => c.display === p)).map((p) => ({ code: p, display: p })),
  ];
  const visible = (docs || []).filter((d) => filter === ALL || d.category === filter);

  // Viewer-derived: friendly category label (map code→display when possible) and
  // whether the file type can render inline.
  const viewCatLabel = viewDoc ? (cats.find((c) => c.code === viewDoc.category)?.display || viewDoc.category) : '';
  const viewPreviewable = !!viewDoc && (viewDoc.fileType === 'img' || viewDoc.fileType === 'pdf');

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
    setViewDoc(doc);   // the view effect fetches the file blob
  }

  function resetUpload() {
    setUpFile(null); setUpCategory(''); setUpDesc(''); setUpError(''); setUpBusy(false);
  }

  function closeUpload() {
    if (upBusy) return;            // don't bail out mid-upload
    setUploadOpen(false);
    resetUpload();
  }

  // ~4.5MB to match the proxy's cap (Netlify function body limit).
  const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

  async function doUpload(e) {
    e.preventDefault();
    if (!upFile) { setUpError('Please choose a file.'); return; }
    if (upFile.size > MAX_UPLOAD_BYTES) { setUpError('That file is too large (max 4.5 MB).'); return; }
    setUpBusy(true); setUpError('');
    try {
      await uploadDocument({ file: upFile, category: upCategory, description: upDesc });
      setUploadOpen(false);
      resetUpload();
      refresh();                   // show the newly uploaded document
    } catch (err) {
      console.error('Upload failed:', err);
      setUpError('Upload failed. Please try again.');
      setUpBusy(false);
    }
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
          <div onClick={(e) => e.stopPropagation()} style={{ background: CARD, borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: MBH_SAGE, color: 'white' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Upload Document</span>
              <button onClick={closeUpload} disabled={upBusy} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 30, height: 30, borderRadius: '50%', cursor: upBusy ? 'default' : 'pointer', fontSize: 16, opacity: upBusy ? 0.5 : 1 }}>×</button>
            </div>
            <form onSubmit={doUpload} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              <label style={fieldLabel}>
                File
                <input
                  type="file"
                  onChange={(e) => { setUpFile(e.target.files?.[0] || null); setUpError(''); }}
                  style={{ display: 'block', marginTop: 6, fontSize: 13, width: '100%' }}
                />
                <span style={{ fontSize: 11, color: '#6b7280' }}>PDF, CSV, images — any format, up to 4.5 MB</span>
              </label>

              <label style={fieldLabel}>
                Category
                <select value={upCategory} onChange={(e) => setUpCategory(e.target.value)} style={inputStyle}>
                  <option value="">— Select a category —</option>
                  {UPLOAD_CATEGORIES.map((u) => {
                    const ref = cats.find((c) => c.code === u.code);
                    return <option key={u.code} value={u.code}>{ref?.display || u.display}</option>;
                  })}
                </select>
              </label>

              <label style={fieldLabel}>
                Description <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>
                <input
                  type="text"
                  value={upDesc}
                  maxLength={255}
                  onChange={(e) => setUpDesc(e.target.value)}
                  placeholder="e.g. June bloodwork"
                  style={inputStyle}
                />
              </label>

              {upError && <div style={{ fontSize: 12.5, color: SOFT_RED }}>{upError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={closeUpload} disabled={upBusy} style={btnStyle(false, upBusy)}>Cancel</button>
                <button type="submit" disabled={upBusy || !upFile} style={{
                  background: MBH_SAGE, color: 'white', border: 'none', borderRadius: 20, padding: '8px 20px',
                  fontSize: 13, fontWeight: 600, cursor: (upBusy || !upFile) ? 'default' : 'pointer', opacity: (upBusy || !upFile) ? 0.6 : 1,
                }}>{upBusy ? 'Uploading…' : 'Upload'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewDoc && (
        <div onClick={() => setViewDoc(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: CARD, borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: MBH_SAGE, color: 'white' }}>
              <span style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewDoc.fileName}</span>
              <button onClick={() => setViewDoc(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
            </div>
            {/* Name · date · category (+ description) */}
            <div style={{ padding: '10px 20px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {viewCatLabel && <span style={{ fontWeight: 600 }}>{viewCatLabel}</span>}
              {viewCatLabel && <span style={{ color: '#cbd5e1' }}>·</span>}
              <span>{viewDoc.uploadDateLabel}</span>
              {viewDoc.description && <><span style={{ color: '#cbd5e1' }}>·</span><span>{viewDoc.description}</span></>}
            </div>
            {/* Preview area — only for types we can render inline (or while loading them / on error) */}
            {(viewPreviewable || viewError) && (
              <div style={{ flex: 1, minHeight: 320, maxHeight: '74vh', overflow: 'auto', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                {viewError && <div style={{ fontSize: 13, color: SOFT_RED, padding: 40, textAlign: 'center' }}>{viewError}</div>}
                {!viewError && !viewUrl && <div style={{ fontSize: 13, color: '#6b7280', padding: 40 }}>Loading…</div>}
                {!viewError && viewUrl && viewDoc.fileType === 'img' && (
                  <img src={viewUrl} alt={viewDoc.fileName} style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', display: 'block' }} />
                )}
                {!viewError && viewUrl && viewDoc.fileType === 'pdf' && (
                  <iframe title="View document" src={viewUrl} style={{ width: '100%', height: '72vh', border: 'none' }} />
                )}
              </div>
            )}
            {/* Download — available for every file type once the blob is ready */}
            {!viewError && viewUrl && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: viewPreviewable ? `1px solid ${BORDER}` : 'none' }}>
                <a href={viewUrl} download={viewDoc.fileName} style={{ color: MBH_SAGE, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>⤓ Download</a>
              </div>
            )}
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

const fieldLabel = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: SLATE };
const inputStyle = {
  marginTop: 4, width: '100%', boxSizing: 'border-box', padding: '8px 10px',
  fontSize: 13, fontWeight: 400, color: SLATE, border: `1px solid ${BORDER}`, borderRadius: 8, background: 'white',
};

function btnStyle(danger, busy = false) {
  return {
    background: 'none',
    border: `1px solid ${danger ? '#f0c8c2' : BORDER}`,
    color: danger ? SOFT_RED : '#6b7280',
    borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 600,
    cursor: busy ? 'default' : 'pointer', flexShrink: 0, opacity: busy ? 0.6 : 1,
  };
}
