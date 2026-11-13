import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { IconCamera, IconSun, IconFile, IconAlignLeft, IconTrash } from '@tabler/icons-react';
import { Mark } from '../components/Logo.jsx';
import { notifyChanged } from '../components/CommandSheet.jsx';
import { api } from '../lib/api.js';
import { useMeta, useToast } from '../lib/context.jsx';
import { usePage } from '../lib/usePage.js';
import { shrinkImage } from '../lib/shrinkImage.js';
import { rupees } from '../lib/format.js';

const MAX_ORIGINAL = 50 * 1024 * 1024; // before shrinking


function ReviewCard({ item, index, customers, onChange, onRemove }) {
  const c = item.customer;
  const options = [...c.candidates, ...customers.filter((x) => !c.candidates.some((k) => k.id === x.id))];
  return (
    <article className={`review-item ${item.needsCheck ? 'needs-check' : ''}`} aria-labelledby={`line-${index}`}>
      <div className="row-between">
        <h2 id={`line-${index}`} style={{ margin: 0, fontSize: "1.05rem" }}>Line {item.line}</h2>
        {item.needsCheck ? <span className="chip chip-pink">Please check</span> : <span className="chip chip-paid">Looks right</span>}
      </div>
      {c.candidates.length > 0 && !item.customerId && (
        <p className="small" style={{ color: 'var(--sonic-dark)', margin: '6px 0 0' }}>
          &ldquo;{c.name}&rdquo; could be {c.candidates.map((k) => k.name).join(' or ')}. Please choose.
        </p>
      )}
      <div className="grid" style={{ marginTop: 10 }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`cust-${index}`} className="small">Customer</label>
          <select id={`cust-${index}`} className="select" value={item.customerId || (item.isNew ? 'new' : '')} onChange={(e) => onChange({ customerId: e.target.value === 'new' ? '' : e.target.value, isNew: e.target.value === 'new' })}>
            <option value="">Choose…</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            <option value="new">+ New customer</option>
          </select>
        </div>
        {item.isNew && (
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor={`newname-${index}`} className="small">New customer name</label>
            <input id={`newname-${index}`} className="input" maxLength={60} value={item.newName} onChange={(e) => onChange({ newName: e.target.value })} />
          </div>
        )}
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`amt-${index}`} className="small">Amount (₹)</label>
          <input id={`amt-${index}`} className="input" inputMode="decimal" value={item.amount} onChange={(e) => onChange({ amount: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`items-${index}`} className="small">Items</label>
          <input id={`items-${index}`} className="input" maxLength={120} value={item.items} onChange={(e) => onChange({ items: e.target.value })} />
        </div>
      </div>
      <div className="row-between" style={{ marginTop: 10 }}>
        <div className="segmented" role="group" aria-label={`Line ${item.line} type`}>
          <button type="button" aria-pressed={item.type === 'udhaar'} onClick={() => onChange({ type: 'udhaar' })}>Udhaar</button>
          <button type="button" aria-pressed={item.type === 'jama'} onClick={() => onChange({ type: 'jama' })}>Jama</button>
          <button type="button" aria-pressed={item.type === 'nakad'} onClick={() => onChange({ type: 'nakad' })}>Nakad</button>
        </div>
        <button type="button" className="btn btn-small btn-danger" onClick={onRemove}>
          <IconTrash size={16} aria-hidden="true" /> Remove line
        </button>
      </div>
    </article>
  );
}

export default function Scan() {
  usePage('Scan khata page');
  const meta = useMeta();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [sampleOnly, setSampleOnly] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState(null);
  const [customers, setCustomers] = useState([]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const aiEnabled = meta?.ai?.enabled;
  const freeTier = meta?.ai?.tier === 'free';

  const [preparing, setPreparing] = useState(false);

  const pick = async (f) => {
    setError('');
    if (!f) return;
    if (f.type && !f.type.startsWith('image/')) return setError('Please choose a photo (JPG, PNG, WEBP or HEIC).');
    if (f.size > MAX_ORIGINAL) return setError('That file is too large. Please take a normal camera photo.');
    setPreparing(true);
    try {
      const small = await shrinkImage(f);
      if (!small) return setError('This photo could not be opened here. Please try a JPG, or take the photo again with the camera.');
      setFile(small);
      setPreview(URL.createObjectURL(small));
    } finally {
      setPreparing(false);
    }
  };

  const read = async () => {
    if (!file) return setError('Choose a photo first.');
    if (freeTier && !sampleOnly) return setError('Please confirm the page has only sample data.');
    setBusy(true);
    setError('');
    const form = new FormData();
    form.append('sampleDataOnly', String(sampleOnly));
    form.append('photo', file);
    try {
      const [scan, list] = await Promise.all([api('/ai/scan', { method: 'POST', form }), api('/customers')]);
      setCustomers(list.customers);
      setItems(
        scan.entries.map((e) => ({
          ...e,
          customerId: e.customer.id || '',
          isNew: !e.customer.id && e.customer.isNew,
          newName: e.customer.name || '',
        }))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => {
    const t = { udhaar: 0, jama: 0, nakad: 0 };
    (items || []).forEach((i) => {
      const n = Number(i.amount);
      if (n > 0) t[i.type] += n;
    });
    return t;
  }, [items]);

  const save = async () => {
    setError('');
    for (const [i, it] of items.entries()) {
      if (!it.customerId && !(it.isNew && it.newName.trim())) return setError(`Line ${items[i].line}: choose a customer.`);
      if (!(Number(it.amount) > 0)) return setError(`Line ${items[i].line}: enter an amount.`);
    }
    setBusy(true);
    try {
      await api('/entries/bulk', {
        method: 'POST',
        body: {
          entries: items.map((it) => ({
            ...(it.customerId ? { customerId: it.customerId } : { newCustomerName: it.newName.trim() }),
            type: it.type,
            amount: Number(it.amount),
            items: it.items,
            source: 'scan',
          })),
        },
      });
      toast(`${items.length} entries saved`);
      notifyChanged();
      navigate('/app');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (items) {
    return (
      <>
        <h1>Review what the AI found</h1>
        <p className="muted">Check every line against your photo. Nothing is saved until you press <strong>Confirm and save</strong>.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="review-grid">
          <div>
            <img src={preview} alt="The khata page photo you uploaded" className="review-img" />
            <p className="small muted">This photo stays on your device. It was sent once to be read and was not stored.</p>
          </div>
          <div className="stack">
            <p style={{ margin: 0, fontWeight: 500 }}>
              AI found {items.length} {items.length === 1 ? 'entry' : 'entries'}
              {items.some((i) => i.needsCheck) ? `, ${items.filter((i) => i.needsCheck).length} need checking` : ''}.
            </p>
            {items.length === 0 && (
              <p className="muted">
                No entries could be read. Try a clearer photo, or <Link to="/app">add entries by typing</Link>.
              </p>
            )}
            {items.map((it, i) => (
              <ReviewCard
                key={it.line}
                item={it}
                index={i}
                customers={customers}
                onChange={(patch) => setItems((l) => l.map((x, j) => (j === i ? { ...x, ...patch, needsCheck: false } : x)))}
                onRemove={() => setItems((l) => l.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        </div>
        <div className="sticky-bar" role="region" aria-label="Save scanned entries">
          <span className="small">
            {items.length} entries · {rupees(totals.udhaar)} udhaar · {rupees(totals.jama)} jama{totals.nakad ? ` · ${rupees(totals.nakad)} nakad` : ''}
          </span>
          <div className="row">
            <button type="button" className="btn btn-small" onClick={() => setItems(null)}>Discard</button>
            <button type="button" className="btn btn-small btn-primary" onClick={save} disabled={busy || items.length === 0}>
              Confirm and save
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Scan your khata page</h1>
      <p className="muted">Take a clear photo of one notebook page. AI will list the entries for you to check.</p>

      {!aiEnabled && meta && (
        <div className="notice" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0 }}>
            Scanning is switched off on this server because no AI key is set up. You can still add entries by typing or speaking
            with the pink <strong>Likho</strong> button.
          </p>
        </div>
      )}
      {aiEnabled && (
        <div className="notice notice-warn" style={{ marginBottom: 16 }}>
          <p className="small" style={{ margin: 0 }}>
            The photo is sent once to Google Gemini to read the handwriting and is not stored by Khata.io.
            {freeTier &&
              ' This demo uses Gemini\'s free tier, where Google may use uploads to improve its products and people may review them. Only scan pages with made-up sample data.'}
          </p>
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="dropzone">
        {preview ? (
          <img src={preview} alt="Preview of the khata page you chose" style={{ maxHeight: 320, borderRadius: 12 }} />
        ) : (
          <>
            <IconCamera size={40} aria-hidden="true" style={{ color: 'var(--sonic-dark)' }} />
            <p className="hand" style={{ fontSize: '1.3rem', margin: '6px 0' }}>Khata page ki photo lo</p>
          </>
        )}
        <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={!aiEnabled || preparing}>
            {preparing ? 'Preparing photo…' : preview ? 'Choose another photo' : 'Take or choose a photo'}
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="image/*"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Any phone photo. It is made smaller on your phone before it is sent.</p>
      </div>

      {aiEnabled && freeTier && (
        <div className="check" style={{ marginTop: 14 }}>
          <input id="sample-only" type="checkbox" checked={sampleOnly} onChange={(e) => setSampleOnly(e.target.checked)} />
          <label htmlFor="sample-only">This page has only made-up sample data, not real customers&apos; details.</label>
        </div>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-primary" onClick={read} disabled={!aiEnabled || busy || preparing || !file}>
          {busy ? 'Reading…' : 'Read this page'}
        </button>
        {busy && (
          <span className="row small muted" role="status">
            <Mark size={30} className="swinging" /> Reading your handwriting…
          </span>
        )}
      </div>

      <ul className="grid-2" style={{ listStyle: 'none', padding: 0, marginTop: 22 }} aria-label="Tips for a good photo">
        <li className="feature row"><IconSun size={22} aria-hidden="true" /> Good light, no shadow</li>
        <li className="feature row"><IconFile size={22} aria-hidden="true" /> One page at a time</li>
        <li className="feature row"><IconAlignLeft size={22} aria-hidden="true" /> Keep the lines straight</li>
      </ul>
    </>
  );
}
