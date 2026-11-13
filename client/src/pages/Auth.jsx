import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { IconEye, IconEyeOff, IconArrowRight, IconArrowLeft } from '@tabler/icons-react';
import ConsentChecks from '../components/ConsentChecks.jsx';
import Parchu from '../components/Parchu.jsx';
import DoriField from '../components/DoriField.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Seal from '../components/Seal.jsx';
import CookieNotice from '../components/CookieNotice.jsx';
import { DemoDialog } from './Landing.jsx';
import { api } from '../lib/api.js';
import { useAuth, useToast } from '../lib/context.jsx';
import { usePage } from '../lib/usePage.js';
import { LANGUAGES, SHOP_TYPES } from '../lib/format.js';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Parchu's mood follows the form: covers its eyes for passwords, frowns on
// errors, looks up while waiting, and hops when you get in.
function useMood() {
  const [focus, setFocus] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [sad, setSad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [happy, setHappy] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const frown = () => {
    setSad(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSad(false), 1800);
  };
  const mood = happy ? 'happy' : busy ? 'think' : sad ? 'sad' : focus === 'password' ? (showPw ? 'peek' : 'shy') : 'idle';
  // Starting to type again ends the frown.
  const bind = (name) => ({
    onFocus: () => {
      setFocus(name);
      setSad(false);
    },
    onBlur: () => setFocus(''),
  });
  return { mood, bind, showPw, setShowPw, frown, busy, setBusy, setHappy };
}

function Field({ id, label, error, hint, bind, ...props }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={id} className="input" aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} {...bind} {...props} />
      {hint && <span id={`${id}-hint`} className="hint">{hint}</span>}
      {error && <span id={`${id}-error`} className="error">{error}</span>}
    </div>
  );
}

function PasswordField({ id, label, value, onChange, error, hint, autoComplete, m }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input
          id={id}
          name={id}
          className="input"
          type={m.showPw ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...m.bind('password')}
        />
        <button
          type="button"
          className="pw-toggle"
          aria-pressed={m.showPw}
          aria-label={m.showPw ? 'Hide password' : 'Show password'}
          onClick={() => m.setShowPw((s) => !s)}
          {...m.bind('password')}
        >
          {m.showPw ? <IconEyeOff size={20} aria-hidden="true" /> : <IconEye size={20} aria-hidden="true" />}
        </button>
      </div>
      {hint && <span id={`${id}-hint`} className="hint">{hint}</span>}
      {error && <span id={`${id}-error`} className="error">{error}</span>}
    </div>
  );
}

// The form card: lemon, with Parchu peeking over its top edge. A back arrow
// returns to the welcome card.
function FormCard({ mood, formRef, onDemo, children }) {
  return (
    <div className="auth-card-wrap">
      <div className="ac-char">
        <Parchu mood={mood} size={196} scope={formRef} />
      </div>
      <section className="auth-card">
        <Link to="/welcome" className="ac-back" aria-label="Back to the welcome screen">
          <IconArrowLeft size={22} aria-hidden="true" />
        </Link>
        {children}
      </section>
      <p className="auth-below">
        <button type="button" className="btn-link" onClick={onDemo}>
          Just looking? Try the demo shop
        </button>
      </p>
    </div>
  );
}

function WelcomeCard({ onDemo }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/app" replace />;
  return (
    <section className="auth-welcome" aria-labelledby="welcome-title">
      <span className="aw-blob" aria-hidden="true" />
      <span className="aw-dot aw-dot-ink" aria-hidden="true" />
      <span className="aw-dot aw-dot-sonic" aria-hidden="true" />
      <h1 id="welcome-title">
        Udhaar likho,
        <br />
        <span className="aw-hl">tension bhoolo.</span>
      </h1>
      <p>No more lost notebook pages or awkward money talks. Welcome to Khata.io.</p>
      <div className="aw-actions">
        <Link to="/signup" className="btn aw-btn aw-btn-on">
          Create my shop
        </Link>
        <Link to="/login" className="btn aw-btn">
          Log in
        </Link>
        <button type="button" className="btn-link aw-demo" onClick={onDemo}>
          Just looking? Try the demo shop
        </button>
      </div>
      <div className="aw-char">
        <Parchu mood="idle" size={250} />
      </div>
    </section>
  );
}

const TITLES = { welcome: 'Welcome', login: 'Log in', signup: 'Create your shop' };
const OUT_MS = 380;

