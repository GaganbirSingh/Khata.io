import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessible modal: traps focus, closes on Escape, returns focus afterwards.
export default function Dialog({ title, onClose, children, labelHidden = false, initialFocus }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    const first = initialFocus?.current || node.querySelector(FOCUSABLE);
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    node.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      node.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous && previous.focus) previous.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <button type="button" className="icon-btn dialog-close" onClick={onClose} aria-label="Close">
          <IconX size={22} aria-hidden="true" />
        </button>
        <h2 id={titleId} className={labelHidden ? 'sr-only' : ''}>
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body
  );
}
