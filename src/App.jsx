import { useEffect, useState } from 'react';
import LandingPage from './pages/LandingPage.jsx';
import AppShell from './pages/AppShell.jsx';
import LegalPage from './pages/LegalPage.jsx';

// Trivial top-level routing (in-app pages under /app are handled in AppShell via
// lib/routes.js). Netlify's SPA fallback serves index.html for every path, so
// direct hits like /eula-v1 land here and resolve client-side.

function getRoute() {
  const path = window.location.pathname;
  if (path === '/app' || path.startsWith('/app/')) return { name: 'app' };
  // Public legal pages, optionally version-pinned: /eula, /eula-v1, /privacy, /privacy-v2 …
  const legal = path.match(/^\/(eula|privacy)(?:-v\d+)?\/?$/i);
  if (legal) return { name: legal[1].toLowerCase() };
  return { name: 'landing' };
}

export default function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onPop = () => setRoute(getRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  switch (route.name) {
    case 'app':     return <AppShell />;
    case 'eula':    return <LegalPage doc="eula" />;
    case 'privacy': return <LegalPage doc="privacy" />;
    default:        return <LandingPage />;
  }
}
