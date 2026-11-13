import { useEffect, useRef } from 'react';

// A soft lemon light that follows the cursor (or a finger) across the page.
// It sits behind the content and never blocks clicks. Turned off for people
// who ask for reduced motion, and paused while the tab is hidden.
export default function CursorGlow() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const target = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };
    let seen = false;
    let raf = 0;

    const tick = () => {
      pos.x += (target.x - pos.x) * 0.14;
      pos.y += (target.y - pos.y) * 0.14;
      el.style.transform = `translate3d(${(pos.x - 260).toFixed(1)}px, ${(pos.y - 260).toFixed(1)}px, 0)`;
      if (Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 0.5) raf = requestAnimationFrame(tick);
      else raf = 0;
    };
    const move = (e) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!seen) {
        seen = true;
        pos.x = target.x;
        pos.y = target.y;
        el.style.opacity = '1';
      }
      if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const leave = () => {
      el.style.opacity = '0';
      seen = false;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, []);

  return <div ref={ref} className="dori-glow" aria-hidden="true" />;
}
