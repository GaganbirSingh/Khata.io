import { Link } from 'react-router';
import Logo from './Logo.jsx';

export default function Seal({ to = '/', size = 40, stacked = true }) {
  return (
    <Link to={to} className="seal" aria-label="Khata.io home">
      <Logo size={size} stacked={stacked} />
    </Link>
  );
}
