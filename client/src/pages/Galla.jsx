import { useEffect } from 'react';
import { Link } from 'react-router';
import { IconScan, IconUserPlus, IconPlus, IconBell } from '@tabler/icons-react';
import Loading from '../components/Loading.jsx';
import Dori from '../components/Dori.jsx';
import { Balance, EntryAmount } from '../components/Money.jsx';
import { useFetch } from '../lib/useFetch.js';
import { usePage } from '../lib/usePage.js';
import { rupees, timeAgo } from '../lib/format.js';

export function useReloadOnChange(reload) {
  useEffect(() => {
    window.addEventListener('khata:changed', reload);
    return () => window.removeEventListener('khata:changed', reload);
  }, [reload]);
}

function openCommand() {
  window.dispatchEvent(new Event('khata:open-command'));
}

const STAMP = { jama: ['Jama', ''], nakad: ['Nakad', 'cash'] };

export function EntryParchi({ e, to }) {
  const stamp = STAMP[e.type];
  const what = e.items || (e.type === 'jama' ? 'Khata payment' : e.type === 'nakad' ? 'Paid now' : 'Udhaar');
  const body = (
    <>
      <span className="pin" aria-hidden="true" />
      <p className="who">{e.customerName.split(' ')[0]}</p>
      <p className="what">{what}</p>
      <p className="amt">
        <EntryAmount type={e.type} amount={e.amount} />
      </p>
      <p className="when">
        {timeAgo(e.date)}
        {e.type === 'udhaar' && ' · baaki'}
        {e.type === 'nakad' && <span className="sr-only">, paid on the spot</span>}
        {e.type === 'jama' && <span className="sr-only">, paid towards khata</span>}
      </p>
      {stamp && (
        <span className={`stamp ${stamp[1]}`} aria-hidden="true">
          {stamp[0]}
        </span>
      )}
    </>
  );
  return to ? (
    <Link to={to} className="parchi">
      {body}
    </Link>
  ) : (
    <div className="parchi">{body}</div>
  );
}

export default function Galla() {
  usePage('Aaj ka galla');
  const { data, error, loading, reload } = useFetch('/dashboard');
  useReloadOnChange(reload);

  return (
    <>
      <div className="row-between galla-head">
        <div>
          <h1>Aaj ka galla</h1>
          {data && (
            <p className="total-line">
              <span className="money-paid">{rupees(data.today.received)} jama</span>
              <span>{rupees(data.today.cashSales)} nakad</span>
              <span className="money-due">{rupees(data.today.udhaarGiven)} udhaar diya</span>
            </p>
          )}
        </div>
        <div className="row">
          <Link to="/app/scan" className="btn btn-small"><IconScan size={18} aria-hidden="true" /> Scan khata</Link>
          <Link to="/app/grahak?new=1" className="btn btn-small"><IconUserPlus size={18} aria-hidden="true" /> New customer</Link>
        </div>
      </div>

      {loading && !data && <Loading />}
      {error && <p className="form-error" role="alert">{error.message}</p>}

      {data && (
        <>
          <Dori label="Haal ki parchiyan">
            <button type="button" className="parchi parchi-new" onClick={openCommand} key="new">
              <span className="pin" aria-hidden="true" />
              <IconPlus size={26} aria-hidden="true" />
              Naya parchi
            </button>
            {data.recent.map((e) => (
              <EntryParchi key={e.id} e={e} to={`/app/grahak/${e.customerId}`} />
            ))}
          </Dori>
          {data.recent.length === 0 && (
            <p className="muted">No entries yet. Tap <strong>Naya parchi</strong> or the yellow Likho button to add your first one.</p>
          )}

          {data.overdue.length > 0 && (
            <Dori label="Purana baaki · 30+ din">
              {data.overdue.map((c) => (
                <Link key={c.id} to={`/app/grahak/${c.id}`} className="parchi">
                  <span className="pin" aria-hidden="true" />
                  <p className="who">{c.name.split(' ')[0]}</p>
                  <p className="what">Oldest unpaid udhaar</p>
                  <p className="amt">
                    <span className="money money-due">{rupees(c.balance)}</span>
                  </p>
                  <p className="when">{c.daysPending} din se baaki</p>
                </Link>
              ))}
              <Link key="remind" to="/app/yaad" className="parchi parchi-note">
                <span className="pin" aria-hidden="true" />
                <IconBell size={22} aria-hidden="true" />
                <p className="who" style={{ fontSize: '1.1rem', marginTop: 6 }}>Yaad dilao</p>
                <p className="when">Send polite reminders</p>
              </Link>
            </Dori>
          )}

          <section className="stats" aria-label="Summary" style={{ marginTop: 22 }}>
            <div className="stat">
              <p className="label">Total baaki (all customers)</p>
              <p className="value money-due">{rupees(data.outstanding)}</p>
            </div>
            <div className="stat">
              <p className="label">Customers who owe</p>
              <p className="value">{data.customersWithDue}</p>
            </div>
            <div className="stat">
              <p className="label">All customers</p>
              <p className="value">{data.customerCount}</p>
            </div>
            <div className="stat">
              <p className="label">Entries today</p>
              <p className="value">{data.today.entries}</p>
            </div>
          </section>

          <section className="card" style={{ marginTop: 18 }} aria-labelledby="top-title">
            <div className="row-between">
              <h2 id="top-title">Sabse zyada baaki</h2>
              <Link to="/app/yaad" className="btn btn-small btn-primary">Send reminders</Link>
            </div>
            {data.topPending.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Nobody owes you anything right now.</p>
            ) : (
              <ul className="index-list">
                {data.topPending.map((c) => (
                  <li key={c.id}>
                    <Link to={`/app/grahak/${c.id}`}>
                      <span className="avatar" aria-hidden="true">{c.name.slice(0, 1)}</span>
                      <span className="nm">{c.name}</span>
                      <Balance value={c.balance} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
