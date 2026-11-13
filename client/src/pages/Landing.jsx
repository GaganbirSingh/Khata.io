import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { IconScan, IconMicrophone, IconMessageCircle, IconQrcode, IconCheck, IconArrowRight } from '@tabler/icons-react';
import Dialog from '../components/Dialog.jsx';
import ConsentChecks from '../components/ConsentChecks.jsx';
import { api } from '../lib/api.js';
import { useAuth, useMeta } from '../lib/context.jsx';
import { usePage } from '../lib/usePage.js';

export function DemoDialog({ onClose }) {
  const [consent, setConsent] = useState({ ageConfirmed: false, acceptTerms: false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const { setUser } = useAuth();
  const meta = useMeta();
  const navigate = useNavigate();

  const start = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!consent.ageConfirmed) errs.ageConfirmed = 'Please confirm you are 18 or older.';
    if (!consent.acceptTerms) errs.acceptTerms = 'Please accept the Terms and Privacy Policy.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const { user } = await api('/auth/demo', { method: 'POST', body: consent });
      setUser(user);
      navigate('/app');
    } catch (err) {
      setFormError(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog title="Open the demo shop" onClose={onClose}>
      <p>
        You&apos;ll get a sample shop filled with made-up customers. Nothing you do there involves real money, and the whole
        shop is deleted automatically after {meta?.demoHours || 24} hours.
      </p>
      <p className="small muted">No email or sign-up needed. Please don&apos;t type real people&apos;s names or numbers into the demo.</p>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <form onSubmit={start} noValidate>
        <ConsentChecks values={consent} onChange={setConsent} errors={errors} />
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Opening…' : 'Open demo shop'}
        </button>
      </form>
    </Dialog>
  );
}

const FEATURES = [
  { icon: IconScan, title: 'Scan your khata', text: 'Photograph a notebook page. AI reads the handwriting and lists every entry for you to check.' },
  { icon: IconMicrophone, title: 'Bolo, likho', text: 'Type or say “Ramesh ne 250 ka atta liya”. It becomes a clean entry once you confirm it.' },
  { icon: IconMessageCircle, title: 'Polite reminders', text: 'Ready-made messages in Hinglish, Punjabi or English. WhatsApp opens with the text; you press Send.' },
  { icon: IconQrcode, title: 'Pay by UPI link', text: 'Every reminder carries a private link. When the customer pays, their khata updates itself.' },
];

const STEPS = [
  ['Write it down', 'Snap a page, type, or say an entry.'],
  ['Check it', 'Review what the AI found. Nothing is saved until you confirm.'],
  ['Remind', 'Send a polite reminder through WhatsApp.'],
  ['Get paid', 'The customer pays by UPI and the balance updates.'],
];

// A static preview of a customer's khata, drawn with the app's own styles.
function KhataPreview() {
  return (
    <div className="lp-preview" aria-hidden="true">
      <div className="lp-sheet">
        <div className="lp-sheet-head">
          <div>
            <p className="lp-name">Ramesh Kumar</p>
            <p className="lp-sub">Oldest unpaid udhaar from 2 Oct</p>
          </div>
          <span className="money money-due lp-bal">₹1,000 baaki</span>
        </div>
        <table className="ruled lp-table">
          <tbody>
            <tr><td>6 Oct</td><td className="hand">Purane baaki mein</td><td className="num money-paid">−₹250</td></tr>
            <tr><td>6 Oct</td><td className="hand">Atta <span className="tag tag-cash">Nakad</span></td><td className="num">₹250</td></tr>
            <tr><td>5 Oct</td><td className="hand">Doodh, bread</td><td className="num"><span className="money-due">+₹120</span></td></tr>
            <tr><td>2 Oct</td><td className="hand">Chawal, daal, chini</td><td className="num"><span className="money-due">+₹980</span></td></tr>
          </tbody>
        </table>
        <div className="lp-sheet-foot">
          <span className="lp-fake-btn">Yaad dilao</span>
          <span className="lp-fake-btn ghost">Entry likho</span>
        </div>
      </div>
      <div className="lp-toast">
        <span className="lp-toast-ic"><IconCheck size={16} /></span>
        <span>
          <strong>₹500 received</strong>
          <br />
          Sunita paid by UPI
        </span>
      </div>
    </div>
  );
}

export default function Landing() {
  usePage('');
  const [demoOpen, setDemoOpen] = useState(false);
  const { user } = useAuth();
  const meta = useMeta();

  const primary = user ? (
    <Link to="/app" className="btn btn-primary lp-cta-btn">Open my khata <IconArrowRight size={18} aria-hidden="true" /></Link>
  ) : (
    <button type="button" className="btn btn-primary lp-cta-btn" onClick={() => setDemoOpen(true)}>
      Try the demo shop <IconArrowRight size={18} aria-hidden="true" />
    </button>
  );

  return (
    <>
      <section className="container lp-hero">
        <div className="lp-hero-text">
          <p className="lp-eyebrow">Digital bahi khata for kirana, medical, dairy and hardware shops</p>
          <h1 className="lp-title">
            Notebook se <span className="lp-mark">smart khata.</span>
          </h1>
          <p className="lp-lead">
            Keep track of every rupee of udhaar. Snap your notebook, speak an entry, and send a polite reminder with a UPI link.
          </p>
          <div className="row lp-actions">
            {primary}
            <Link to="/welcome" className="btn lp-cta-btn">Create your own shop</Link>
          </div>
          <ul className="lp-trust">
            <li><IconCheck size={16} aria-hidden="true" /> Free, no hidden charges</li>
            <li><IconCheck size={16} aria-hidden="true" /> No ads or tracking</li>
            <li><IconCheck size={16} aria-hidden="true" /> Delete your data anytime</li>
          </ul>
        </div>
        <KhataPreview />
      </section>

      <section id="features" className="container lp-section" aria-labelledby="features-title">
        <p className="lp-kicker">What it does</p>
        <h2 id="features-title" className="lp-h2">Everything a shop counter needs. Nothing it doesn&apos;t.</h2>
        <div className="lp-features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article className="lp-feature" key={title}>
              <span className="lp-ic"><Icon size={22} aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="container lp-section" aria-labelledby="how-title">
        <p className="lp-kicker">How it works</p>
        <h2 id="how-title" className="lp-h2">From notebook to paid, in four steps.</h2>
        <ol className="lp-steps">
          {STEPS.map(([t, d]) => (
            <li key={t}>
              <h3>{t}</h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container lp-section lp-principles" aria-labelledby="trust-title">
        <div>
          <p className="lp-kicker">Honest by design</p>
          <h2 id="trust-title" className="lp-h2">Fair maths, and your data stays yours.</h2>
          <p className="muted">
            Khata.io is not a bank or lender. It only helps you keep your own records, and it never sells or shares them.{' '}
            <Link to="/privacy">Read the privacy policy</Link>
          </p>
        </div>
        <ul className="lp-checks">
          <li><IconCheck size={18} aria-hidden="true" /> Paying for today&apos;s goods never hides old baaki. Payments clear the oldest udhaar first.</li>
          <li><IconCheck size={18} aria-hidden="true" /> AI suggestions are never saved without your OK.</li>
          <li><IconCheck size={18} aria-hidden="true" /> No ads, no analytics, no tracking tools.</li>
          <li><IconCheck size={18} aria-hidden="true" /> Inactive accounts are deleted after {meta?.retentionDays || 30} days.</li>
        </ul>
      </section>

      <section className="container lp-section">
        <div className="lp-final">
          <div>
            <h2 className="lp-final-title">Close the notebook. Open your khata.</h2>
            <p>Try the demo shop in one click. No email, no sign-up.</p>
          </div>
          <div className="row">
            {user ? (
              <Link to="/app" className="btn btn-lemon">Open my khata</Link>
            ) : (
              <button type="button" className="btn btn-lemon" onClick={() => setDemoOpen(true)}>Try the demo shop</button>
            )}
          </div>
        </div>
      </section>
      {demoOpen && <DemoDialog onClose={() => setDemoOpen(false)} />}
    </>
  );
}
