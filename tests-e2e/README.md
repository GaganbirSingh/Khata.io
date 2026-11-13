End-to-end and accessibility check used for the audit (puppeteer-core + axe-core).

    cd tests-e2e && npm i @sparticuz/chromium puppeteer-core axe-core
    # start the app on http://localhost:4000 first (npm run build && npm start)
    node run.mjs

It walks through the demo shop, entries, customers, ledger, reminders, the customer pay page,
reports, settings and the legal pages; runs axe-core on each; checks keyboard focus, phone width,
200% zoom, third-party requests and console errors; then deletes the demo account.

Dark mode: `SCHEME=dark node run.mjs` runs the same walk-through and axe checks with the
device set to dark. `node toggle.mjs` checks the light/dark switch (header, login footer,
shop menu, Settings → Appearance, "Same as my device"). Set `BASE=` to test the demo build.
