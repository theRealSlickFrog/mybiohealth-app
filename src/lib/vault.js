// Vault data layer — the member's uploaded documents. Source: user_document
// (one row per file, keyed by legal_entity_id, soft-deleted via is_deleted).
// Categories come from reference_code_desc / DOC_CATEGORY (single source of
// truth, same list the V1 vault editor uses). Field mapping + the Caspio
// dropdown-unwrapping helper are ported from the V1 patient data vault.html so
// V1 and V2 stay consistent.
import { DEV_MEMBER } from './biomarkers.js';

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';

export { DEV_MEMBER };

// Caspio dropdown fields come back as a string OR an object
// ({ Value, DisplayValue } or a numeric-keyed { 5: "Lab Results" }). Unwrap to
// a plain string. Ported verbatim in spirit from V1 getFieldValue().
export function getFieldValue(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    if (field.DisplayValue) return field.DisplayValue;
    if (field.Value) return field.Value;
    if (field.value) return field.value;
    const keys = Object.keys(field);
    if (keys.length > 0) return field[keys[0]] || '';
  }
  return String(field);
}

export function getFileType(fileName) {
  if (!fileName || !fileName.includes('.')) return 'file';
  const ext = fileName.split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'xls';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'heic'].includes(ext)) return 'img';
  if (['txt', 'rtf', 'md'].includes(ext)) return 'txt';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'zip';
  if (['xml', 'json'].includes(ext)) return 'data';
  if (['html', 'htm'].includes(ext)) return 'html';
  return ext.length <= 5 ? ext : 'file';
}

const FILE_ICONS = {
  pdf: '📕', doc: '📘', xls: '📗', img: '🖼️', txt: '📝',
  zip: '📦', data: '📊', html: '🌐', file: '📄',
};
export function getFileIcon(fileType) {
  return FILE_ICONS[fileType] || '📄';
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// A URL we can open in a new tab for "View", or null if file_data is just a
// filename (Caspio attachment not exposed as a URL via REST).
export function fileUrlOf(fileData) {
  if (!fileData) return null;
  if (typeof fileData === 'string' && fileData.startsWith('http')) return fileData;
  if (typeof fileData === 'object' && fileData.Url) return fileData.Url;
  return null;
}

// Shape one raw user_document row into what the page renders.
function shapeDoc(d) {
  const fileName = (typeof d.file_data === 'string' && d.file_data) ? d.file_data : (d.file_name || 'Untitled');
  const fileType = getFileType(fileName);
  return {
    id: d.document_id,
    fileName,
    fileType,
    icon: getFileIcon(fileType),
    category: getFieldValue(d.category),
    description: getFieldValue(d.description),
    uploadDate: d.upload_date || null,
    uploadDateLabel: formatDate(d.upload_date),
    fileUrl: fileUrlOf(d.file_data),
  };
}

// Live documents for a member — excludes soft-deleted, newest first.
export async function loadDocuments(member) {
  const where = encodeURIComponent(`legal_entity_id='${member}' AND (is_deleted IS NULL OR is_deleted=0)`);
  const r = await fetch(`${API_BASE}/rest/v2/tables/user_document/records?q.where=${where}&q.sort=upload_date DESC&q.limit=500`);
  if (!r.ok) throw new Error(`vault documents ${r.status}`);
  const rows = (await r.json()).Result || [];
  return rows.map(shapeDoc);
}

// Document categories from DOC_CATEGORY (display order by display_name, same as V1).
export async function loadDocCategories() {
  const where = encodeURIComponent(`domain='DOC_CATEGORY' AND language='EN'`);
  const r = await fetch(`${API_BASE}/rest/v2/tables/reference_code_desc/records?q.where=${where}&q.sort=display_name`);
  if (!r.ok) throw new Error(`vault categories ${r.status}`);
  const recs = (await r.json()).Result || [];
  return recs.map((x) => ({ code: x.code, display: x.display_name, description: x.description || '' }));
}

// Soft delete — mark is_deleted=1 rather than physically removing (matches V1).
export async function softDeleteDocument(documentId) {
  const where = encodeURIComponent(`document_id=${documentId}`);
  const r = await fetch(`${API_BASE}/rest/v2/tables/user_document/records?q.where=${where}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_deleted: 1 }),
  });
  if (!r.ok) throw new Error(`vault delete ${r.status}`);
}
