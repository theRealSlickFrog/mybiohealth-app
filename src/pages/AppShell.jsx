// App shell — sticky top bar, hamburger drawer, page routing.
import { useState } from 'react';
import { SLATE, OFFWHITE, MBH_DROP_IMG, NAV_ITEMS } from '../lib/constants.js';
import { captureGuidFromUrl } from '../lib/auth.js';
import Drawer from '../components/Drawer.jsx';
import MyStrategyPage from './MyStrategyPage.jsx';
import BioSignalsPage from './BioSignalsPage.jsx';
import GlucoseSummaryPage from './GlucoseSummaryPage.jsx';
import DEXAPage from './DEXAPage.jsx';
import VaultPage from './VaultPage.jsx';
import CalendarPage from './CalendarPage.jsx';
import LibraryPage from './LibraryPage.jsx';
import QuestionsPage from './QuestionsPage.jsx';

// Capture the GUID at module-load time, before any component renders. Doing
// it in a useEffect means child components mount + run their own effects
// (which read sessionStorage) BEFORE this would have run — React runs child
// effects before parent effects, so a useEffect here was too late.
captureGuidFromUrl();

export default function AppShell() {
  const [activePage, setActivePage] = useState('strategy');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const pageLabel = NAV_ITEMS.find((n) => n.key === activePage)?.label;
  const showLabel = activePage !== 'strategy';

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: OFFWHITE, minHeight: '100vh', color: SLATE }}>
      {drawerOpen && <Drawer activePage={activePage} onSelect={setActivePage} onClose={() => setDrawerOpen(false)} />}

      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: SLATE, padding: '13px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ width: 20, height: 2, background: 'white', borderRadius: 1 }} />
          <div style={{ width: 20, height: 2, background: 'white', borderRadius: 1 }} />
          <div style={{ width: 20, height: 2, background: 'white', borderRadius: 1 }} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <img src={MBH_DROP_IMG} alt="MyBioHealth" style={{ width: 24, height: 24, display: 'block', objectFit: 'contain' }} />
          <div style={{ color: 'white', fontSize: 13, fontWeight: 600, lineHeight: 1 }}>
            <em style={{ fontStyle: 'normal' }}>My</em>BioHealth
            {showLabel && <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}> · {pageLabel}</span>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        {activePage === 'strategy'   && <MyStrategyPage />}
        {activePage === 'biosignals' && <BioSignalsPage />}
        {activePage === 'glucose'    && <GlucoseSummaryPage />}
        {activePage === 'dexa'       && <DEXAPage />}
        {activePage === 'vault'      && <VaultPage />}
        {activePage === 'calendar'   && <CalendarPage />}
        {activePage === 'library'    && <LibraryPage />}
        {activePage === 'questions'  && <QuestionsPage />}
      </div>
    </div>
  );
}
