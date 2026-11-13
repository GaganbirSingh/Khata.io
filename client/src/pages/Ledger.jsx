import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { IconArrowLeft, IconBell, IconEdit, IconTrash } from '@tabler/icons-react';
import { Mark } from '../components/Logo.jsx';
import Loading from '../components/Loading.jsx';
import Dialog from '../components/Dialog.jsx';
import { Balance, EntryAmount, TYPE_HELP } from '../components/Money.jsx';
import { notifyChanged } from '../components/CommandSheet.jsx';
import { useFetch } from '../lib/useFetch.js';
import { usePage } from '../lib/usePage.js';
import { api } from '../lib/api.js';
import { useToast } from '../lib/context.jsx';
import { initials, rupees, shortDate } from '../lib/format.js';
import { CustomerForm } from './Customers.jsx';
import { useReloadOnChange } from './Galla.jsx';

const SOURCE_TAG = { scan: ['Scanned', 'tag-scan'], voice: ['Spoken', 'tag-voice'], payment: ['Online', 'tag-pay'] };

function AddEntry({ customerId, onSaved }) {
  const [type, setType] = useState('udhaar');
  const [amount, setAmount] = useState('');
  const [items, setItems] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(amount) > 0)) return setError('Enter an amount more than ₹0.');
    setBusy(true);
    setError('');
    try {
      await api('/entries', { method: 'POST', body: { customerId, type, amount: Number(amount), items } });
      toast(type === 'udhaar' ? 'Udhaar added' : type === 'jama' ? 'Khata payment added' : 'Nakad sale added');
      setAmount('');
      setItems('');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={{ marginTop: 14 }} noValidate aria-labelledby="add-entry-title">
      <h2 id="add-entry-title">Entry likho</h2>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="segmented" role="group" aria-label="Entry type" aria-describedby="entry-type-help" style={{ marginBottom: 6 }}>
        <button type="button" aria-pressed={type === 'udhaar'} onClick={() => setType('udhaar')}>Udhaar</button>
        <button type="button" aria-pressed={type === 'jama'} onClick={() => setType('jama')}>Jama</button>
        <button type="button" aria-pressed={type === 'nakad'} onClick={() => setType('nakad')}>Nakad</button>
      </div>
      <p id="entry-type-help" className="small muted" style={{ marginBottom: 12 }}>{TYPE_HELP[type]}</p>
      <div className="field">
        <label htmlFor="entry-amount">Amount (₹)</label>
        <input id="entry-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="entry-items">Items (optional)</label>
        <input id="entry-items" className="input" maxLength={120} value={items} onChange={(e) => setItems(e.target.value)} placeholder="Atta, tel" />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>Save entry</button>
    </form>
  );
}

