import { useEffect, useRef } from 'react';
import { onThemeChange } from '../lib/theme.js';

// Living background: dori strings stretched across the screen with tiny
// parchis pegged on them. Moving the cursor (or a finger) pushes the strings
// like plucking a clothesline; the parchis swing, and a soft lemon light
// follows the pointer. Decorative only (aria-hidden, no focusable parts).
//
// Used on the login screens only. Every other page gets just the cursor glow
// (CursorGlow), so content pages stay clean.
// mode="full"  two wires with slips at the edges, plus the glow
// mode="calm"  fainter wires, no slips, no glow
//
// With prefers-reduced-motion the scene is drawn once and stays still.

// Wire and paper colours come from the theme (--wire-rgb, --slip-paper), so
// the scene matches light and dark mode. Ink on the slips is always dark.
const INK = '15, 42, 68';
const LEMON = '#FCF951';
const SONIC = '#3073B7';

function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildScene(w, h, mode) {
  const r = rand(7);
  // Just two wires: one near the top, one near the bottom.
  const count = 2;
  const strings = [];
  for (let s = 0; s < count; s += 1) {
    const base = ((s + 0.6) / count) * h - 10;
    const n = Math.max(24, Math.round(w / 26));
    const sag = 26 + r() * 34;
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      pts.push({ x: -40 + t * (w + 80), rest: base + sag * 4 * t * (1 - t), d: 0, v: 0 });
    }
    const slips = [];
    if (mode !== 'calm') {
      const every = 2 + Math.floor(r() * 2);
      for (let i = 3 + Math.floor(r() * 3); i < n - 2; i += every + Math.floor(r() * 4)) {
        // keep the middle of the screen calm, where the content is
        const t = i / n;
        if (t > 0.17 && t < 0.83) continue;
        slips.push({
          i,
          w: 16 + r() * 12,
          h: 22 + r() * 14,
          a: (r() - 0.5) * 0.2,
          va: 0,
          mark: r(),
        });
      }
    }
    strings.push({ pts, slips, phase: r() * Math.PI * 2 });
  }
  return strings;
}

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  return {
    wire: cs.getPropertyValue('--wire-rgb').trim() || INK,
    paper: cs.getPropertyValue('--slip-paper').trim() || '#FFFEF4',
  };
}

function drawSlip(ctx, sl, colors) {
  const { w, h } = sl;
  ctx.fillStyle = colors.paper;
  ctx.strokeStyle = `rgba(${INK}, 0.55)`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 6);
  ctx.lineTo(w / 2, 6);
  ctx.lineTo(w / 2, 6 + h);
  const teeth = 4;
  for (let k = 1; k <= teeth; k += 1) {
    const x = w / 2 - (k * w) / teeth;
    ctx.lineTo(x + w / teeth / 2, 6 + h + 3.5);
    ctx.lineTo(x, 6 + h);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // writing lines, sometimes highlighted
  if (sl.mark > 0.55) {
    ctx.fillStyle = LEMON;
    ctx.fillRect(-w / 2 + 3, 6 + h * 0.48, w - 6, 5);
  }
  ctx.strokeStyle = `rgba(${INK}, 0.5)`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 4, 6 + h * 0.3);
  ctx.lineTo(w / 2 - 5, 6 + h * 0.3);
  ctx.moveTo(-w / 2 + 4, 6 + h * 0.53);
  ctx.lineTo(w / 4, 6 + h * 0.53);
  ctx.stroke();
  // peg
  ctx.fillStyle = SONIC;
  ctx.strokeStyle = `rgba(${INK}, 0.8)`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-2.5, -4, 5, 13, 1.5);
  else ctx.rect(-2.5, -4, 5, 13);
  ctx.fill();
  ctx.stroke();
}

