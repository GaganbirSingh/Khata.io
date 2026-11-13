import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { IconCheck, IconLock } from '@tabler/icons-react';
import Loading from '../components/Loading.jsx';
import { Mark } from '../components/Logo.jsx';
import CursorGlow from '../components/CursorGlow.jsx';
import Dialog from '../components/Dialog.jsx';
import { EntryAmount } from '../components/Money.jsx';
import { api } from '../lib/api.js';
import { rupees, shortDate } from '../lib/format.js';

const PENDING_KEY = 'uk_pending_payment';

export default function Pay() {
  const { token } = useParams();
  const [search] = useSearchParams();
  const [info, setInfo] = useState(null);
  const [missing, setMissing] = useState('');
  const [mode, setMode] = useState('full');
  const [part, setPart] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoPayment, setDemoPayment] = useState(null);
  const [paid, setPaid] = useState(null);
  const [waiting, setWaiting] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api(`/pay/${token}`);
      setInfo(d);
      document.title = `Pay ${d.shopName}`;
    } catch (err) {
      setMissing(err.message);
      document.title = 'Payment link';
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Coming back from Razorpay: wait for the webhook to confirm the payment.
  useEffect(() => {
    if (search.get('done') !== '1') return undefined;
    let pending;
    try {
      pending = JSON.parse(window.sessionStorage.getItem(PENDING_KEY) || 'null');
    } catch {
      pending = null;
    }
    if (!pending || pending.token !== token) return undefined;
    setWaiting(true);
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      try {
        const s = await api(`/pay/${token}/status/${pending.paymentId}`);
        if (s.status === 'paid') {
          clearInterval(timer);
          window.sessionStorage.removeItem(PENDING_KEY);
          setWaiting(false);
          setPaid({ amount: s.amount });
          load();
        }
      } catch {
        /* keep waiting */
      }
      if (tries >= 20) {
        clearInterval(timer);
        setWaiting(false);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [search, token, load]);

  const amount = mode === 'full' ? info?.amountDue : Number(part);

  const pay = async () => {
    setError('');
    if (!(amount >= 1)) return setError('Enter at least ₹1.');
    if (amount > info.amountDue) return setError(`You can pay up to ${rupees(info.amountDue)}.`);
    setBusy(true);
    try {
      const r = await api(`/pay/${token}/start`, { method: 'POST', body: { amount } });
      if (r.mode === 'demo') {
        setDemoPayment({ id: r.paymentId, amount });
        setBusy(false);
      } else {
        window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ token, paymentId: r.paymentId }));
        window.location.assign(r.url);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const completeDemo = async () => {
    setBusy(true);
    try {
      const r = await api(`/pay/${token}/demo-complete`, { method: 'POST', body: { paymentId: demoPayment.id } });
      setDemoPayment(null);
      setPaid({ amount: r.amountPaid });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <CursorGlow />
    <div className="pay-wrap layer">
      <a href="#pay-main" className="skip-link">Skip to content</a>
      {(info?.isDemo || info?.paymentMode === 'demo') && (
        <aside className="banner banner-demo" style={{ borderRadius: 12, marginBottom: 14 }} aria-label="Demo notice">
          Demo payment page. No real money moves here.
        </aside>
      )}
      <main id="pay-main">
        {!info && !missing && <Loading label="Loading your bill" />}
        {missing && (
          <div className="card center">
            <h1>Link not available</h1>
            <p>{missing}</p>
          </div>
        )}
        {info && paid && (
          <div className="card center" role="status">
            <div className="success-mark stamp-in"><IconCheck size={40} aria-hidden="true" /></div>
            <h1>{rupees(paid.amount)} paid</h1>
            <p>Thank you! {info.shopName}&apos;s khata has been updated.</p>
            <p className="small muted">Amount still due: {rupees(info.amountDue)}</p>
          </div>
        )}
        {info && !paid && (
          <>
            <p className="small muted" style={{ margin: 0 }}>{info.shopName}</p>
            <h1 style={{ marginBottom: 4 }}>Namaste {info.customerFirstName} ji</h1>
            {waiting && (
              <p className="notice" role="status">
                <Mark size={24} className="swinging" /> Waiting for payment confirmation…
              </p>
            )}
            <section className="card" aria-labelledby="due-title" style={{ marginTop: 12 }}>
              <h2 id="due-title" className="small muted" style={{ fontFamily: 'var(--font-body)', margin: 0 }}>Amount due</h2>
              <p className="pay-amount"><span className="money-due">{rupees(info.amountDue)}</span></p>
              {info.entries.length > 0 && (
                <table className="ruled" style={{ marginTop: 10 }}>
                  <caption className="small muted" style={{ textAlign: 'left', paddingBottom: 4 }}>Your recent entries</caption>
                  <thead>
                    <tr><th scope="col">Date</th><th scope="col">Details</th><th scope="col" className="num">Amount</th></tr>
                  </thead>
                  <tbody>
                    {info.entries.map((e, i) => (
                      <tr key={i}>
                        <td className="small">{shortDate(e.date)}</td>
                        <td className="hand">{e.items || (e.type === 'jama' ? 'Paid' : 'Udhaar')}</td>
                        <td className="num"><EntryAmount type={e.type} amount={e.amount} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {info.amountDue > 0 ? (
              <section style={{ marginTop: 16 }} aria-labelledby="pay-how">
                <h2 id="pay-how" className="sr-only">Choose amount</h2>
                {error && <p className="form-error" role="alert">{error}</p>}
                <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                  <legend className="sr-only">How much to pay</legend>
                  <div className="check">
                    <input type="radio" id="pay-full" name="amount" checked={mode === 'full'} onChange={() => setMode('full')} />
                    <label htmlFor="pay-full">Pay full {rupees(info.amountDue)}</label>
                  </div>
                  <div className="check">
                    <input type="radio" id="pay-part" name="amount" checked={mode === 'part'} onChange={() => setMode('part')} />
                    <label htmlFor="pay-part">Pay part</label>
                  </div>
                  {mode === 'part' && (
                    <div className="field">
                      <label htmlFor="part-amount">Amount (₹)</label>
                      <input id="part-amount" className="input" inputMode="decimal" value={part} onChange={(e) => setPart(e.target.value)} />
                    </div>
                  )}
                </fieldset>
                <button type="button" className="btn btn-lemon btn-block" onClick={pay} disabled={busy} style={{ minHeight: 54, fontSize: '1.05rem' }}>
                  Pay {amount >= 1 ? rupees(amount) : ''} with UPI
                </button>
                <p className="small muted center" style={{ marginTop: 10 }}>
                  <IconLock size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
                  {info.paymentMode === 'demo'
                    ? 'Demo mode: you will only be asked to confirm a pretend payment.'
                    : 'You will pay on Razorpay\'s secure page. We never see your UPI PIN or bank details.'}{' '}
                  No extra charges are added.
                </p>
              </section>
            ) : (
              <p className="notice" style={{ marginTop: 16 }}>You have nothing to pay right now. Thank you!</p>
            )}
          </>
        )}
      </main>
      <footer className="small muted center" style={{ marginTop: 28 }}>
        <p>
          This page was shared by {info?.shopName || 'a shop'} using Khata.io, a student demo project. It is not a bank or lender.
        </p>
        <p>
          <Link to="/privacy">Privacy policy</Link> · <Link to="/terms">Terms</Link> · <Link to="/refunds">Refunds</Link>
        </p>
        {window.__UK_DEMO__ && (
          <p>
            <Link to="/app" className="btn btn-small">Back to the shop app (demo)</Link>
          </p>
        )}
      </footer>

      {demoPayment && (
        <Dialog title="Demo payment" onClose={() => setDemoPayment(null)}>
          <p>
            This is a demo. No money will move. Pressing the button below pretends that {rupees(demoPayment.amount)} was paid by UPI,
            so you can see the khata update.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setDemoPayment(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={completeDemo} disabled={busy}>Complete demo payment</button>
          </div>
        </Dialog>
      )}
    </div>
    </>
  );
}
