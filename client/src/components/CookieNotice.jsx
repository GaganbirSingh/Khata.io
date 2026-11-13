import { useEffect, useState } from 'react';
import { Link } from 'react-router';

const KEY = 'uk_cookie_notice_seen';

// An information notice, not a consent banner: the app sets only one strictly
// necessary cookie, so there is nothing to accept or reject.
export default function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!window.localStorage.getItem(KEY));
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  const close = () => {
    try {
      window.localStorage.setItem(KEY, '1');
    } catch {
      /* storage blocked: the notice will simply show again next time */
    }
    setShow(false);
  };
  return (
    <section className="cookie-notice" aria-label="Cookie notice">
      <p className="small" style={{ margin: 0 }}>
        We use one essential cookie to keep you logged in. No ads, no tracking, no analytics.{' '}
        <Link to="/cookies">Cookie policy</Link>
      </p>
      <div style={{ textAlign: 'right', marginTop: 8 }}>
        <button type="button" className="btn btn-small" onClick={close}>
          Got it
        </button>
      </div>
    </section>
  );
}
