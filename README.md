# Khata.io

A smart digital credit ledger (*bahi khata*) for small Indian shops, built with the MERN stack and Google Gemini.
Formerly "Udhaar Khata Copilot". Read the naming note in `COMPLIANCE.md` (section 4) before launching under this name.

> **Portfolio demo.** No real money moves. Payments are simulated (or Razorpay **test mode**), and visitors are asked to use sample data only.

## What it does

| Feature | How it works |
| --- | --- |
| **Bolo, likho** | Type or speak *"Ramesh ne 250 ka atta liya, 500 de diye"*. An offline Hinglish parser reads it; Gemini is asked only when the parser is unsure, with known customer names replaced by placeholders first. Nothing is saved until the shopkeeper confirms. |
| **Scan khata** | Photo of a handwritten page → Gemini (structured JSON output) → editable review screen with "please check" flags for low-confidence lines and ambiguous names. The photo is never stored. |
| **The dori** | Recent entries hang as paper *parchis* pegged on a string; a second string holds customers with udhaar older than 30 days. Owed money is marked with a lemon highlighter, paid money gets a blue stamp. |
| **Khata book** | Each customer's ledger as an open notebook with running balances. |
| **Yaad dilao** | Respectful reminders (Hinglish, Punjabi, English × polite, friendly, firm). AI writes from placeholders only, then a safety filter blocks threats, penalties and missing fields. WhatsApp opens with the message; the shopkeeper presses Send. |
| **Pay by UPI link** | Every reminder includes a private, expiring link. Payments are recorded exactly once via idempotent webhook handling. |
| **Hisaab** | Reports and plain-language insights calculated from real entries only. |
| **Privacy controls** | Download all data as JSON, delete account instantly, automatic deletion after 30 days of inactivity, 24-hour demo shops. |

## Tech stack

- **Frontend:** React 19, React Router 7, Vite, plain CSS design system ("Rangoli pop"), self-hosted fonts (no Google Fonts CDN), Tabler icons
- **Backend:** Node.js 20+, Express 5, MongoDB + Mongoose 8, zod validation, JWT in an httpOnly cookie, bcrypt, helmet CSP, rate limiting
- **AI:** Google Gemini via `@google/genai` (structured JSON output, vision)
- **Payments:** Razorpay Payment Links (test mode) with HMAC-verified webhooks, or a built-in demo mode

```
client/   React app (pages, components, design system)
server/   Express API
  src/routes      auth, customers, entries, ai, reminders, pay, webhooks, reports, account
  src/services    ledger, payments, reminders, AI (Gemini + offline parser), cleanup, demo seed
  test/           70 automated tests (node:test + supertest)
```

## Run it locally

You need Node.js 20+ and a MongoDB database (a free MongoDB Atlas cluster works).

```bash
npm run install:all
cp server/.env.example server/.env      # then fill in MONGODB_URI and JWT_SECRET
npm run dev:server                      # API on http://localhost:4000
npm run dev:client                      # website on http://localhost:5173
```

Everything works without any API keys: AI scanning is switched off, typed entries use the offline parser, and payments are simulated. Add `GEMINI_API_KEY` to turn on scanning, and Razorpay **test** keys to use real test-mode payment pages.

### Live demo build

`cd client && npx vite build --config vite.demo.config.js` makes `dist-demo/demo.html`: the whole app in one file, with the API simulated in the browser on sample data (`client/src/demo/mockApi.js`). It reuses the server's parser, name matching and reminder templates. Useful for sharing a clickable demo without a server.

### Tests

```bash
npm test
```

The tests need a MongoDB server. Point `TEST_MONGODB_URI` at a scratch database if it isn't on `127.0.0.1:27017`. Each test file creates and drops its own database.

## Deploy on Vercel (recommended: no sleeping server)

`vercel.json` is already set up: the React app is served from Vercel's CDN, and every `/api/*` request goes to one Vercel Function (`api/index.js` → `server/src/serverless.js`) running the same Express app in the **Mumbai region (`bom1`)**, next to a Mumbai Atlas cluster.

1. **MongoDB Atlas:** a cluster in **Mumbai (ap-south-1)**. Under *Network Access* allow `0.0.0.0/0` (Vercel has no fixed IP addresses), and use a database user with a long random password that can only read and write this one database.
2. **Push the project to GitHub**, then on vercel.com: *Add New → Project → Import* the repo. Leave *Root Directory* as the repo root; the build settings come from `vercel.json`.
3. **Environment variables** (Project → Settings → Environment Variables, for Production):
   `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` (48+ random bytes), `APP_URL=https://<your-project>.vercel.app`, `CRON_SECRET` (another random string), `GEMINI_API_KEY`, `GEMINI_TIER`, and the `OPERATOR_*` / `CONTACT_EMAIL` / `GRIEVANCE_OFFICER` values. Razorpay test keys are optional.
4. **Deploy.** Then create the database indexes once from your computer: `MONGODB_URI="..." JWT_SECRET="..." npm run db:indexes`.
5. Open `https://<your-project>.vercel.app/api/health`. It should say `{"ok":true}`.

How photo scanning works on Vercel: a Vercel Function accepts at most **4.5 MB per request**, and phone photos are often bigger. The Scan page therefore shrinks every photo in the browser first (longest side 2000 px, JPEG, EXIF data removed; usually 0.3–1.5 MB) and the server accepts up to 4 MB. Photos are still processed in memory only; nothing is written to disk or to a bucket, so no file storage service is needed.