// One screen at a time, centred. Switching cards plays a short transition:
// the old card turns glassy and fades away, then the new one rises in.
// /welcome, /login and /signup all render this component, so it stays
// mounted and can animate between them.
export function AuthFlow({ mode }) {
  const [shown, setShown] = useState(mode);
  const [phase, setPhase] = useState('in');
  const [demoOpen, setDemoOpen] = useState(false);
  usePage(TITLES[shown]);

  useEffect(() => {
    if (mode === shown) return undefined;
    if (prefersReducedMotion()) {
      setShown(mode);
      setPhase('in');
      return undefined;
    }
    setPhase('out');
    const t = setTimeout(() => {
      setShown(mode);
      setPhase('in');
    }, OUT_MS);
    return () => clearTimeout(t);
  }, [mode, shown]);

  const openDemo = () => setDemoOpen(true);
  return (
    <div className="auth">
      <DoriField mode="full" />
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="auth-top">
        <Seal size={38} />
      </header>
      <main id="main" className="auth-stage">
        <div key={shown} className={`auth-slot auth-slot-${shown} ${phase}`} inert={phase === 'out' ? true : undefined}>
          {shown === 'welcome' && <WelcomeCard onDemo={openDemo} />}
          {shown === 'login' && <LoginCard onDemo={openDemo} />}
          {shown === 'signup' && <SignupCard onDemo={openDemo} />}
        </div>
      </main>
      <footer className="auth-legal">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/cookies">Cookies</Link>
        <Link to="/">Home</Link>
        <ThemeToggle variant="text" />
      </footer>
      <CookieNotice />
      {demoOpen && <DemoDialog onClose={() => setDemoOpen(false)} />}
    </div>
  );
}

function afterSuccess(m, go) {
  m.setBusy(false);
  m.setHappy(true);
  if (prefersReducedMotion()) go();
  else setTimeout(go, 750);
}

function LoginCard({ onDemo }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const formRef = useRef(null);
  const m = useMood();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  if (user && !m.busy && m.mood !== 'happy') return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Enter your email and password.');
      m.frown();
      return;
    }
    m.setBusy(true);
    setError('');
    try {
      const data = await api('/auth/login', { method: 'POST', body: form, quiet401: true });
      afterSuccess(m, () => {
        setUser(data.user);
        navigate(location.state?.from || '/app', { replace: true });
      });
    } catch (err) {
      setError(err.message);
      m.setBusy(false);
      m.frown();
    }
  };

  return (
    <FormCard mood={m.mood} formRef={formRef} onDemo={onDemo}>
      <h1>Wapas aa gaye?</h1>
      <p className="ac-sub">Log in to open your khata.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form ref={formRef} onSubmit={submit} noValidate>
        <Field id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} bind={m.bind('email')} />
        <PasswordField id="password" label="Password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} m={m} />
        <button type="submit" className="btn ac-submit btn-block" disabled={m.busy}>
          {m.busy ? 'Opening…' : 'Khata kholo'} <IconArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
      <p className="ac-switch">
        New here? <Link to="/signup">Create a shop</Link>
      </p>
      <p className="ac-note">This demo doesn&apos;t send emails, so forgotten passwords can&apos;t be reset. You can create a new shop instead.</p>
    </FormCard>
  );
}

function SignupCard({ onDemo }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const m = useMood();
  const [form, setForm] = useState({ email: '', password: '', shopName: '', shopType: 'kirana', language: 'hi' });
  const [consent, setConsent] = useState({ ageConfirmed: false, acceptTerms: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  if (user && !user.isDemo && !m.busy && m.mood !== 'happy') return <Navigate to="/app" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.shopName.trim() || form.shopName.trim().length < 2) errs.shopName = 'Enter your shop name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email.';
    if (form.password.length < 8) errs.password = 'Use at least 8 characters.';
    if (!consent.ageConfirmed) errs.ageConfirmed = 'You must be 18 or older to use this app.';
    if (!consent.acceptTerms) errs.acceptTerms = 'Please accept the Terms and Privacy Policy.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError('Please fix the highlighted fields.');
      m.frown();
      return;
    }
    m.setBusy(true);
    setFormError('');
    try {
      const data = await api('/auth/register', { method: 'POST', body: { ...form, ...consent } });
      afterSuccess(m, () => {
        setUser(data.user);
        toast('Your shop is ready');
        navigate('/app', { replace: true });
      });
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      setFormError(err.message);
      m.setBusy(false);
      m.frown();
    }
  };

  return (
    <FormCard mood={m.mood} formRef={formRef} onDemo={onDemo}>
      <h1>Apni dukaan banao</h1>
      <p className="ac-sub">Takes a minute. We only ask for what the app needs.</p>
      <p className="ac-warn">
        <strong>Student demo project.</strong> Please use sample data only, not real customers&apos; names or numbers.
      </p>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <form ref={formRef} onSubmit={submit} noValidate>
        <Field id="shopName" label="Shop name" value={form.shopName} onChange={set('shopName')} error={errors.shopName} maxLength={80} autoComplete="organization" bind={m.bind('shopName')} />
        <div className="ac-row">
          <div className="field">
            <label htmlFor="shopType">Shop type</label>
            <select id="shopType" className="select" value={form.shopType} onChange={set('shopType')} {...m.bind('shopType')}>
              {SHOP_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="language">Reminder language</label>
            <select id="language" className="select" value={form.language} onChange={set('language')} {...m.bind('language')}>
              {LANGUAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <Field id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} bind={m.bind('email')} />
        <PasswordField id="password" label="Password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="At least 8 characters." m={m} />
        <ConsentChecks values={consent} onChange={setConsent} errors={errors} />
        <button type="submit" className="btn ac-submit btn-block" disabled={m.busy}>
          {m.busy ? 'Creating…' : 'Create my khata'} <IconArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
      <p className="ac-switch">
        Already have a shop? <Link to="/login">Log in</Link>
      </p>
    </FormCard>
  );
}
