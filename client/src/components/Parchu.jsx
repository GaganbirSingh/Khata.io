import { useEffect, useRef } from 'react';

// Parchu: the Khata.io mascot. A little parchi (bill slip) wearing the
// blue peg as a hair clip. Its eyes follow the cursor, or the text you are
// typing, and it reacts to the form:
//   idle   looks around, blinks
//   shy    covers its eyes while you type a password
//   peek   one hand down when the password is shown
//   sad    eyebrows down and a little shake on an error
//   happy  happy eyes and a hop when you log in
//   think  looks up while waiting
// Purely decorative: hidden from screen readers.

const W = 220;
const EYES = [
  { cx: 82, cy: 112 },
  { cx: 138, cy: 112 },
];
const MAX_LOOK = 11;

function tornBottom() {
  const pts = [];
  const teeth = 10;
  const left = 30;
  const right = 190;
  const step = (right - left) / teeth;
  for (let i = 0; i <= teeth; i += 1) {
    const x = right - i * step;
    pts.push(`L${x.toFixed(1)} ${i % 2 === 0 ? 214 : 228}`);
  }
  return pts.join(' ');
}
const BODY = `M50 44 H170 Q190 44 190 64 V214 ${tornBottom()} L30 214 V64 Q30 44 50 44 Z`;

// Shared pointer position for every Parchu on the page.
const pointer = { x: -1, y: -1, active: false };
let listeners = 0;
function onMove(e) {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
}
function track() {
  if (listeners === 0) window.addEventListener('pointermove', onMove, { passive: true });
  listeners += 1;
  return () => {
    listeners -= 1;
    if (listeners === 0) window.removeEventListener('pointermove', onMove);
  };
}

// Where should the eyes look? At the text being typed if a field has focus,
// otherwise at the cursor.
function lookTarget(scope) {
  const el = document.activeElement;
  if (el && scope?.contains(el) && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) {
    const r = el.getBoundingClientRect();
    const typed = el.tagName === 'INPUT' && el.type !== 'checkbox' ? String(el.value || '').length : 0;
    return { x: r.left + Math.min(16 + typed * 8.5, r.width - 12), y: r.top + r.height / 2 };
  }
  if (pointer.active) return { x: pointer.x, y: pointer.y };
  return null;
}

