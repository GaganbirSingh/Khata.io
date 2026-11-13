import { Link } from 'react-router';
import { usePage } from '../lib/usePage.js';

export default function NotFound() {
  usePage('Page not found');
  return (
    <div className="container sheet empty" style={{ maxWidth: 560 }}>
      <h1>This page is not in the khata</h1>
      <p className="muted">The link may be old or mistyped.</p>
      <Link to="/" className="btn btn-primary">Go to home page</Link>
    </div>
  );
}
