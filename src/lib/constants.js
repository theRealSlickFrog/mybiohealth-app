// Color palette & app constants — ported from remixed-edc07ba6.html

export const MBH_SAGE   = '#4a7c6f';
export const SAGE_BG    = '#e8f2ef';
export const SAGE_TEXT  = '#1f4d42';
export const AMBER      = '#d97706';
export const AMBER_BG   = '#fef3e2';
export const AMBER_TEXT = '#7a4a10';
export const GAP_BG     = '#f5f0e8';
export const GAP_TEXT   = '#6b5a3e';
export const GAP_BORDER = '#c4a96e';
export const SLATE      = '#1e2d3d';
export const OFFWHITE   = '#f7f5f0';
export const CARD       = '#ffffff';
export const BORDER     = '#ede9e3';
export const SOFT_RED   = '#c0483a';
export const TEAL       = '#0f7d8c';

export const VERSION = '26.04.24.a';
export const RENEWAL = '26.07.23';

// ── Session inactivity ────────────────────────────────────────────────────────
// 25 minutes with no interaction opens a warning; ignoring that warning for a
// further 5 minutes ends the session, so the hard ceiling is 30 minutes idle.
export const IDLE_WARNING_MS = 25 * 60 * 1000;
export const IDLE_GRACE_MS   =  5 * 60 * 1000;
export const IDLE_TIMEOUT_MS = IDLE_WARNING_MS + IDLE_GRACE_MS;

export const MBH_DROP_IMG = 'https://res.cloudinary.com/dai0low65/image/upload/v1763491944/logo_pp70kv.png';

export const NAV_ITEMS = [
  // Top-level
  { key: 'strategy',            label: 'MyStrategy',             icon: '🎯' },
  // CHECK-IN section
  { key: 'checkin_priorities',  label: 'Priorities & MHx',       icon: '📋' },
  { key: 'jots',                label: 'Jots',                   icon: '✏️' },
  { key: 'upnext',              label: 'Up Next',                icon: '⏭️' },
  // SIGNALS section
  { key: 'biosignals',          label: 'BioSignals (Primary Six)', icon: '📊' },
  { key: 'glucose_v2',          label: 'Glucose Summary (CGM)',  icon: '🩸' },
  { key: 'context_signals',     label: 'Context Signals',        icon: '🫀' },
  { key: 'dexa',                label: 'Structural (DEXA)',      icon: '🦴' },
  { key: 'risk_measures',       label: 'Risk Measures',          icon: '📐' },
  // Member section
  { key: 'account',             label: 'Account',                icon: '💳' },
  { key: 'calendar',            label: 'Calendar',               icon: '📅' },
  { key: 'vault',               label: 'MyVault',                icon: '📁' },
  { key: 'library',             label: 'MBH Library',            icon: '📚' },
  { key: 'questions',           label: 'Questions',              icon: '✉️' },
];

// Pages that exist and are routable but are deliberately kept out of the
// drawer. The drawer is a member-facing surface, and a test screen has no
// business on it — these are reached by direct URL or an admin-only shortcut.
export const UNLISTED_PAGES = [
  { key: 'voice_test',          label: 'Voice Input Test',       icon: '🎤' },
];

// Every page the portal can show. NAV_ITEMS drives the drawer; this drives the
// route table and the top-bar title, so an unlisted page still resolves from
// its URL and still names itself once you are on it.
export const ALL_PAGES = [...NAV_ITEMS, ...UNLISTED_PAGES];
