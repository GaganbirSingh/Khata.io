import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { IconHome, IconUsers, IconBell, IconChartBar, IconChevronDown, IconSettings, IconLogout, IconScan } from '@tabler/icons-react';
import Seal from './Seal.jsx';
import { Mark } from './Logo.jsx';
import Loading from './Loading.jsx';
import CommandSheet from './CommandSheet.jsx';
import CookieNotice from './CookieNotice.jsx';
import CursorGlow from './CursorGlow.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { useAuth, useToast } from '../lib/context.jsx';
import { api } from '../lib/api.js';
import { initials, longDate } from '../lib/format.js';

function DemoBanner({ user }) {
  if (!user.isDemo) return null;
  const hours = Math.max(0, Math.round((new Date(user.demoExpiresAt) - Date.now()) / 3600000));
  return (
    <aside className="banner banner-demo" aria-label="Demo notice">
      Demo shop with made-up data. It is deleted automatically in about {hours} hour{hours === 1 ? '' : 's'}.{' '}
      <Link to="/signup">Create your own shop</Link>
    </aside>
  );
}

function ShopMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { endSession } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    endSession(); // the app then redirects to the home page
    toast('Logged out');
  };

  return (
    <div className="shop-menu" ref={ref}>
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">{initials(user.shopName)}</span>
        <span className="small" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.shopName}
        </span>
        <IconChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul className="menu">
          <li>
            <Link to="/app/settings" onClick={() => setOpen(false)}>
              <IconSettings size={18} aria-hidden="true" /> Settings and my data
            </Link>
          </li>
          <li>
            <Link to="/app/scan" onClick={() => setOpen(false)}>
              <IconScan size={18} aria-hidden="true" /> Scan khata page
            </Link>
          </li>
          <li>
            <ThemeToggle variant="menu" onDone={() => setOpen(false)} />
          </li>
          <li>
            <button type="button" onClick={logout}>
              <IconLogout size={18} aria-hidden="true" /> Log out
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export default function AppLayout() {
  const { user, signedOut } = useAuth();
  const location = useLocation();
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const open = () => setCommandOpen(true);
    window.addEventListener('khata:open-command', open);
    return () => window.removeEventListener('khata:open-command', open);
  }, []);

  if (user === undefined) return <Loading label="Opening your khata" />;
  if (user === null) return signedOut ? <Navigate to="/" replace /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <>
      <CursorGlow />
      <a href="#main" className="skip-link">Skip to content</a>
      <DemoBanner user={user} />
      <header className="container app-top layer">
        <p className="date">{longDate(new Date())}</p>
        <Seal to="/app" size={34} />
        <ShopMenu user={user} />
      </header>
      <main id="main" className="container app-main layer">
        <Outlet />
      </main>
      <nav className="dock-wrap" aria-label="App">
        <div className="dock">
          <NavLink to="/app" end>
            <IconHome size={22} aria-hidden="true" />
            Aaj
          </NavLink>
          <NavLink to="/app/grahak">
            <IconUsers size={22} aria-hidden="true" />
            Grahak
          </NavLink>
          <button type="button" className="dock-seal" onClick={() => setCommandOpen(true)} aria-haspopup="dialog">
            <Mark size={32} />
            <span>Likho</span>
            <span className="sr-only">: add an entry by typing or speaking</span>
          </button>
          <NavLink to="/app/yaad">
            <IconBell size={22} aria-hidden="true" />
            Yaad
          </NavLink>
          <NavLink to="/app/hisaab">
            <IconChartBar size={22} aria-hidden="true" />
            Hisaab
          </NavLink>
        </div>
      </nav>
      {commandOpen && <CommandSheet onClose={() => setCommandOpen(false)} />}
      <CookieNotice />
    </>
  );
}
