import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { IconExternalLink, IconRefresh } from '@tabler/icons-react';
import Loading from '../components/Loading.jsx';
import { Balance } from '../components/Money.jsx';
import { notifyChanged } from '../components/CommandSheet.jsx';
import { api } from '../lib/api.js';
import { useAuth, useMeta, useToast } from '../lib/context.jsx';
import { useFetch } from '../lib/useFetch.js';
import { usePage } from '../lib/usePage.js';
import { LANGUAGES, TONES, rupees, shortDate } from '../lib/format.js';
import { useReloadOnChange } from './Galla.jsx';

export default function Reminders() {
  usePage('Yaad dilao');
  const { user } = useAuth();
  const meta = useMeta();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const due = useFetch('/customers?filter=due');
  const history = useFetch('/reminders');
  useReloadOnChange(due.reload);

  const [selected, setSelected] = useState(params.get('customer') || '');
  const [language, setLanguage] = useState(user?.language || 'hi');
  const [tone, setTone] = useState(user?.defaultTone || 'polite');
  const [message, setMessage] = useState('');
  const [engine, setEngine] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const customer = due.data?.customers.find((c) => c.id === selected);

  const preview = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const r = await api('/ai/reminder', { method: 'POST', body: { customerId: selected, language, tone } });
      setMessage(r.message);
      setEngine(r.engine);
      setPayUrl(r.payUrl);
    } catch (err) {
      setError(err.message);
      setMessage('');
    } finally {
      setBusy(false);
    }
  }, [selected, language, tone]);

  useEffect(() => {
    preview();
  }, [preview]);

  const choose = (id) => {
    setSelected(id);
    const next = new URLSearchParams(params);
    next.set('customer', id);
    setParams(next, { replace: true });
  };

  // The button is a real link, so WhatsApp opens in a new tab everywhere
  // (no pop-up blockers). The reminder is logged at the same moment.
  const fullMessage = payUrl && !message.includes(payUrl) ? `${message}\n${payUrl}` : message;
  const waHref = customer
    ? `https://wa.me/${customer.phone ? `91${customer.phone}` : ''}?text=${encodeURIComponent(fullMessage)}`
    : '#';

  const send = async (e) => {
    if (message.trim().length < 10) {
      e.preventDefault();
      setError('The message is too short.');
      return;
    }
    setError('');
    try {
      await api('/reminders', { method: 'POST', body: { customerId: selected, language, tone, message } });
      toast('WhatsApp opened. Press Send there to deliver the reminder.');
      history.reload();
      notifyChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <h1>Yaad dilao</h1>
      <p className="muted">
        Choose a customer, check the message, then open WhatsApp. Nothing is sent until you press Send in WhatsApp.
      </p>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card" aria-labelledby="who-title">
          <h2 id="who-title">Who to remind</h2>
          {due.loading && !due.data && <Loading />}
          {due.data && due.data.customers.length === 0 && <p className="muted">Nobody owes you anything right now.</p>}
          <ul className="pick-list">
            {due.data?.customers.map((c) => (
              <li key={c.id}>
                <button type="button" aria-pressed={selected === c.id} onClick={() => choose(c.id)}>
                  <span>
                    <span className="hand" style={{ fontSize: '1.2rem' }}>{c.name}</span>
                    {c.status === 'overdue' && <span className="chip chip-due" style={{ marginLeft: 8 }}>30+ days</span>}
                    {!c.phone && <span className="small muted" style={{ display: 'block' }}>No phone saved: you&apos;ll pick the chat in WhatsApp</span>}
                  </span>
                  <Balance value={c.balance} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-labelledby="msg-title">
          <h2 id="msg-title">Message</h2>
          {!customer && <p className="muted">Choose a customer on the left to see the message.</p>}
          {customer && (
            <>
              <div className="field">
                <span className="label" id="lang-label">Language</span>
                <div className="filter-chips" role="group" aria-labelledby="lang-label">
                  {LANGUAGES.map((l) => (
                    <button key={l.value} type="button" aria-pressed={language === l.value} onClick={() => setLanguage(l.value)}>{l.label}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="label" id="tone-label">Tone</span>
                <div className="filter-chips" role="group" aria-labelledby="tone-label">
                  {TONES.map((t) => (
                    <button key={t.value} type="button" aria-pressed={tone === t.value} onClick={() => setTone(t.value)}>{t.label}</button>
                  ))}
                </div>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="field">
                <label htmlFor="message">Message to {customer.name.split(' ')[0]} (you can edit it)</label>
                <textarea id="message" className="textarea" value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} aria-describedby="message-hint" aria-busy={busy} />
                <span id="message-hint" className="hint">
                  {engine === 'gemini'
                    ? 'Written by Gemini from a template. No customer details were sent to it.'
                    : 'Ready-made template.'}{' '}
                  Keep it respectful: no threats, shaming or extra charges.
                </span>
              </div>
              <p className="small muted" style={{ marginTop: -6 }}>Preview:</p>
              <div className="bubble" aria-hidden="true">{message || '…'}</div>
              <div className="row" style={{ marginTop: 14 }}>
                <button type="button" className="btn" onClick={preview} disabled={busy}>
                  <IconRefresh size={16} aria-hidden="true" /> {meta?.ai?.enabled ? 'Rewrite' : 'Reset message'}
                </button>
                <a
                  className="btn btn-primary"
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={send}
                  aria-disabled={busy || !message ? 'true' : undefined}
                >
                  Open in WhatsApp <IconExternalLink size={16} aria-hidden="true" />
                  <span className="sr-only">(opens a new tab)</span>
                </a>
              </div>
              {window.__UK_DEMO__ && payUrl && (
                <p className="small" style={{ marginTop: 12, marginBottom: 0 }}>
                  Demo: <Link to={`/pay/${payUrl.split('/pay/')[1]}`}>see the payment page {customer.name.split(' ')[0]} would open</Link>
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }} aria-labelledby="hist-title">
        <h2 id="hist-title">Reminders opened in WhatsApp</h2>
        {history.data && history.data.reminders.length === 0 && <p className="muted" style={{ margin: 0 }}>None yet.</p>}
        {history.data && history.data.reminders.length > 0 && (
          <div className="table-scroll">
            <table className="ruled">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Customer</th>
                  <th scope="col" className="num">Amount then</th>
                  <th scope="col" className="num">Balance now</th>
                </tr>
              </thead>
              <tbody>
                {history.data.reminders.map((r) => (
                  <tr key={r.id}>
                    <td className="small">{shortDate(r.createdAt)}</td>
                    <td>{r.customerId ? <Link to={`/app/grahak/${r.customerId}`}>{r.customerName}</Link> : r.customerName}</td>
                    <td className="num">{rupees(r.amount)}</td>
                    <td className="num">{r.currentBalance === null ? '—' : <Balance value={r.currentBalance} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginBottom: 0, marginTop: 10 }}>
          We can&apos;t see whether you pressed Send in WhatsApp, so this list shows reminders you opened.
        </p>
      </section>
    </>
  );
}
