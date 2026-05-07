import { useEffect, useState } from 'react';
import LandingPage from './pages/LandingPage.jsx';
import AppShell from './pages/AppShell.jsx';

// Trivial path-based routing. We don't pull in react-router for two routes —
// when we need nested routes inside /app we'll switch to a proper router.

function getRoute() {
  const path = window.location.pathname;
  if (path === '/app' || path.startsWith('/app/')) return 'app';
  return 'landing';
}

export default function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onPop = () => setRoute(getRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return route === 'app' ? <AppShell /> : <LandingPage />;
}
