# Compliance, privacy and accessibility audit

Khata.io (formerly "Udhaar Khata Copilot") · audited 3 October 2026, rebranded 9 October 2026

**Read this first.** This is a careful engineering audit, not legal advice. I am not a lawyer. The legal pages in the app are good-faith drafts written for a **portfolio demo with sample data**. Have them reviewed by a lawyer before real users, real customer data or real money are involved. Every risk I could find is listed in [section 5](#5-remaining-risks); none were hidden.

---

## 1. Summary

| Area | Status |
| --- | --- |
| Privacy policy, terms, cookie policy, refund policy, accessibility statement | Written (in the app at `/privacy`, `/terms`, `/cookies`, `/refunds`, `/accessibility`). **You must fill in 4 placeholders.** |
| Consent | Two unticked boxes (18+, Terms/Privacy), enforced by the server, consent version and time stored |
| Cookies | One strictly necessary login cookie. No consent banner needed; an information notice is shown |
| Data minimisation | Only email, hashed password, shop details, customer name, optional phone, entries. Photos never stored. Auto-deletion after 30 days inactive, demo shops after 24 hours |
| Third-party tracking | None. Verified: the browser made requests only to the app's own server during a full test run |
| Accessibility | 0 axe-core violations (WCAG 2.1 A/AA + best practice) on every screen tested; keyboard, zoom and mobile checks passed |
| Fake reviews / unsupported claims | None. No testimonials, user counts or invented statistics. Every claim on the site was checked against the code |
| Dark patterns / hidden fees | None found against all 13 patterns in India's 2023 guidelines. The app is free |
| Security | 56 automated tests including cross-shop isolation, CSRF, injection, duplicate payments |
| Remaining risks | 4 high, 10 medium, 6 low. See section 5 |

---

## 2. What was checked, and the results

### 2.1 Legal pages

| Page | Covers |
| --- | --- |
| Privacy policy | Who is responsible; a table of every data item, why it's needed and how long it's kept; every outside service and what it receives; Gemini free-tier warning; rights (access, correction, erasure, withdrawal, nomination, grievance); children; security; breach notice; backups; contact |
| Terms of use | What the app is and isn't (not a bank or lender); 18+ and India only; sample data only; fair-reminder rules; AI can be wrong; payments; account deletion; ownership; liability limits that respect consumer law; governing law |
| Cookie policy | The one cookie plus three browser-storage keys, each with purpose and duration |
| Refund policy | App is free; payments go to shops; demo/test mode moves no money |
| Accessibility statement | Target standard, what was done, known limits, how to report problems |

Values in `[brackets]` come from server settings (`OPERATOR_NAME`, `CONTACT_EMAIL`, `GRIEVANCE_OFFICER`, `OPERATOR_CITY`). The pages read them live from `/api/meta`, so you only change them in one place.

### 2.2 Consent (forms)

- **Sign-up and demo** each have two separate, **unticked** checkboxes: "I am 18 or older" and "I agree to the Terms and Privacy Policy". Tested: no box is pre-ticked; submitting without them shows errors.
- The **server** refuses accounts without both (`z.literal(true)`), so the browser can't be bypassed. Tested.
- A consent record (terms version, privacy version, time, age confirmation) is stored on the account and included in the data export.
- **Withdrawal is as easy as giving consent:** Settings → Delete my account.
- **Voice typing** asks before first use and explains that Chrome sends audio to Google.
- **Scanning on Gemini's free tier** requires ticking "This page has only made-up sample data". The server enforces this too.
- **Adding a customer's phone** shows: "Add it only if the customer agrees."

### 2.3 Cookies and storage

| Name | Type | Purpose | Duration |
| --- | --- | --- | --- |
| `uk_session` | Cookie, first-party, httpOnly, SameSite=Lax, Secure in production | Login | 7 days / demo expiry |
| `uk_cookie_notice_seen` | localStorage | Notice dismissed | Until cleared |
| `uk_theme` | localStorage | Light/dark choice, only if the user picks one | Until cleared or reset to "Same as my device" |
| `uk_voice_ok` | sessionStorage | Voice notice read | Tab session |
| `uk_pending_payment` | sessionStorage | Payment in progress (pay page only) | Until confirmed / tab closed |

No analytics, advertising or third-party cookies. Because the only cookie is strictly necessary, a consent banner (accept/reject) would be misleading; an information notice is shown instead.

### 2.4 Data minimisation (what was deliberately *not* collected)

- Shopkeepers: **no** name, phone, address, date of birth, location or bank details. Email + hashed password + shop name/type/language only.
- Customers: name is required; phone is **optional** and used only for the WhatsApp link. No address or ID numbers.
- **Khata photos** are held in memory for one request and dropped. Never written to disk or the database.
- **No request logging** of personal data by the app (only server errors are logged).
- The **pay page** shows the customer's first name, amount due and last 5 entries only. Payment links are 32-character random tokens that expire after 30 days, and pages send `Referrer-Policy: no-referrer` so the token never leaks to other sites.
- **Razorpay** receives only amount, shop name and a reference. No customer phone or email (tested).
- **Gemini** receives typed entries only when the offline parser is unsure, with known customer names replaced by `CUSTOMER_1` etc. (tested). Reminder writing sends **no customer data at all**, only placeholders (tested).
- **Retention:** accounts inactive for 30 days are deleted with all data; demo shops after 24 hours; webhook IDs after 30 days. A cleanup job runs hourly (tested).
- **Demo data** is fictional and has **no phone numbers**, so a reminder can never open a chat with a real person (tested).

### 2.5 Third-party services and SDKs

| Service | When it is used | Data sent | Where configured |
| --- | --- | --- | --- |
| MongoDB Atlas | Always (database) | All app data | `MONGODB_URI` |
| Hosting (Vercel, Mumbai region `bom1`, or Render) | Always | Web traffic; host keeps its own logs | Deployment |
| Google Gemini API | Only if `GEMINI_API_KEY` is set | Khata photos; unclear typed entries (pseudonymised); reminder style requests (no personal data) | `GEMINI_*` |
| Razorpay | Only if all 3 test keys are set | Amount, shop name, reference | `RAZORPAY_*` |
| WhatsApp (wa.me link) | Only when the shopkeeper clicks | Message text, via the user's own WhatsApp | none |
| Browser speech service | Only if the user taps the mic and agrees | Audio goes from the browser to its vendor (Google in Chrome); app gets text only | none |

**Browser audit:** during a full end-to-end run (landing → demo → entries → customers → ledger → reminders → customer payment → reports → settings → legal pages → account deletion), the browser contacted **only `localhost:4000`** (plus the user-opened WhatsApp tab). Fonts are self-hosted (no Google Fonts), there are no CDNs, analytics, pixels, chat widgets or error-tracking SDKs. The Content-Security-Policy (`default-src 'self'`) blocks any third-party script even if one were added by mistake. The CSP was confirmed working: it blocked the test tool's own injected script until the test explicitly bypassed it.

**Dependencies:** `npm audit` shows 0 known vulnerabilities in both server and client. All licences are permissive (MIT, Apache-2.0, BSD, ISC, and SIL OFL for fonts). A notice file with every licence text is published at `/third-party-licenses.txt` and linked in the footer.

### 2.6 Accessibility (WCAG 2.1 AA target)

Automated: axe-core (rules `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `best-practice`) on **landing, demo dialog, galla, command sheet (empty and with results), customers, ledger, reminders, customer pay page, demo payment dialog, reports, scan, settings, privacy, terms, cookies, refunds, accessibility, login, sign-up, 404**. Result: **0 violations**.

The first run found real problems, which were fixed:
- Due (orange) and paid (green) text was 4.29:1 on pink backgrounds. Darkened to `#b53a09` / `#2a7230` (now ≥ 4.9:1 everywhere).
- The demo banner was outside page landmarks. It is now an `<aside>`.
- Heading levels skipped (h1 → h3) on the ledger and scan review. Fixed.
- On first page load focus jumped to the heading, so "Skip to content" was skipped. Fixed.

Behaviour checks (all passed):
- "Skip to content" is the first Tab stop.
- Dialogs: focus moves inside, Tab can't escape (25 presses tested), Escape closes, focus returns to the button that opened it.
- The whole entry flow (open command sheet with Enter, type, read, confirm) works by keyboard.
- No horizontal scrolling at 390px (phone) and 640px (equivalent to 200% zoom) on every app page.
- Money is never shown by colour alone: "baaki/jama/clear" words, +/− signs and screen-reader text.
- All form fields have labels; errors are linked with `aria-describedby` and announced.
- The chart has a hidden data table; decorative SVGs are hidden from screen readers.
- Animations stop with `prefers-reduced-motion`; Windows high-contrast mode gets borders.
- Dark mode (follows the device, or chosen by hand) was checked with axe-core on the same 22 screens: 0 violations. Text on Lemon Tonic is always dark ink in both modes.

Not done: manual testing with a real screen reader (NVDA, VoiceOver, TalkBack). See risk M10.

### 2.7 Fake reviews, unsupported claims, dark patterns, hidden fees

**Removed / never added:** testimonials, star ratings, "trusted by N shops", user counts, invented insights (the Figma prompt's "Reminders in Punjabi got paid 2 days faster" is **not** in the app; Hisaab shows only numbers calculated from the shop's own entries).

**Claims on the site, checked against the code:**

| Claim | True? |
| --- | --- |
| "No ads, no tracking, no analytics tools" | Yes (browser audit, CSP) |
| "We never sell or share your data for marketing" | Yes (no such code) |
| "AI suggestions are never saved without your OK" | Yes (parse/scan endpoints never write; tested) |
| "No fees… no hidden charges" | Yes (no fee logic exists; pay page charges exactly the amount shown) |
| "Inactive accounts are deleted after 30 days" | Yes (cleanup job; tested) |
| "Photo… not stored by Khata.io" | Yes for this app. Google may keep it under Gemini free-tier terms, which is disclosed |
| "We never record or store audio" | Yes (the app only receives text) |
| "Nothing is saved until you confirm" | Yes |
| "Not a bank or lender" | Yes |

**India's Guidelines for Prevention and Regulation of Dark Patterns, 2023 (CCPA):**

| Pattern | Status in this app |
| --- | --- |
| False urgency | None. No timers or "only N left" |
| Basket sneaking | None. Nothing is added to a payment |
| Confirm shaming | None. Neutral buttons ("Keep my account", "I'll type instead") |
| Forced action | None. Demo needs no sign-up; voice and phone are optional |
| Subscription trap | None. No subscription; deletion is in Settings, not hidden |
| Interface interference | None. Delete and cancel are equally visible |
| Bait and switch | None |
| Drip pricing | None. Free; pay page states "No extra charges" |
| Disguised advertisement | None. No ads |
| Nagging | None. Cookie notice shows once; voice notice once per tab |
| Trick question | None. Plain wording; no double negatives |
| SaaS billing | None. No billing |
| Rogue malware | None. No third-party code at runtime |

**Reminder content:** templates and AI output are checked to contain no threats, legal action, police, penalties, interest or fines; unsafe AI output is replaced with a template (tested). The Terms forbid harassment and extra charges.

### 2.8 Security

Tested automatically: login needs the right credentials, with one generic error for wrong email or wrong password; protected routes need a session; httpOnly + SameSite cookie; requests from other websites are blocked (CSRF); `{ "$ne": null }` style injection is rejected; one shop cannot read, edit or delete another shop's customers, entries or reminders; amounts are validated (no negative, zero, over ₹1,00,000 or future dates); online payments can't be deleted; duplicate and concurrent payment confirmations are counted once; forged Razorpay webhooks are rejected; live Razorpay keys are refused at startup; no stack traces in API errors.

Other protections: bcrypt (cost 12), rate limits on login, sign-up, AI and pay endpoints; 100 KB JSON limit; 5 MB image limit with file-signature check (JPG/PNG/WEBP); helmet headers (CSP, `frame-ancestors 'none'`, `no-referrer`, no `X-Powered-By`).

---

## 3. Laws and rules that apply to your users (India)

| Law / rule | Why it matters here | Status |
| --- | --- | --- |
| **Digital Personal Data Protection Act, 2023** and **DPDP Rules, 2025** (notified 13 Nov 2025; notice, consent, security, breach and retention duties apply from **13 May 2027**) | The app processes personal data of shopkeepers and their customers | Built to those rules ahead of time: itemised notice, unticked consent, easy withdrawal, access/erasure, security, retention limits, grievance contact |
| **IT Act, 2000** and **IT (Intermediary Guidelines) Rules, 2021** | The app stores content users enter | Grievance officer and contact on the privacy page (placeholders) |
| **Consumer Protection Act, 2019**, **E-Commerce Rules, 2020**, **CCPA Dark Patterns Guidelines, 2023** (and the 2025 advisory asking platforms to self-audit) | Applies to services offered to consumers; the app is free but the rules are followed anyway | Section 2.7 is the self-audit |
| **RBI rules on payment aggregators** | Collecting money for merchants is regulated | App never holds money; Razorpay does. **See risk H4 before any live payments** |
| **Bharatiya Nyaya Sanhita** (criminal intimidation, harassment) and general fair-recovery expectations | Payment reminders | Respectful templates, AI safety filter, Terms forbid threats |
| **Gemini API Additional Terms** (effective 23 Mar 2026) | 18+ only; free tier: Google may use content, don't send personal info; EEA/UK/Switzerland need paid tier | 18+ gate, sample-data warnings, pseudonymisation, India-only terms. See H3, M1 |
| **Razorpay terms** | Payment links | Test mode only (max 30 links per test business) |
| **WhatsApp terms** | Messages are sent from the shopkeeper's own WhatsApp | User-initiated only; no bulk sending |
| **Copyright Act, 1957** | Code, text, fonts, icons | Original code and copy; OFL fonts and MIT icons with notices |
| **Trade Marks Act, 1999** | Product name and third-party names | See M7 and section 4 |
| **Rights of Persons with Disabilities Act, 2016** | Accessibility | WCAG 2.1 AA target, section 2.6 |

---

## 4. Business details, licences, copyright and trademarks

- **Business details:** you are an individual student running a free demo, so no company registration, GST or trade licence is needed. The Terms name you as the operator. If you ever charge money, you would need a proper business set-up, GST registration above the threshold, and new legal documents. Consider a separate project email address instead of your personal or college email for `CONTACT_EMAIL`.
- **Copyright:** all app code, design and copy were written for this project. Third-party code and fonts are used under their licences, with notices published. The README says "All rights reserved"; add an open-source licence (e.g. MIT) only if you want others to reuse your code.
- **Sample data:** demo names are fictional common Indian names; any resemblance is coincidental. The demo shop is called "Sharma General Store (demo)".
- **Trademarks:**
  - **"Khata.io" (the new name).** "Khata" (ledger) is an everyday Hindi/Urdu word and many apps already use it ("Khatabook", "OkCredit Udhar Khata", "My Khata" and others), so it is descriptive: low risk of infringing, but hard to own on its own. The ".io" makes the full name more distinctive. I did not find a product called exactly "Khata.io", but I could not search the IP India register or check who owns the domain `khata.io`. Before any public launch: (1) search "KHATA" in classes 9 and 42 on the IP India public search, (2) check the `khata.io` WHOIS. If someone else owns the domain, don't imply you do (no `khata.io` email addresses or links), and use the name only as the project title.
  - **"Copilot"** (the old name) is a prominent Microsoft and GitHub brand. It has been removed from the public name entirely.
  - **WhatsApp, UPI, Razorpay, Google Gemini** are mentioned in text only, to describe what the app works with (nominative use). No third-party logos are used; the WhatsApp brand icon was swapped for a generic chat icon.
- **Licences you don't need:** this is not lending, so no NBFC or money-lending licence; the app never holds money, so no payment-aggregator licence. Both change if the business model changes (see H4).

---

## 5. Remaining risks

### High

| # | Risk | What to do |
| --- | --- | --- |
| H1 | The legal pages are drafts by an AI, not a lawyer | Fine for a portfolio demo with sample data. Get them reviewed before any real launch |
| H2 | The legal pages show placeholders: `[Your full name]`, `[your-contact@email]`, `[Your city], India` | Set `OPERATOR_NAME`, `CONTACT_EMAIL`, `GRIEVANCE_OFFICER`, `OPERATOR_CITY` before sharing the URL |
| H3 | Visitors might ignore the warnings and type real customers' names, numbers or photos. With Gemini's free tier, Google may use and human-review that content, and the customers never consented. The app can warn but cannot prevent it | Keep the sample-data warnings. For anything beyond a demo, switch to Gemini paid tier (`GEMINI_TIER=paid`) and add a lawful basis for customers' data |
| H4 | If live payments were switched on as designed, one Razorpay account would collect money for many shops, which looks like payment aggregation and needs RBI authorisation | Don't go live. Live keys are refused in code. A real version would need each shop's own Razorpay account or a marketplace product like Razorpay Route, plus legal advice |

### Medium

| # | Risk | What to do |
| --- | --- | --- |
| M1 | Gemini terms require the paid tier for users in the EEA, UK and Switzerland. The Terms say "India only" but nothing blocks those visitors | Acceptable for a demo; use the paid tier, or turn AI off, if you expect visitors from there |
| M2 | Backend tests ran against **MongoDB 3.6 with Mongoose 8.7.3** because newer MongoDB couldn't be downloaded in my sandbox. You'll run Mongoose 8.24 on Atlas | Run `npm test` against a scratch Atlas database before deploying (set `TEST_MONGODB_URI`) |
| M3 | Real Gemini and Razorpay calls were not tested (no keys or network access). Tests use faithful fakes of their request and response formats | Do one manual run with your Gemini key and Razorpay **test** keys before showing it to recruiters |
| M4 | Model name `gemini-3.5-flash-lite` is taken from Google's model list today; names change | Check Google's models page and set `GEMINI_MODEL` if needed |
| M5 | Data may be stored outside India, depending on where you host the database and server | Choose Atlas **Mumbai (ap-south-1)**; the privacy policy already says servers may be outside India |
| M6 | No email verification or password reset, so a person could sign up with someone else's email, and forgotten passwords can't be recovered | Disclosed on the login page. Add verification if this ever goes beyond a demo |
| M7 | "Khata.io" name: descriptive word, domain `khata.io` not verified (section 4) | Search IP India and check the domain WHOIS before launching publicly; don't use `@khata.io` emails or links unless you own the domain |
| M8 | Voice typing in Chrome sends audio to Google | Disclosed and asked before first use; optional |
| M9 | Your hosting and database providers keep their own logs (e.g. IP addresses) | Disclosed in the privacy policy |
| M10 | Accessibility was tested automatically and by keyboard, but not with a real screen reader | Do a 10-minute pass with NVDA (Windows) or TalkBack (Android) |

### Low

| # | Risk | What to do |
| --- | --- | --- |
| L1 | Rate limits are kept in memory, so they reset on restart and aren't shared across instances | Fine for one Render instance. On Vercel each running instance counts separately, so limits are looser; use a shared store (e.g. Upstash Redis) before a real launch |
| L1b | On Vercel, Atlas must accept connections from `0.0.0.0/0` because Vercel has no fixed IPs | Strong, single-database Atlas user; rotate the password if it ever leaks |
| L2 | If the database host keeps backups, deleted data remains until backups roll over | Disclosed |
| L3 | The handwriting font (Kalam) is less readable for some people | Used only at large sizes; disclosed in the accessibility statement |
| L4 | WhatsApp may restrict numbers that send many similar messages | Reminders are one at a time and user-sent |
| L5 | There is no written breach-response plan | Write a one-page plan: who checks, how to notify users and the Data Protection Board |
| L6 | Hisaab "days since last payment" counts from the first entry for customers who never paid | Labelled "(never paid)" in the table |

---

## 6. Before you publish: checklist

- [ ] Set `OPERATOR_NAME`, `CONTACT_EMAIL`, `GRIEVANCE_OFFICER`, `OPERATOR_CITY` (H2)
- [ ] Set a long random `JWT_SECRET` and `NODE_ENV=production`
- [ ] Atlas cluster in Mumbai; run `npm test` against it (M2, M5)
- [ ] Try scanning once with your Gemini key; check `GEMINI_MODEL` (M3, M4)
- [ ] Optional: Razorpay **test** keys and webhook; try one payment (M3)
- [ ] Trademark search for "KHATA" on IP India and WHOIS check for `khata.io` (M7)
- [ ] Quick screen-reader pass (M10)
- [ ] Never switch to live payment keys (H4)

---

## Sources

- [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [India's DPDP Act brought into force: dates and obligations (Hogan Lovells)](https://www.hlc.com/en/publications/indias-digital-personal-data-protection-act-2023-brought-into-force-)
- [Razorpay: Create a payment link](https://razorpay.com/docs/api/payments/payment-links/create-standard/)
- [Razorpay: Validate and test webhooks](https://razorpay.com/docs/webhooks/validate-test/)
- [Dark patterns advisory calling for self-audits (Fox Mandal)](https://foxmandal.in/News/dark-patterns-back-in-spotlight-as-new-advisory-calls-for-self-audits/)
- [OkCredit "Udhar Khata App" page](https://okcredit.in/udhar-khata-app)
