import { rupees } from '../lib/format.js';

// Money is never shown by colour alone: a word (baaki / jama / nakad / clear)
// or a sign always goes with it, so colour-blind users and screen readers get
// the meaning. Owed money gets the lemon highlighter.
export function Balance({ value, hand = false, className = '' }) {
  const v = Number(value) || 0;
  const cls = `money ${hand ? 'hand' : ''} ${className}`;
  if (v > 0) return <span className={`${cls} money-due`}>{rupees(v)} baaki</span>;
  if (v < 0) return <span className={`${cls} money-paid`}>{rupees(v)} advance</span>;
  return <span className={`${cls} money-paid`}>Clear</span>;
}

export function EntryAmount({ type, amount, hand = false, highlight = true }) {
  const h = hand ? 'hand' : '';
  if (type === 'nakad') {
    return (
      <span className={`money money-cash ${h}`}>
        {rupees(amount)}
        <span className="sr-only"> paid on the spot</span>
      </span>
    );
  }
  if (type === 'udhaar') {
    return (
      <span className={`money ${h} ${highlight ? 'money-due' : 'money-cash'}`}>
        +{rupees(amount)}
        <span className="sr-only"> udhaar given</span>
      </span>
    );
  }
  return (
    <span className={`money money-paid ${h}`}>
      −{rupees(amount)}
      <span className="sr-only"> paid towards khata</span>
    </span>
  );
}

export const TYPE_LABELS = {
  udhaar: 'Udhaar',
  jama: 'Jama',
  nakad: 'Nakad',
};

export const TYPE_HELP = {
  udhaar: 'Goods or money given on credit. Adds to baaki.',
  jama: 'Money paid towards old baaki. Clears the oldest udhaar first.',
  nakad: 'Goods paid for on the spot. Old baaki stays as it is.',
};