export default function DoriField({ mode = 'full' }) {
  const canvasRef = useRef(null);
  const glowRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let strings = [];
    const p = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, gx: -9999, gy: -9999, seen: false };
    let raf = 0;
    let running = true;
    let colors = readColors();

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      strings = buildScene(w, h, mode);
      if (reduce) draw(0);
    };

    const move = (e) => {
      p.x = e.clientX;
      p.y = e.clientY;
      if (!p.seen) {
        p.px = p.x;
        p.py = p.y;
        p.gx = p.x;
        p.gy = p.y;
        p.seen = true;
      }
    };
    const leave = () => {
      p.x = -9999;
      p.y = -9999;
    };

    const strength = mode === 'calm' ? 0.9 : 1.6;
    const radius = mode === 'calm' ? 90 : 120;

    function step(t) {
      p.vx = p.x - p.px;
      p.vy = p.y - p.py;
      p.px = p.x;
      p.py = p.y;
      for (const s of strings) {
        const pts = s.pts;
        const last = pts.length - 1;
        for (let i = 1; i < last; i += 1) {
          const pt = pts[i];
          let f = 0.22 * (pts[i - 1].d + pts[i + 1].d - 2 * pt.d) - 0.012 * pt.d - 0.06 * pt.v;
          // gentle breeze so the scene is alive even without a cursor
          f += Math.sin(t / 1400 + i * 0.35 + s.phase) * 0.012;
          const y = pt.rest + pt.d;
          const dx = p.x - pt.x;
          const dy = p.y - y;
          const dist = Math.hypot(dx, dy);
          if (dist < radius) {
            const k = 1 - dist / radius;
            f += (dy > 0 ? -1 : 1) * k * k * strength;
            f += p.vy * k * 0.06;
          }
          pt.v += f;
        }
        for (let i = 1; i < last; i += 1) {
          const pt = pts[i];
          pt.d = Math.max(-90, Math.min(90, pt.d + pt.v));
        }
        for (const sl of s.slips) {
          const pt = pts[sl.i];
          const dx = p.x - pt.x;
          const dy = p.y - (pt.rest + pt.d);
          const dist = Math.hypot(dx, dy);
          let torque = -0.02 * sl.a - 0.05 * sl.va - pt.v * 0.004;
          if (dist < radius * 1.2) torque += -p.vx * (1 - dist / (radius * 1.2)) * 0.004;
          sl.va += torque;
          sl.a = Math.max(-0.9, Math.min(0.9, sl.a + sl.va));
        }
      }
      p.gx += (p.x - p.gx) * 0.12;
      p.gy += (p.y - p.gy) * 0.12;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const glow = glowRef.current;
      if (glow) {
        const on = p.seen && p.x > -9000;
        glow.style.opacity = on ? '1' : '0';
        if (on) glow.style.transform = `translate3d(${(p.gx - 260).toFixed(1)}px, ${(p.gy - 260).toFixed(1)}px, 0)`;
      }
      for (const s of strings) {
        const pts = s.pts;
        ctx.strokeStyle = `rgba(${colors.wire}, ${mode === 'calm' ? 0.18 : 0.42})`;
        ctx.lineWidth = mode === 'calm' ? 1.2 : 1.6;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].rest + pts[0].d);
        for (let i = 1; i < pts.length - 1; i += 1) {
          const a = pts[i];
          const b = pts[i + 1];
          const mx = (a.x + b.x) / 2;
          const my = (a.rest + a.d + b.rest + b.d) / 2;
          ctx.quadraticCurveTo(a.x, a.rest + a.d, mx, my);
        }
        const end = pts[pts.length - 1];
        ctx.lineTo(end.x, end.rest + end.d);
        ctx.stroke();
        for (const sl of s.slips) {
          const pt = pts[sl.i];
          const prev = pts[sl.i - 1];
          const next = pts[sl.i + 1];
          const slope = Math.atan2(next.rest + next.d - (prev.rest + prev.d), next.x - prev.x) * 0.5;
          ctx.save();
          ctx.translate(pt.x, pt.rest + pt.d);
          ctx.rotate(sl.a + slope);
          drawSlip(ctx, sl, colors);
          ctx.restore();
        }
      }
    }

    const loop = (t) => {
      if (!running) return;
      step(t);
      draw();
      raf = requestAnimationFrame(loop);
    };

    const visibility = () => {
      running = !document.hidden && !reduce;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(loop);
    };

    const stopTheme = onThemeChange(() => {
      colors = readColors();
      if (reduce) draw(0);
    });

    resize();
    window.addEventListener('resize', resize);
    if (!reduce) {
      window.addEventListener('pointermove', move, { passive: true });
      window.addEventListener('pointerdown', move, { passive: true });
      document.addEventListener('pointerleave', leave);
      document.addEventListener('visibilitychange', visibility);
      raf = requestAnimationFrame(loop);
    } else {
      draw(0);
    }
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      stopTheme();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      document.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [mode]);

  return (
    <>
      {mode !== 'calm' && <div ref={glowRef} className="dori-glow" aria-hidden="true" />}
      <canvas ref={canvasRef} className={`dori-field dori-field-${mode}`} aria-hidden="true" />
    </>
  );
}
