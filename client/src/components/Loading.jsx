import { Mark } from './Logo.jsx';

// The parchi swings on its peg while something loads.
export default function Loading({ label = 'Loading' }) {
  return (
    <div className="loading" role="status">
      <Mark size={52} className="swinging" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