export default function Ledger() {
  const { id } = useParams();
  const { data, error, loading, reload } = useFetch(`/customers/${id}`);
  useReloadOnChange(reload);
  usePage(data ? `${data.customer.name}'s khata` : 'Khata');
  const toast = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    // Walk back from today's balance so the numbers are right even if only
    // the most recent entries were loaded.
    const desc = [...data.entries].sort((a, b) => new Date(b.date) - new Date(a.date));
    let bal = Math.round(data.customer.balance * 100);
    return desc.map((e) => {
      const row = { ...e, running: bal / 100 };
      const sign = e.type === 'udhaar' ? 1 : e.type === 'jama' ? -1 : 0; // nakad doesn't touch the khata
      bal -= Math.round(e.amount * 100) * sign;
      return row;
    });
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) {
    return (
      <div className="empty">
        <h1>Customer not found</h1>
        <Link to="/app/grahak" className="btn">Back to customers</Link>
      </div>
    );
  }
  const c = data.customer;

  const saveEdit = async (form) => {
    setBusy(true);
    try {
      await api(`/customers/${id}`, { method: 'PATCH', body: form });
      toast('Details updated');
      setEditing(false);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const removeCustomer = async () => {
    setBusy(true);
    try {
      await api(`/customers/${id}`, { method: 'DELETE' });
      toast(`${c.name} and their khata were deleted`);
      notifyChanged();
      navigate('/app/grahak');
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  const removeEntry = async () => {
    setBusy(true);
    try {
      await api(`/entries/${deleteEntry.id}`, { method: 'DELETE' });
      toast('Entry deleted');
      setDeleteEntry(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link to="/app/grahak" className="btn-link small"><IconArrowLeft size={16} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> All customers</Link>
      <div className="book" style={{ marginTop: 10 }}>
        <div className="book-pages">
          <div className="book-page">
            <div className="row">
              <span className="avatar" style={{ width: 52, height: 52, fontSize: '1.1rem' }} aria-hidden="true">{initials(c.name)}</span>
              <div>
                <h1 className="hand" style={{ fontFamily: 'var(--font-hand)', fontWeight: 700, fontSize: '2rem', margin: 0 }}>{c.name}</h1>
                <p className="small muted" style={{ margin: 0 }}>{c.phone ? `+91 ${c.phone}` : 'No phone number saved'}</p>
              </div>
            </div>
            <p style={{ fontSize: '1.9rem', margin: '12px 0 4px', fontWeight: 700 }}>
              <Balance value={c.balance} hand />
            </p>
            {c.balance > 0 && c.oldestDueAt && (
              <p className="small muted" style={{ marginBottom: 12 }}>Oldest unpaid udhaar from {shortDate(c.oldestDueAt)}</p>
            )}
            <div className="row">
              {c.balance > 0 && (
                <Link to={`/app/yaad?customer=${c.id}`} className="btn btn-primary btn-small">
                  <IconBell size={16} aria-hidden="true" /> Yaad dilao
                </Link>
              )}
              <button type="button" className="btn btn-small" onClick={() => setEditing(true)}><IconEdit size={16} aria-hidden="true" /> Edit</button>
              <button type="button" className="btn btn-small btn-danger" onClick={() => setConfirmDelete(true)}><IconTrash size={16} aria-hidden="true" /> Delete</button>
            </div>
            <AddEntry customerId={c.id} onSaved={reload} />
            {data.reminders.length > 0 && (
              <section style={{ marginTop: 16 }} aria-labelledby="rem-hist">
                <h2 id="rem-hist">Reminders sent</h2>
                <ul style={{ paddingLeft: '1.1rem', margin: 0 }} className="small">
                  {data.reminders.map((r) => (
                    <li key={r.id}>{shortDate(r.createdAt)}: reminder for {rupees(r.amount)} opened in WhatsApp</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <div className="book-spine" aria-hidden="true" />
          <div className="book-page right">
            <div className="table-scroll">
              <table className="ruled">
                <caption className="sr-only">All entries for {c.name}, newest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Details</th>
                    <th scope="col" className="num">Amount</th>
                    <th scope="col" className="num">Balance</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">No entries yet.</td>
                    </tr>
                  )}
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td className="small">{shortDate(e.date)}</td>
                      <td>
                        <span className="hand">{e.items || (e.type === 'jama' ? 'Khata payment' : e.type === 'nakad' ? 'Paid now' : 'Udhaar')}</span>
                        {e.type === 'nakad' && <span className="tag tag-cash">Nakad</span>}
                        {SOURCE_TAG[e.source] && <span className={`tag ${SOURCE_TAG[e.source][1]}`}>{SOURCE_TAG[e.source][0]}</span>}
                        {e.type === 'udhaar' && e.status === 'paid' && <span className="sub">Paid off</span>}
                        {e.type === 'udhaar' && e.status === 'part' && (
                          <span className="sub">{rupees(e.amount - e.paidAmount)} of {rupees(e.amount)} still baaki</span>
                        )}
                        {e.type === 'udhaar' && e.status === 'due' && <span className="sub">Baaki</span>}
                        {e.type === 'nakad' && <span className="sub">Paid on the spot, old baaki unchanged</span>}
                        {e.type === 'jama' && <span className="sub">Paid off the oldest udhaar first</span>}
                      </td>
                      <td className="num"><EntryAmount type={e.type} amount={e.amount} hand highlight={e.type !== 'udhaar' || e.status !== 'paid'} /></td>
                      <td className="num small">{rupees(e.running)}{e.running < 0 ? ' adv.' : ''}</td>
                      <td>
                        {e.source !== 'payment' && (
                          <button type="button" className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setDeleteEntry(e)} aria-label={`Delete entry from ${shortDate(e.date)}, ${rupees(e.amount)}`}>
                            <IconTrash size={16} aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rubber-stamp" aria-hidden="true">
              <Mark size={56} />
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <Dialog title={`Edit ${c.name}`} onClose={() => setEditing(false)}>
          <CustomerForm initial={{ name: c.name, phone: c.phone || '' }} onSubmit={saveEdit} submitLabel="Save changes" busy={busy} />
        </Dialog>
      )}
      {confirmDelete && (
        <Dialog title={`Delete ${c.name}?`} onClose={() => setConfirmDelete(false)}>
          <p>This permanently deletes {c.name} and all {data.entries.length} of their entries. It cannot be undone.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Keep</button>
            <button type="button" className="btn btn-danger-solid" onClick={removeCustomer} disabled={busy}>Delete customer</button>
          </div>
        </Dialog>
      )}
      {deleteEntry && (
        <Dialog title="Delete this entry?" onClose={() => setDeleteEntry(null)}>
          <p>
            {shortDate(deleteEntry.date)} · {deleteEntry.items || deleteEntry.type} · {rupees(deleteEntry.amount)}. The balance will be updated.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setDeleteEntry(null)}>Keep</button>
            <button type="button" className="btn btn-danger-solid" onClick={removeEntry} disabled={busy}>Delete entry</button>
          </div>
        </Dialog>
      )}
    </>
  );
}
