import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { IconUserPlus, IconSearch } from '@tabler/icons-react';
import Loading from '../components/Loading.jsx';
import Dialog from '../components/Dialog.jsx';
import { Balance } from '../components/Money.jsx';
import { useFetch } from '../lib/useFetch.js';
import { usePage } from '../lib/usePage.js';
import { api } from '../lib/api.js';
import { useToast } from '../lib/context.jsx';
import { initials } from '../lib/format.js';
import { useReloadOnChange } from './Galla.jsx';

const FILTERS = [
  ['all', 'All'],
  ['due', 'Has baaki'],
  ['overdue', 'No entry for 30+ days'],
  ['cleared', 'Cleared'],
];

export function CustomerForm({ initial = { name: '', phone: '' }, onSubmit, submitLabel, busy }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError({ field: 'name', message: 'Enter a name.' });
    setError(null);
    try {
      await onSubmit({ name: form.name.trim(), phone: form.phone.trim() });
    } catch (err) {
      setError({ field: err.field, message: err.message });
    }
  };
  return (
    <form onSubmit={submit} noValidate>
      {error && !error.field && <p className="form-error" role="alert">{error.message}</p>}
      <div className="field">
        <label htmlFor="cust-name">Name</label>
        <input id="cust-name" className="input" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={error?.field === 'name' ? 'true' : undefined} aria-describedby={error?.field === 'name' ? 'cust-name-error' : undefined} />
        {error?.field === 'name' && <span id="cust-name-error" className="error">{error.message}</span>}
      </div>
      <div className="field">
        <label htmlFor="cust-phone">Mobile number (optional)</label>
        <input id="cust-phone" className="input" inputMode="tel" autoComplete="off" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-invalid={error?.field === 'phone' ? 'true' : undefined} aria-describedby="cust-phone-hint" />
        <span id="cust-phone-hint" className="hint">
          Only used to open WhatsApp when you send a reminder. Add it only if the customer agrees.
          {error?.field === 'phone' && <span className="error"> {error.message}</span>}
        </span>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{submitLabel}</button>
    </form>
  );
}

export default function Customers() {
  usePage('Grahak');
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.some(([v]) => v === params.get('filter')) ? params.get('filter') : 'all';
  const [query, setQuery] = useState('');
  const { data, error, loading, reload } = useFetch(`/customers?filter=${filter}`);
  useReloadOnChange(reload);
  const [adding, setAdding] = useState(params.get('new') === '1');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (params.get('new') === '1') setAdding(true);
  }, [params]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.customers || []).filter((c) => !q || c.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [data, query]);

  const groups = useMemo(() => {
    const g = new Map();
    shown.forEach((c) => {
      const letter = c.name[0].toUpperCase();
      if (!g.has(letter)) g.set(letter, []);
      g.get(letter).push(c);
    });
    return [...g.entries()];
  }, [shown]);

  const add = async (form) => {
    setBusy(true);
    try {
      const { customer } = await api('/customers', { method: 'POST', body: form });
      toast(`${customer.name} added`);
      setAdding(false);
      navigate(`/app/grahak/${customer.id}`);
    } finally {
      setBusy(false);
    }
  };

  const closeAdd = () => {
    setAdding(false);
    if (params.get('new')) {
      params.delete('new');
      setParams(params, { replace: true });
    }
  };

  return (
    <>
      <div className="row-between">
        <h1>Grahak {data && <span className="muted small">({data.customers.length})</span>}</h1>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          <IconUserPlus size={18} aria-hidden="true" /> Add customer
        </button>
      </div>

      <div className="book" style={{ marginTop: 12 }}>
        <div className="book-pages" style={{ gridTemplateColumns: '1fr' }}>
          <div className="book-page">
            <div className="field" style={{ position: 'relative' }}>
              <label htmlFor="search" className="sr-only">Search customers by name</label>
              <IconSearch size={18} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 13, color: 'var(--sonic-dark)' }} />
              <input id="search" className="input" style={{ paddingLeft: 38, borderRadius: 999 }} placeholder="Naam dhoondo" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="filter-chips" role="group" aria-label="Filter customers">
              {FILTERS.map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={filter === v}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    if (v === 'all') next.delete('filter');
                    else next.set('filter', v);
                    setParams(next, { replace: true });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading && !data && <Loading />}
            {error && <p className="form-error" role="alert">{error.message}</p>}
            {data && shown.length === 0 && (
              <div className="empty">
                <p className="hand" style={{ fontSize: '1.4rem', margin: 0 }}>Koi grahak nahi mila</p>
                <p className="muted">{query ? 'Try a different name.' : 'Add your first customer to start the khata.'}</p>
              </div>
            )}
            {groups.map(([letter, list]) => (
              <section key={letter} aria-label={`Customers starting with ${letter}`}>
                <p className="index-letter" aria-hidden="true">{letter}</p>
                <ul className="index-list">
                  {list.map((c) => (
                    <li key={c.id}>
                      <Link to={`/app/grahak/${c.id}`}>
                        <span className="avatar" aria-hidden="true">{initials(c.name)}</span>
                        <span>
                          <span className="nm">{c.name}</span>
                          {c.status === 'overdue' && <span className="chip chip-due" style={{ marginLeft: 8 }}>30+ days</span>}
                        </span>
                        <Balance value={c.balance} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>

      {adding && (
        <Dialog title="Add a customer" onClose={closeAdd}>
          <CustomerForm onSubmit={add} submitLabel="Add customer" busy={busy} />
        </Dialog>
      )}
    </>
  );
}
