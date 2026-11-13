import { useState } from 'react';
import { Link } from 'react-router';
import Loading from '../components/Loading.jsx';
import { useFetch } from '../lib/useFetch.js';
import { usePage } from '../lib/usePage.js';
import { rupees, shortDate } from '../lib/format.js';
import { useReloadOnChange } from './Galla.jsx';

const PERIODS = [
  [7, '7 days'],
  [30, '30 days'],
  [90, '90 days'],
  [180, '6 months'],
];

function monthLabel(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
}

function Chart({ series }) {
  const max = Math.max(1, ...series.flatMap((s) => [s.udhaar, s.jama]));
  return (
    <figure style={{ margin: 0 }}>
      <div className="bars" aria-hidden="true">
        {series.map((s) => (
          <div className="bar-group" key={s.month}>
            <div className="bar u" style={{ height: `${(s.udhaar / max) * 100}%` }} title={`Udhaar ${rupees(s.udhaar)}`} />
            <div className="bar j" style={{ height: `${(s.jama / max) * 100}%` }} title={`Collected ${rupees(s.jama)}`} />
          </div>
        ))}
      </div>
      <div className="bar-labels" aria-hidden="true">
        {series.map((s) => <span key={s.month}>{monthLabel(s.month)}</span>)}
      </div>
      <div className="legend" aria-hidden="true">
        <span className="u">Udhaar given</span>
        <span className="j">Collected</span>
      </div>
      <figcaption className="sr-only">Udhaar given and money collected for each of the last 6 months. The same numbers are in the table below.</figcaption>
      <table className="sr-only">
        <caption>Monthly udhaar and collections</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Udhaar given</th><th scope="col">Collected</th></tr></thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.month}><th scope="row">{monthLabel(s.month)}</th><td>{rupees(s.udhaar)}</td><td>{rupees(s.jama)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export default function Reports() {
  usePage('Hisaab');
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useFetch(`/reports?days=${days}`);
  useReloadOnChange(reload);

  return (
    <>
      <div className="row-between">
        <h1>Hisaab</h1>
        <div className="filter-chips" role="group" aria-label="Period">
          {PERIODS.map(([v, label]) => (
            <button key={v} type="button" aria-pressed={days === v} onClick={() => setDays(v)}>{label}</button>
          ))}
        </div>
      </div>
      {loading && !data && <Loading />}
      {error && <p className="form-error" role="alert">{error.message}</p>}
      {data && (
        <>
          <section className="stats" aria-label={`Totals for the last ${data.days} days`} style={{ marginTop: 12 }}>
            <div className="stat"><p className="label">Udhaar given</p><p className="value">{rupees(data.udhaarGiven)}</p></div>
            <div className="stat"><p className="label">Collected towards khata</p><p className="value money-paid">{rupees(data.collected)}</p></div>
            <div className="stat"><p className="label">Nakad (paid on the spot)</p><p className="value">{rupees(data.cashSales)}</p></div>
            <div className="stat">
              <p className="label">Collected vs udhaar given</p>
              <p className="value">{data.collectionRate === null ? '—' : `${data.collectionRate}%`}</p>
            </div>
            <div className="stat"><p className="label">Total baaki today</p><p className="value money-due">{rupees(data.outstanding)}</p></div>
          </section>

          <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
            <section className="card" aria-labelledby="chart-title">
              <h2 id="chart-title">Last 6 months</h2>
              <Chart series={data.series} />
            </section>
            <section className="card card-pink" aria-labelledby="insight-title">
              <h2 id="insight-title">What your khata shows</h2>
              {data.insights.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Add some entries to see a summary here.</p>
              ) : (
                <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
                  {data.insights.map((t) => <li key={t}>{t}</li>)}
                </ul>
              )}
              <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>Worked out directly from your entries. No guesses.</p>
            </section>
          </div>

          <section className="card" style={{ marginTop: 16 }} aria-labelledby="oldest-title">
            <h2 id="oldest-title">Oldest unpaid udhaar</h2>
            {data.oldestPending.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Nobody owes you anything.</p>
            ) : (
              <div className="table-scroll">
                <table className="ruled">
                  <thead>
                    <tr>
                      <th scope="col">Customer</th>
                      <th scope="col" className="num">Baaki</th>
                      <th scope="col" className="num">Oldest unpaid udhaar</th>
                      <th scope="col" className="num">Last khata payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.oldestPending.map((c) => (
                      <tr key={c.id}>
                        <td><Link to={`/app/grahak/${c.id}`}>{c.name}</Link></td>
                        <td className="num"><span className="money money-due" style={{ marginLeft: 'auto' }}>{rupees(c.balance)}</span></td>
                        <td className="num">{c.daysPending} days ago</td>
                        <td className="num">{c.lastPaymentAt ? shortDate(c.lastPaymentAt) : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
