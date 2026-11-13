import { useEffect, useState } from 'react';

// Light / dark mode ("din" and "raat").
// By default the site follows the device setting (prefers-color-scheme), done
// purely in CSS. If the person picks a mode themselves, the choice is kept in
// this browser only (localStorage "uk_theme") and set as <html data-theme>.
const KEY = 'uk_theme';
const EVENT = 'khata:theme';
const BAR = { light: '#98BFCB', dark: '#0B1E30' };

export function storedTheme() {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolvedTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' || attr === 'light' ? attr : systemTheme();
}

export function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice);
  else root.removeAttribute('data-theme');
  // Browser toolbar colour on phones.
  const now = resolvedTheme();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (choice === 'system') m.setAttribute('content', m.media?.includes('dark') ? BAR.dark : BAR.light);
    else m.setAttribute('content', BAR[now]);
  });
}

export function setTheme(choice) {
  try {
    if (choice === 'system') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, choice);
  } catch {
    /* storage blocked: the choice still applies until the page is reloaded */
  }
  applyTheme(choice);
  window.dispatchEvent(new Event(EVENT));
}

// Call once before the first render.
export function initTheme() {
  applyTheme(storedTheme());
}

// Runs `fn` whenever the visible theme may have changed.
export function onThemeChange(fn) {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  window.addEventListener(EVENT, fn);
  mq?.addEventListener?.('change', fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    mq?.removeEventListener?.('change', fn);
  };
}

export function useTheme() {
  const [state, setState] = useState(() => ({ choice: storedTheme(), resolved: resolvedTheme() }));
  useEffect(() => onThemeChange(() => setState({ choice: storedTheme(), resolved: resolvedTheme() })), []);
  return { ...state, setTheme };
}
