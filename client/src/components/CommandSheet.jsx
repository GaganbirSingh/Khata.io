import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { IconArrowRight, IconMicrophone, IconPlayerStopFilled, IconTrash, IconPlus } from '@tabler/icons-react';
import Dialog from './Dialog.jsx';
import { Mark } from './Logo.jsx';
import { api } from '../lib/api.js';
import { useMeta, useToast } from '../lib/context.jsx';
import { rupees } from '../lib/format.js';

const EXAMPLES = ['Ramesh ne 250 ka atta liya', 'Sunita se 800 mile', 'Imran ko 300 ka saaman diya, 100 jama'];
const VOICE_OK = 'uk_voice_ok';

function getRecognition() {
  return typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
}

export function notifyChanged() {
  window.dispatchEvent(new Event('khata:changed'));
}

export default function CommandSheet({ onClose, presetCustomer }) {
  const meta = useMeta();
  const toast = useToast();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const recRef = useRef(null);

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [entries, setEntries] = useState([]);
  const [payFor, setPayFor] = useState('today'); // 'today' = pay for today's goods first, 'old' = all money to old baaki
  const [choice, setChoice] = useState(''); // customer id or "new"
  const [picking, setPicking] = useState(false);
  const [newName, setNewName] = useState('');
  const [allCustomers, setAllCustomers] = useState(null);
  const [usedVoice, setUsedVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceAsk, setVoiceAsk] = useState(false);

  useEffect(() => () => recRef.current?.abort?.(), []);

  const needList = result && (!result.customer.id || picking);
  useEffect(() => {
    if (needList && !allCustomers) {
      api('/customers').then((d) => setAllCustomers(d.customers)).catch(() => setAllCustomers([]));
    }
  }, [needList, allCustomers]);

  const parse = async (e) => {
    e?.preventDefault();
    if (!text.trim()) {
      setError('Type or say an entry first, like "Ramesh ne 250 ka atta liya".');
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await api('/ai/parse', { method: 'POST', body: { text } });
      setResult(r);
      setPicking(false);
      setPayFor('today');
      setEntries(r.entries.length ? r.entries.map((x) => ({ ...x })) : [{ type: 'udhaar', amount: '', items: '', sure: false }]);
      if (r.customer.id) setChoice(r.customer.id);
      else if (r.customer.candidates.length) setChoice('');
      else setChoice(r.customer.name ? 'new' : '');
      setNewName(r.customer.name || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startVoice = () => {
    const Rec = getRecognition();
    if (!Rec) return;
    let ok = false;
    try {
      ok = window.sessionStorage.getItem(VOICE_OK) === '1';
    } catch {
      ok = false;
    }
    if (!ok) {
      setVoiceAsk(true);
      return;
    }
    const rec = new Rec();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const said = [...ev.results].map((r) => r[0].transcript).join(' ');
      setText(said);
      setUsedVoice(true);
    };
    rec.onerror = () => {
      setListening(false);
      setError('Could not hear clearly. Please try again or type the entry.');
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const stopVoice = () => {
    recRef.current?.stop();
    setListening(false);
  };

  const updateEntry = (i, patch) => setEntries((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    setError('');
    let customerPart;
    if (choice === 'new') {
      if (!newName.trim()) return setError('Enter the new customer\'s name.');
      customerPart = { newCustomerName: newName.trim() };
    } else if (choice) {
      customerPart = { customerId: choice };
    } else return setError('Choose which customer this is for.');
    const clean = entries.filter((x) => String(x.amount).trim() !== '');
    if (!clean.length) return setError('Add at least one amount.');
    if (clean.some((x) => !(Number(x.amount) > 0))) return setError('Every amount must be more than ₹0.');
    setBusy(true);
    try {
      await api('/entries/bulk', {
        method: 'POST',
        body: {
          entries: clean.map((x) => ({
            ...customerPart,
            type: x.type,
            amount: Number(x.amount),
            items: x.items || '',
            source: usedVoice ? 'voice' : 'manual',
          })),
        },
      });
      toast(`${clean.length} entr${clean.length === 1 ? 'y' : 'ies'} saved`);
      notifyChanged();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const voiceSupported = Boolean(getRecognition()) && !window.__UK_DEMO__;
  const aiNote = !meta?.ai?.enabled
    ? 'Entries are read on our own server. Nothing is sent to an AI service.'
    : meta.ai.tier === 'free'
      ? 'If an entry is unclear, it may be sent to Google Gemini (free tier) with known customer names hidden first. Please use sample names in this demo.'
      : 'If an entry is unclear, it may be sent to Google Gemini with known customer names hidden first.';

  const go = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <Dialog title="Bolo, likho: add an entry" labelHidden onClose={onClose} initialFocus={inputRef}>
      <div className="center">
        <Mark size={48} className={busy ? 'swinging' : ''} />
      </div>
      <p className="command-title" aria-hidden="true">
        Bolo, kya likhna hai?
      </p>
      <form onSubmit={parse} noValidate>
        <label htmlFor="command-input" className="sr-only">
          Entry, for example: Ramesh ne 250 ka atta liya
        </label>
        <div className="command-bar">
          <input
            id="command-input"
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            placeholder={presetCustomer ? `${presetCustomer} ne 250 ka atta liya` : 'Ramesh ne 250 ka atta liya, 500 de diye'}
            maxLength={500}
            autoComplete="off"
            aria-describedby="command-note"
          />
          {voiceSupported &&
            (listening ? (
              <button type="button" className="icon-btn listening" onClick={stopVoice} aria-label="Stop listening">
                <IconPlayerStopFilled size={20} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="icon-btn" onClick={startVoice} aria-label="Speak the entry">
                <IconMicrophone size={22} aria-hidden="true" />
              </button>
            ))}
          <button type="submit" className="icon-btn solid" aria-label="Read entry" disabled={busy}>
            <IconArrowRight size={20} aria-hidden="true" />
          </button>
        </div>
      </form>
      <p id="command-note" className="small muted center" style={{ marginTop: 8 }}>
        {aiNote}
      </p>

      {voiceAsk && (
        <div className="notice" role="alert" style={{ marginTop: 10 }}>
          <p className="small">
            Voice typing uses your browser&apos;s speech service. In Chrome, your voice is sent to Google to turn it into text. We
            never record or store audio.
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => {
                try {
                  window.sessionStorage.setItem(VOICE_OK, '1');
                } catch {
                  /* ignore */
                }
                setVoiceAsk(false);
                setTimeout(startVoice, 0);
              }}
            >
              Use voice
            </button>
            <button type="button" className="btn btn-small" onClick={() => setVoiceAsk(false)}>
              I&apos;ll type instead
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="form-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      {!result && (
        <>
          <div className="suggestions" aria-label="Examples">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="chip chip-dashed"
                onClick={() => {
                  setText(ex);
                  inputRef.current?.focus();
                }}
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="suggestions">
            <button type="button" className="btn btn-small" onClick={() => go('/app/scan')}>Scan a khata page</button>
            <button type="button" className="btn btn-small" onClick={() => go('/app/grahak?filter=overdue')}>Old baaki (30+ days)</button>
            <button type="button" className="btn btn-small" onClick={() => go('/app/yaad')}>Send reminders</button>
          </div>
        </>
      )}

      {result && (
        <section className="understood" aria-labelledby="understood-title">
          <h3 id="understood-title" className="small muted" style={{ fontFamily: 'var(--font-body)' }}>
            Here&apos;s what I understood{result.engine === 'gemini' ? ' (with help from Gemini)' : ''}. Check it, then save.
          </h3>
          {result.note && <p className="small muted">{result.note}</p>}
          {result.spot && (
            <div className="spot-note" role="group" aria-labelledby="payfor-label">
              <p id="payfor-label" style={{ margin: '0 0 6px', fontWeight: 500 }}>
                What was the {rupees(result.spot.paidNow + result.spot.toOldBaaki)} payment for?
              </p>
              <div className="segmented" style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  aria-pressed={payFor === 'today'}
                  onClick={() => {
                    setPayFor('today');
                    setEntries(result.entries.map((x) => ({ ...x })));
                  }}
                >
                  Today&apos;s goods
                </button>
                <button
                  type="button"
                  aria-pressed={payFor === 'old'}
                  onClick={() => {
                    setPayFor('old');
                    setEntries(result.rawEntries.map((x) => ({ ...x })));
                  }}
                >
                  Old baaki
                </button>
              </div>
              <p className="small" style={{ margin: 0 }}>
                {payFor === 'today'
                  ? `${rupees(result.spot.paidNow)} paid for today's goods on the spot (nakad).${
                      result.spot.toOldBaaki ? ` ${rupees(result.spot.toOldBaaki)} extra goes to old baaki.` : ''
                    }${result.spot.newUdhaar ? ` ${rupees(result.spot.newUdhaar)} of today's goods goes on udhaar.` : ''}${
                      result.customer.balance > 0 && !result.spot.toOldBaaki
                        ? ` Old baaki of ${rupees(result.customer.balance)} stays pending.`
                        : ''
                    }`
                  : `Today's goods go on udhaar, and the whole payment clears the oldest baaki first.`}
              </p>
            </div>
          )}

          <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
            <legend style={{ fontWeight: 500, marginBottom: 6 }}>Customer</legend>
            {result.customer.id && !picking && (
              <div className="row">
                <span className="chip chip-pink">{result.customer.name}</span>
                {result.customer.balance > 0 && <span className="chip chip-due">Old baaki {rupees(result.customer.balance)}</span>}
                <button type="button" className="btn-link small" onClick={() => {
                    setPicking(true);
                    setChoice('');
                  }}>
                  Not them? Choose someone else
                </button>
              </div>
            )}
            {(!result.customer.id || picking) && (
              <div className="stack">
                {result.customer.candidates.length > 0 && (
                  <p className="small" style={{ margin: 0 }}>
                    &ldquo;{result.customer.name}&rdquo; could be more than one person. Please pick:
                  </p>
                )}
                <select className="select" value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Choose customer">
                  <option value="">Choose a customer…</option>
                  {result.customer.candidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} (balance {rupees(c.balance)})</option>
                  ))}
                  {(allCustomers || [])
                    .filter((c) => !result.customer.candidates.some((x) => x.id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  <option value="new">+ New customer</option>
                </select>
                {choice === 'new' && (
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="new-customer-name">New customer name</label>
                    <input id="new-customer-name" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
                    <span className="hint">Only add people who are happy for you to keep their name in your khata.</span>
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 500, marginBottom: 6 }}>Entries</legend>
            {entries.map((x, i) => (
              <div key={i} className={`review-item ${x.sure === false ? 'needs-check' : ''}`} style={{ marginBottom: 10 }}>
                {x.sure === false && <p className="small" style={{ color: 'var(--sonic-dark)', margin: '0 0 8px' }}>Please check this one.</p>}
                <div className="grid grid-typed">
                  <div>
                    <span className="label small" id={`type-${i}`}>Type</span>
                    <div className="segmented" role="group" aria-labelledby={`type-${i}`}>
                      <button type="button" aria-pressed={x.type === 'udhaar'} onClick={() => updateEntry(i, { type: 'udhaar', sure: true })}>Udhaar</button>
                      <button type="button" aria-pressed={x.type === 'jama'} onClick={() => updateEntry(i, { type: 'jama', sure: true })}>Jama</button>
                      <button type="button" aria-pressed={x.type === 'nakad'} onClick={() => updateEntry(i, { type: 'nakad', sure: true })}>Nakad</button>
                    </div>
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor={`amt-${i}`} className="small">Amount (₹)</label>
                    <input id={`amt-${i}`} className="input" inputMode="decimal" value={x.amount} onChange={(e) => updateEntry(i, { amount: e.target.value })} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor={`items-${i}`} className="small">Items (optional)</label>
                    <input id={`items-${i}`} className="input" value={x.items} maxLength={120} onChange={(e) => updateEntry(i, { items: e.target.value })} />
                  </div>
                </div>
                {entries.length > 1 && (
                  <button type="button" className="btn btn-small btn-danger" style={{ marginTop: 8 }} onClick={() => setEntries((l) => l.filter((_, j) => j !== i))}>
                    <IconTrash size={16} aria-hidden="true" /> Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-small" onClick={() => setEntries((l) => [...l, { type: 'udhaar', amount: '', items: '', sure: true }])}>
              <IconPlus size={16} aria-hidden="true" /> Add another line
            </button>
          </fieldset>

          <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setResult(null)}>Change text</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
              Sahi hai, save karo
            </button>
          </div>
        </section>
      )}
    </Dialog>
  );
}
