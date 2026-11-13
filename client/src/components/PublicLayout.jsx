import { Link, NavLink, Outlet } from 'react-router';
import Seal from './Seal.jsx';
import Logo from './Logo.jsx';
import CookieNotice from './CookieNotice.jsx';
import CursorGlow from './CursorGlow.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { useAuth, useMeta } from '../lib/context.jsx';

export function Footer() {
  const meta = useMeta();
  return (
    <footer className="site-footer layer">
      <div className="container">
        <p style={{ margin: '0 0 10px' }}>
          <Logo size={34} onDark />
        </p>
        <p style={{ margin: 0 }}>
          <strong>Khata.io</strong> is a digital udhaar khata for kirana and small shops in India. Shopkeepers record credit by typing, speaking or scanning their notebook, see who owes what, and send polite WhatsApp reminders with a UPI payment link. Khata.io is not a bank, lender or payment company.
        </p>
        <nav aria-label="Legal">
          <ul>
            <li><Link to="/privacy">Privacy policy</Link></li>
            <li><Link to="/terms">Terms of use</Link></li>
            <li><Link to="/cookies">Cookie policy</Link></li>
            <li><Link to="/refunds">Refund policy</Link></li>
            <li><Link to="/accessibility">Accessibility</Link></li>
            <li><a href="third-party-licenses.txt">Open-source licences</a></li>
          </ul>
        </nav>
        <p className="muted small" style={{ margin: 0 }}>
          © {new Date().getFullYear()} Gaganbir Singh · <a href="mailto:gsingh1_be23@thapar.edu">gsingh1_be23@thapar.edu</a>
        </p>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const { user } = useAuth();
  return (
    <>
      <CursorGlow />
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="site-header layer">
        <div className="container inner">
          <nav aria-label="Main">
            <ul>
              <li><a href="/#features">Features</a></li>
              <li><a href="/#how">How it works</a></li>
              <li><NavLink to="/privacy">Privacy</NavLink></li>
            </ul>
          </nav>
          <Seal />
          <div className="actions">
            <ThemeToggle />
            {user ? (
              <Link to="/app" className="btn btn-primary btn-small">Open my khata</Link>
            ) : (
              <>
                <Link to="/welcome" className="btn btn-primary btn-small">Log in or sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="layer">
        <Outlet />
      </main>
      <Footer />
      <CookieNotice />
    </>
  );
}
