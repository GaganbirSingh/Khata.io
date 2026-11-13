import { useState } from 'react';
import { Link } from 'react-router';
import { IconDownload, IconTrash, IconLogout, IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons-react';
import Dialog from '../components/Dialog.jsx';
import { api } from '../lib/api.js';
import { useAuth, useMeta, useToast } from '../lib/context.jsx';
import { usePage } from '../lib/usePage.js';
import { useTheme } from '../lib/theme.js';
import { LANGUAGES, SHOP_TYPES, TONES } from '../lib/format.js';

const THEMES = [
  { value: 'system', label: 'Same as my device', Icon: IconDeviceDesktop },
  { value: 'light', label: 'Din (light)', Icon: IconSun },
  { value: 'dark', label: 'Raat (dark)', Icon: IconMoon },
];

function Appearance() {
  const { choice, setTheme } = useTheme();
  return (
    <section className="card" aria-labelledby="look-title">
      <h2 id="look-title">Appearance</h2>
      <p className="small muted">Raat mode dims the counter for late hours. Parchis and the khata book stay paper, so they read the same day or night.</p>
      <div className="segmented" role="group" aria-label="Colour mode">
        {THEMES.map(({ value, label, Icon }) => (
          <button key={value} type="button" aria-pressed={choice === value} onClick={() => setTheme(value)}>
            <Icon size={16} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 6 }} />
            {label}
          </button>
        ))}
      </div>
      <p className="small muted" style={{ margin: '10px 0 0' }}>Saved in this browser only.</p>
    </section>
  );
}

export default function Settings() {
  usePage('Settings and my data');
  const { user, setUser, endSession } = useAuth();
  const meta = useMeta();
  const toast = useToast();
  const [profile, setProfile] = useState({
    shopName: user.shopName,
    shopType: user.shopType,
    language: user.language,
    defaultTone: user.defaultTone,
  });
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwError, setPwError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delError, setDelError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportText, setExportText] = useState('');

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    try {
      const { user: u } = await api('/account', { method: 'PATCH', body: profile });
      setUser(u);
      toast('Settings saved');
    } catch (err) {
      setProfileError(err.message);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pw.next.length < 8) return setPwError('New password must be at least 8 characters.');
    try {
      await api('/account/password', { method: 'POST', body: pw });
      setPw({ current: '', next: '' });
      toast('Password changed');
    } catch (err) {
      setPwError(err.message);
    }
  };

  const download = async () => {
    try {
      const data = await api('/account/export');
      if (window.__UK_DEMO__) {
        // The live demo can't start file downloads, so show the data instead.
        setExportText(JSON.stringify(data, null, 2));
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'khata-io-my-data.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Your data was downloaded');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    endSession();
    toast('Logged out');
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    setBusy(true);
    setDelError('');
    try {
      await api('/account', { method: 'DELETE', body: user.isDemo ? {} : { password: delPw } });
      endSession();
      toast('Your account and all its data were deleted');
    } catch (err) {
      setDelError(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Settings and my data</h1>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <form className="card" onSubmit={saveProfile} aria-labelledby="shop-title" noValidate>
          <h2 id="shop-title">Shop</h2>
          {profileError && <p className="form-error" role="alert">{profileError}</p>}
          <div className="field">
            <label htmlFor="s-name">Shop name</label>
            <input id="s-name" className="input" maxLength={80} value={profile.shopName} onChange={(e) => setProfile({ ...profile, shopName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="s-type">Shop type</label>
            <select id="s-type" className="select" value={profile.shopType} onChange={(e) => setProfile({ ...profile, shopType: e.target.value })}>
              {SHOP_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="s-lang">Default reminder language</label>
            <select id="s-lang" className="select" value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })}>
              {LANGUAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="s-tone">Default reminder tone</label>
            <select id="s-tone" className="select" value={profile.defaultTone} onChange={(e) => setProfile({ ...profile, defaultTone: e.target.value })}>
              {TONES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Save settings</button>
        </form>

        <div className="stack">
          <Appearance />

          {!user.isDemo && (
            <form className="card" onSubmit={changePassword} aria-labelledby="pw-title" noValidate>
              <h2 id="pw-title">Change password</h2>
              {pwError && <p className="form-error" role="alert">{pwError}</p>}
              <div className="field">
                <label htmlFor="pw-cur">Current password</label>
                <input id="pw-cur" type="password" className="input" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="pw-new">New password</label>
                <input id="pw-new" type="password" className="input" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} aria-describedby="pw-new-hint" />
                <span id="pw-new-hint" className="hint">At least 8 characters.</span>
              </div>
              <button type="submit" className="btn">Change password</button>
            </form>
          )}

          <section className="card" aria-labelledby="data-title">
            <h2 id="data-title">Your data</h2>
            <p className="small">
              We store your {user.isDemo ? 'demo shop' : 'email, a scrambled (hashed) password,'} shop details, your customers&apos; names and
              optional phone numbers, and your khata entries and reminders. Nothing else.
            </p>
            <p className="small">
              {user.isDemo
                ? `This demo shop is deleted automatically ${meta?.demoHours || 24} hours after it was created.`
                : `If you don't log in for ${meta?.retentionDays || 30} days, your account and its data are deleted automatically.`}
            </p>
            <div className="row">
              <button type="button" className="btn" onClick={logout}><IconLogout size={18} aria-hidden="true" /> Log out</button>
              <button type="button" className="btn" onClick={download}><IconDownload size={18} aria-hidden="true" /> Download my data</button>
              <button type="button" className="btn btn-danger" onClick={() => setDeleting(true)}><IconTrash size={18} aria-hidden="true" /> Delete my account</button>
            </div>
            <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
              <Link to="/privacy">Privacy policy</Link> · <Link to="/terms">Terms</Link> · <Link to="/cookies">Cookies</Link> ·{' '}
              <Link to="/refunds">Refunds</Link>
            </p>
          </section>
        </div>
      </div>

      {exportText && (
        <Dialog title="Your data" onClose={() => setExportText('')}>
          <p className="small muted">This is everything stored for your shop, as JSON. In the real app it downloads as a file.</p>
          <label htmlFor="export-json" className="sr-only">Your data as JSON</label>
          <textarea id="export-json" className="textarea" readOnly value={exportText} style={{ minHeight: 280, fontFamily: 'monospace', fontSize: '0.8rem' }} />
        </Dialog>
      )}
      {deleting && (
        <Dialog title="Delete your account?" onClose={() => setDeleting(false)}>
          <p>This permanently deletes your shop, all customers, entries and reminders right away. It cannot be undone.</p>
          <p className="small muted">Tip: download your data first if you want a copy.</p>
          <form onSubmit={deleteAccount} noValidate>
            {delError && <p className="form-error" role="alert">{delError}</p>}
            {!user.isDemo && (
              <div className="field">
                <label htmlFor="del-pw">Enter your password to confirm</label>
                <input id="del-pw" type="password" className="input" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
              </div>
            )}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setDeleting(false)}>Keep my account</button>
              <button type="submit" className="btn btn-danger-solid" disabled={busy}>Delete everything</button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
