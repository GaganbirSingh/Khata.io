// Brand mark: a parchi (bill slip) hung on a peg, with a ₹ and a lemon
// highlighter stroke. The same drawing is the favicon (public/favicon.svg).
export function Mark({ size = 40, title, className = '' }) {
  return (
    <svg
      className={`mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      <g className="mark-slip" transform="rotate(-7 32 10)">
        <path
          d="M12 12 H52 V54 L47 59 L42 54 L37 59 L32 54 L27 59 L22 54 L17 59 L12 54 Z"
          fill="#FFFEF4"
          stroke="#0F2A44"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <rect x="17" y="33" width="30" height="13" rx="1.5" fill="#FCF951" />
        <path
          d="M21 21 H43 M21 27.5 H43 M28 21 C38 21 38.5 34 28 34 H24 L38 48"
          fill="none"
          stroke="#0F2A44"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <rect x="27" y="1.5" width="10" height="19" rx="3" fill="#3073B7" stroke="#0F2A44" strokeWidth="2.5" />
      <path d="M32 4.5 V17" stroke="#98BFCB" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Wordmark: "khata" handwritten with a highlighter behind it, ".io" set firmly.
export function Wordmark({ stacked = false }) {
  return (
    <span className={`wordmark ${stacked ? 'stacked' : ''}`} aria-hidden="true">
      <span className="wm-k">khata</span>
      <span className="wm-u">.io</span>
    </span>
  );
}

export default function Logo({ size = 40, stacked = false, onDark = false }) {
  return (
    <span className={`logo ${stacked ? 'stacked' : ''} ${onDark ? 'on-dark' : ''}`}>
      <Mark size={size} />
      <Wordmark stacked={stacked} />
    </span>
  );
}
