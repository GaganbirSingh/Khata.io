import { useEffect } from 'react';

let firstPage = true;

// Sets the tab title. After an in-app navigation (not the first page load),
// moves focus to the page's main heading so screen readers announce the new page.
export function usePage(title) {
  useEffect(() => {
    document.title = title ? `${title} · Khata.io` : 'Khata.io';
    if (firstPage) {
      firstPage = false;
      return;
    }
    const h1 = document.querySelector('main h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [title]);
}