Differences from the Render setup:
- The hourly cleanup timer becomes a **Vercel Cron** run once a day (the most the free Hobby plan allows), plus a check at most once an hour while the site is being used. Expired demo shops can't log in anyway.
- Rate limits are counted per running instance, not across all of them, so they are looser than on a single server.
- Preview deployments get their own URLs. Logging in there is blocked by the origin check unless you add that URL to `ALLOWED_ORIGINS`; use the production URL for testing.

## Deploy (one service on Render)

1. Create a MongoDB Atlas cluster (region **Mumbai, ap-south-1**) and copy the connection string.
2. On Render, create a **Web Service** from this repo:
   - Build command: `npm run build`
   - Start command: `npm start`
   - Environment: everything from `server/.env.example`, with `NODE_ENV=production`, a long random `JWT_SECRET`, and `APP_URL` set to your Render URL.
3. Fill in `OPERATOR_NAME`, `CONTACT_EMAIL`, `GRIEVANCE_OFFICER` and `OPERATOR_CITY`. They appear on the legal pages.
4. Optional, for Razorpay test mode: add the webhook `https://<your-app>/api/webhooks/razorpay` for the `payment_link.paid` event in the Razorpay **test** dashboard.

The server serves the built React app itself, so there is one URL and no CORS setup.

## Engineering notes worth talking about

- **Fair khata maths.** Three entry types: *udhaar* (credit), *jama* (payment towards the khata) and *nakad* (goods paid for on the spot). When one note has both a purchase and a payment, the money pays for today's goods first, so old baaki never disappears just because the customer paid for what they bought today. Khata payments clear the **oldest** udhaar first, and a customer stays overdue until that old udhaar is actually paid (`server/src/utils/khata.js`, shared with the browser demo).

- **Money is integers.** Every amount is stored in paise, so `0.1 + 0.2` never becomes `0.30000000000000004`.
- **Exactly-once payments.** The payment entry has a unique `paymentRef`, and webhook event IDs are remembered for 30 days. Retries and duplicate deliveries are ignored (tested with concurrent requests).
- **Privacy-first AI.** Local parsing first; pseudonymised names when Gemini is needed; placeholder-only prompts for reminders; photos processed in memory only.
- **Human in the loop.** AI output is always a proposal. Nothing reaches the ledger until the shopkeeper confirms it.
- **Tenant isolation.** Every query is scoped to the logged-in shop; tests check that one shop cannot read, edit or delete another's data.
- **Security.** httpOnly SameSite cookie, Origin check against CSRF, strict CSP with no third-party scripts, rate limits, generic login errors, live payment keys refused at startup.
- **Accessibility.** WCAG 2.1 AA target: keyboard-only flows, focus-trapped dialogs, labelled forms, AA contrast, no colour-only meaning, reduced-motion support. Checked with axe-core on every screen (0 violations).

## Brand

The logo is a parchi (bill slip) with a ₹ and a highlighter stroke, hung on a blue peg. The wordmark is **khata** handwritten with a lemon highlighter behind it, followed by a firm **.io**. The same drawing is the favicon (`client/public/favicon.svg`, plus `favicon-32.png`, `apple-touch-icon.png` and `icon-192.png`). Colours: Sea Angel `#98BFCB` (base), Super Sonic `#3073B7` (pegs, buttons, stamps), Lemon Tonic `#FCF951` (highlighter for baaki), ink `#0F2A44` for all text.

## Din and raat (light and dark mode)

Dark mode is the same shop after closing time, not an inverted copy:

- The Sea Angel counter turns night blue (`#0B1E30`, Super Sonic's hue with the light turned down); panels, menus and dialogs become a slightly lighter blue.
- **Paper stays paper.** Parchis, the khata book, the landing preview and the login cards keep dark ink on paper; only the paper dims to a warm `#ECE8D6`, like paper under a shop bulb. They sit on a blue offset shadow, like the book cover.
- **The highlighter glows.** Lemon Tonic is unchanged, so baaki is the brightest thing on the screen at night too. The cursor light becomes a dim bulb (16% instead of 50%) so text keeps its contrast.
- It follows the device setting by default. The sun/moon button (header, shop menu, login footer) or Settings → Appearance sets it by hand; the choice is kept in this browser only (`uk_theme`).
- Everything is driven by colour tokens in `client/src/styles.css` (`:root` for din, the `Raat` block at the end for night, and a "paper" scope that keeps paper objects light). axe-core reports 0 violations on all 22 screens in both modes.

## Parchu and the living background

- **Parchu** (`client/src/components/Parchu.jsx`) is the mascot on the login and sign-up screens: a parchi wearing the blue peg as a hair clip. Its eyes follow the cursor, or the text being typed; it covers its eyes while you type a password, peeks when you press "show password", frowns on an error and hops when you get in.
- **DoriField** (`client/src/components/DoriField.jsx`) draws the login background: two wires with tiny parchis that ripple away from the cursor or a finger, plus a lemon glow that follows it. It pauses when the tab is hidden, and draws a still picture for people who turn on "reduce motion".
- **CursorGlow** (`client/src/components/CursorGlow.jsx`) gives every other page the same soft lemon light that follows the cursor, without the wires, so content pages stay clean.

## Licence

Copyright © the project owner. All rights reserved unless you add an open-source licence.
Third-party packages keep their own licences; see `client/public/third-party-licenses.txt` (also linked in the site footer).
