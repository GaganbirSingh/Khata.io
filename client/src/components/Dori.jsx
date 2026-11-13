import { Children } from 'react';

// A string (dori) with parchis pegged on it. The string sags in the middle,
// so each parchi hangs a little lower towards the centre, like a real
// clothesline. Scrolls sideways when there are more parchis than fit.
const SAG = 34; // px the string drops at its middle
const TOP = 6;

export function sagAt(i, n) {
  const t = (i + 0.5) / Math.max(n, 1);
  return TOP + SAG * 4 * t * (1 - t) * 0.5;
}

const TILT = [-2, 1.5, -1, 2, -1.5, 1];

export default function Dori({ label, children, scrollLabel, preview = false }) {
  const items = Children.toArray(children);
  const n = items.length;
  return (
    <section className="dori-wrap" aria-label={preview ? undefined : label}>
      <p className="dori-tag" aria-hidden="true">{label}</p>
      <div
        className="dori"
        tabIndex={preview ? undefined : 0}
        role={preview ? undefined : 'region'}
        aria-label={preview ? undefined : scrollLabel || `${label}, scroll sideways for more`}
      >
        <div className="dori-inner">
          <svg className="dori-string" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
            <path d={`M0 ${TOP} Q50 ${TOP + SAG} 100 ${TOP}`} vectorEffect="non-scaling-stroke" />
          </svg>
          {items.map((child, i) => (
            <div
              className="parchi-holder"
              key={child.key ?? i}
              style={{ marginTop: sagAt(i, n) + 16, '--r': `${TILT[i % TILT.length]}deg` }}
            >
              <span className="pin" aria-hidden="true" />
              {child}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
