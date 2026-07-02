// MyVault — two tabs:
//   • Upload   — the member's own uploaded documents (upload + view + delete).
//   • Download — documents WE shared for them to download (view-only). Each row
//     shows whether they've opened it yet; opening stamps viewed_dt, but only
//     for a genuine member session (never admin/impersonation QA loads).
// Both lists come from user_document via lib/vault.js, split by doc_direction.
// Upload posts to the proxy's /upload route (proxy stamps legal_entity_id from
// the session JWT, server-side/unspoofable). View opens the file in a new tab.
import { useEffect, useState, useCallback } from 'react';
import { MBH_SAGE, SAGE_BG, AMBER_BG, SLATE, CARD, BORDER, SOFT_RED } from '../lib/constants.js';
import { getStoredGuid, isAdminSession } from '../lib/auth.js';
import {
  loadDocuments, loadDocCategories, loadUploadCategories, loadDownloadCategories,
  softDeleteDocument, uploadDocument, getDownloadUrl, markViewed, formatDate, DEV_MEMBER,
} from '../lib/vault.js';

const ALL = '__all__';

export default function VaultPage() {
  const [member] = useState(() => getStoredGuid() || DEV_MEMBER);
  const [tab, setTab] = useState('up');          // 'up' = My uploads, 'down' = Shared with me
  const [docs, setDocs] = useState(undefined);   // undefined=loading, null=error, []=empty, [..]=data (upload)
  const [dlDocs, setDlDocs] = useState(undefined); // download docs
  const [cats, setCats] = useState([]);          // [{ code, display }] — DOC_CATEGORY, upload filter chips
  const [dlCats, setDlCats] = useState([]);      // DOWNLOAD_DOC_CATEGORY, download filter chips
  const [uploadCats, setUploadCats] = useState([]); // active DOC_CATEGORY for the upload dropdown
  const [filter, setFilter] = useState(ALL);     // upload tab category filter
  const [dlFilter, setDlFilter] = useState(ALL); // download tab category filter
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upFile, setUpFile] = useState(null);
  const [upCategory, setUpCategory] = useState('');
  const [upDesc, setUpDesc] = useState('');
  const [upBusy, setUpBusy] = useState(false);
  const [upError, setUpError] = useState('');
  const [busyId, setBusyId] = useState(null);    // doc id mid-delete

  const refresh = useCallback(() => {
    setDocs(undefined);
    loadDocuments(member, 'up')
      .then(setDocs)
      .catch((e) => { console.warn('Vault load failed:', e); setDocs(null); });
  }, [member]);

  const refreshDownloads = useCallback(() => {
    setDlDocs(undefined);
    loadDocuments(member, 'down')
      .then(setDlDocs)
      .catch((e) => { console.warn('Vault download load failed:', e); setDlDocs(null); });
  }, [member]);

  useEffect(() => {
    refresh();
    refreshDownloads();
    loadDocCategories()
      .then(setCats)
      .catch((e) => { console.warn('Vault categories failed:', e); setCats([]); });
    loadUploadCategories()
      .then(setUploadCats)
      .catch((e) => { console.warn('Vault upload categories failed:', e); setUploadCats([]); });
    loadDownloadCategories()
      .then(setDlCats)
      .catch((e) => { console.warn('Vault download categories failed:', e); setDlCats([]); });
  }, [refresh, refreshDownloads]);

  // Category chips that actually have documents, ordered by the reference list.
  const orderCats = (list, catList) => {
    const present = new Set((list || []).map((d) => d.category).filter(Boolean));
    return [
      ...catList.filter((c) => present.has(c.display)),
      ...[...present].filter((p) => !catList.some((c) => c.display === p)).map((p) => ({ code: p, display: p })),
    ];
  };

  const activeDocs = tab === 'up' ? docs : dlDocs;
  const activeFilter = tab === 'up' ? filter : dlFilter;
  const setActiveFilter = tab === 'up' ? setFilter : setDlFilter;
  const orderedCats = orderCats(activeDocs, tab === 'up' ? cats : dlCats);
  const visible = (activeDocs || []).filter((d) => activeFilter === ALL || d.category === activeFilter);

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

  // View = open the document in a floating popup WINDOW over the app (not a sibling
  // tab) via a short-lived signed URL from the proxy (see getDownloadUrl). The proxy
  // streams it with a real Content-Type + filename, so the browser/iOS renders or
  // saves it natively — no blobs, no download-attribute quirks (the iPad-friendly
  // path). We open the window synchronously inside the click (so popup blockers
  // allow it) — passing size/position features makes browsers spawn a standalone
  // floating window, centered over the current one — then point it at the signed URL
  // once minted. (Mobile Safari ignores the features and just uses a tab — fine.)
  // For a download doc, also stamp viewed_dt — but only on a genuine member session
  // (never admin/impersonation, which would falsely mark it "viewed" when we load it
  // ourselves to confirm it opened), and only once.
  function handleView(doc) {
    const w = Math.min(1000, window.screen.availWidth - 80);
    const h = Math.min(1200, window.screen.availHeight - 80);
    const left = Math.round(window.screenX + Math.max(0, (window.outerWidth - w) / 2));
    const top = Math.round(window.screenY + Math.max(0, (window.outerHeight - h) / 2));
    const features = `popup,width=${w},height=${h},left=${left},top=${top}`;
    const win = window.open('', '_blank', features);
    getDownloadUrl(doc.id)
      .then((url) => { if (win) win.location = url; else window.open(url, '_blank', features); })
      .catch((e) => {
        console.warn('View failed:', e);
        if (win) win.close();
        window.alert('Could not open this document.');
      });

    if (doc.docDirection === 'down' && !doc.viewedDate && !isAdminSession()) {
      markViewed(doc.id)
        .then((when) => setDlDocs((cur) => (cur || []).map((d) => (d.id === doc.id ? { ...d, viewedDate: when, viewedLabel: formatDate(when) } : d))))
        .catch((e) => console.warn('markViewed failed:', e));
    }
  }

  function resetUpload() {
    setUpFile(null); setUpCategory(''); setUpDesc(''); setUpError(''); setUpBusy(false);
  }

  function closeUpload() {
    if (upBusy) return;
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
      refresh();
    } catch (err) {
      console.error('Upload failed:', err);
      setUpError('Upload failed. Please try again.');
      setUpBusy(false);
    }
  }

  const emptyCopy = tab === 'up'
    ? { title: 'No documents yet', sub: 'Upload your first document to get started.' }
    : { title: 'Nothing shared yet', sub: 'Documents we share with you will appear here.' };

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, marginBottom: 4, fontWeight: 'normal' }}>MyVault</h1>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 16 }}>Your documents — private and secure</div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: `1px solid ${BORDER}` }}>
        {[{ key: 'up', label: 'Upload' }, { key: 'down', label: 'Download' }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none', marginBottom: -1, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${MBH_SAGE}` : '2px solid transparent',
            color: tab === t.key ? SLATE : '#9ca3af', fontSize: 14, fontWeight: 600, padding: '8px 14px',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Category filter chips */}
      {activeDocs && activeDocs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <Chip label={`All (${activeDocs.length})`} active={activeFilter === ALL} onClick={() => setActiveFilter(ALL)} />
          {orderedCats.map((c) => {
            const n = activeDocs.filter((d) => d.category === c.display).length;
            return <Chip key={c.code} label={`${c.display} (${n})`} active={activeFilter === c.display} onClick={() => setActiveFilter(c.display)} />;
          })}
        </div>
      )}

      {/* States */}
      {activeDocs === undefined && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading your documents…</div>}
      {activeDocs === null && <div style={{ padding: 40, textAlign: 'center', color: SOFT_RED }}>Couldn't load your documents. Please try again.</div>}
      {activeDocs && activeDocs.length === 0 && (
        <div style={{ background: CARD, borderRadius: 14, padding: '48px 20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: SLATE, marginBottom: 4 }}>{emptyCopy.title}</div>
          <div style={{ fontSize: 12.5, color: '#6b7280' }}>{emptyCopy.sub}</div>
        </div>
      )}

      {/* Document list */}
      {activeDocs && activeDocs.length > 0 && (
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
              {tab === 'down' && <ViewedBadge doc={d} />}
              <button onClick={() => handleView(d)} style={btnStyle(false)}>View</button>
              {tab === 'up' && (
                <button onClick={() => handleDelete(d)} disabled={busyId === d.id} style={btnStyle(true, busyId === d.id)}>
                  {busyId === d.id ? '…' : 'Delete'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload (Upload tab only) */}
      {tab === 'up' && (
        <button onClick={() => setUploadOpen(true)} style={{ width: '100%', background: SAGE_BG, border: `1.5px dashed ${MBH_SAGE}40`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <span style={{ fontSize: 24 }}>⬆️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: MBH_SAGE }}>Upload a document</span>
          <span style={{ fontSize: 11, color: '#374151' }}>PDF, CSV, images — any format</span>
        </button>
      )}

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
                  {uploadCats.map((u) => <option key={u.code} value={u.code}>{u.display}</option>)}
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
    </div>
  );
}

// Download-tab per-row indicator: "New" until the member opens it, then the date.
function ViewedBadge({ doc }) {
  if (doc.viewedDate) {
    return <span style={{ fontSize: 10.5, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>Viewed · {doc.viewedLabel}</span>;
  }
  return <span style={{ fontSize: 10, fontWeight: 700, color: MBH_SAGE, background: SAGE_BG, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}>● New</span>;
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