export default function Parchu({ mood = 'idle', size = 220, scope, className = '' }) {
  const svgRef = useRef(null);
  const pupils = useRef([]);
  const body = useRef(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;

  useEffect(() => {
    const untrack = track();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const cur = EYES.map(() => ({ x: 0, y: 0 }));
    let tilt = 0;
    let raf = 0;
    let blinkAt = performance.now() + 2500 + Math.random() * 2500;

    const frame = (now) => {
      const svg = svgRef.current;
      if (!svg) return;
      const box = svg.getBoundingClientRect();
      const scale = box.width / W;
      const m = moodRef.current;
      const target = m === 'think' ? { x: box.left + box.width * 0.6, y: box.top - 400 } : lookTarget(scope?.current);

      EYES.forEach((eye, i) => {
        let tx = 0;
        let ty = 0;
        if (target) {
          const ex = box.left + eye.cx * scale;
          const ey = box.top + eye.cy * scale;
          const dx = target.x - ex;
          const dy = target.y - ey;
          const dist = Math.hypot(dx, dy) || 1;
          const reach = Math.min(MAX_LOOK, dist / 18);
          tx = (dx / dist) * reach;
          ty = (dy / dist) * reach;
        }
        const k = reduce ? 1 : 0.18;
        cur[i].x += (tx - cur[i].x) * k;
        cur[i].y += (ty - cur[i].y) * k;
        pupils.current[i]?.setAttribute('transform', `translate(${cur[i].x.toFixed(2)} ${cur[i].y.toFixed(2)})`);
      });

      // Lean a little towards whatever it is looking at.
      const lean = target && !reduce ? Math.max(-5, Math.min(5, (target.x - (box.left + box.width / 2)) / 90)) : 0;
      tilt += (lean - tilt) * 0.08;
      if (body.current) body.current.style.setProperty('--lean', `${tilt.toFixed(2)}deg`);

      // Blink now and then.
      if (!reduce && now > blinkAt && (m === 'idle' || m === 'think' || m === 'sad')) {
        svg.classList.add('blink');
        setTimeout(() => svg.classList.remove('blink'), 140);
        blinkAt = now + 2600 + Math.random() * 3200;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      untrack();
    };
  }, [scope]);

  const height = (size * 240) / 220;

  return (
    <svg
      ref={svgRef}
      className={`parchu mood-${mood} ${className}`}
      width={size}
      height={height}
      viewBox="0 0 220 240"
      aria-hidden="true"
      focusable="false"
    >
      <g ref={body} className="p-body">
        <g className="p-hop">
          <path d={BODY} fill="#FFFEF4" stroke="#0F2A44" strokeWidth="5" strokeLinejoin="round" />
          {/* writing on the slip, one line highlighted */}
          <rect className="p-hl" x="60" y="174" width="100" height="18" rx="3" fill="#FCF951" transform="rotate(-3 110 183)" />
          <path d="M70 184 H150 M70 202 H124" stroke="#0F2A44" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
          {/* cheeks */}
          <ellipse cx="56" cy="146" rx="11" ry="7" fill="#FCF951" opacity="0.9" />
          <ellipse cx="164" cy="146" rx="11" ry="7" fill="#FCF951" opacity="0.9" />
          {/* eyebrows */}
          <path className="p-brow p-brow-l" d="M60 74 Q80 62 100 72" fill="none" stroke="#0F2A44" strokeWidth="6" strokeLinecap="round" />
          <path className="p-brow p-brow-r" d="M120 72 Q140 62 160 74" fill="none" stroke="#0F2A44" strokeWidth="6" strokeLinecap="round" />
          {/* eyes */}
          {EYES.map((e, i) => (
            <g key={i} className={`p-eye p-eye-${i ? 'r' : 'l'}`} style={{ transformOrigin: `${e.cx}px ${e.cy}px` }}>
              <ellipse cx={e.cx} cy={e.cy} rx="25" ry="28" fill="#fff" stroke="#0F2A44" strokeWidth="5" />
              <g
                ref={(el) => {
                  pupils.current[i] = el;
                }}
              >
                <circle cx={e.cx} cy={e.cy} r="13.5" fill="#0F2A44" />
                <circle cx={e.cx} cy={e.cy} r="6" fill="#3073B7" />
                <circle cx={e.cx - 5} cy={e.cy - 6} r="4.5" fill="#fff" />
              </g>
            </g>
          ))}
          {/* happy eyes ^ ^ */}
          <path className="p-happy" d="M62 116 Q82 92 102 116 M118 116 Q138 92 158 116" fill="none" stroke="#0F2A44" strokeWidth="7" strokeLinecap="round" />
          {/* mouth */}
          <path className="p-mouth p-smile" d="M100 152 Q110 162 120 152" fill="none" stroke="#0F2A44" strokeWidth="5" strokeLinecap="round" />
          <path className="p-mouth p-o" d="M110 150 m-6 0 a6 7 0 1 0 12 0 a6 7 0 1 0 -12 0" fill="#0F2A44" />
          <path className="p-mouth p-frown" d="M100 160 Q110 150 120 160" fill="none" stroke="#0F2A44" strokeWidth="5" strokeLinecap="round" />
          {/* hands */}
          <g className="p-hand p-hand-l">
            <ellipse cx="34" cy="168" rx="20" ry="15" fill="#FFFEF4" stroke="#0F2A44" strokeWidth="5" />
            <path d="M22 162 V170 M30 159 V169 M38 159 V169 M46 162 V170" stroke="#0F2A44" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g className="p-hand p-hand-r">
            <ellipse cx="186" cy="168" rx="20" ry="15" fill="#FFFEF4" stroke="#0F2A44" strokeWidth="5" />
            <path d="M174 162 V170 M182 159 V169 M190 159 V169 M198 162 V170" stroke="#0F2A44" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
        {/* the peg, worn like a hair clip */}
        <g className="p-peg">
          <rect x="99" y="10" width="22" height="50" rx="7" fill="#3073B7" stroke="#0F2A44" strokeWidth="5" />
          <path d="M110 18 V52" stroke="#98BFCB" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
