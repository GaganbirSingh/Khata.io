import { Link } from 'react-router';
import { useMeta } from '../../lib/context.jsx';
import { usePage } from '../../lib/usePage.js';

// Plain-language legal pages. Values in [brackets] come from server settings
// (OPERATOR_NAME, CONTACT_EMAIL, ...) and must be filled in before going public.
// These are drafts for a student demo project and should be reviewed by a lawyer
// before real users or real money are involved.

function useLegal() {
  const meta = useMeta();
  const l = meta?.legal || {};
  return {
    name: l.operatorName || '[Your full name]',
    email: l.contactEmail || '[your-contact@email]',
    officer: l.grievanceOfficer || '[Your full name]',
    city: l.city || '[Your city], India',
    updated: l.privacyVersion || '2026-10-03',
    termsUpdated: l.termsVersion || '2026-10-03',
    retention: meta?.retentionDays || 30,
    demoHours: meta?.demoHours || 24,
    ai: meta?.ai || { enabled: false, tier: 'free' },
    payments: meta?.payments?.mode || 'demo',
  };
}

function LegalPage({ title, updated, children }) {
  usePage(title);
  return (
    <article className="container sheet prose">
      <h1>{title}</h1>
      <p className="muted small">Last updated: {updated}</p>
      {children}
    </article>
  );
}

function Mail({ email }) {
  return email.startsWith('[') ? <span>{email}</span> : <a href={`mailto:${email}`}>{email}</a>;
}

export function Privacy() {
  const L = useLegal();
  return (
    <LegalPage title="Privacy policy" updated={L.updated}>
      <p>
        Khata.io (&ldquo;the app&rdquo;, &ldquo;we&rdquo;) is a student portfolio project run by {L.name}, {L.city}. This page explains what
        personal data the app handles, why, and the choices you have. We wrote it to follow India&apos;s Digital Personal Data Protection
        Act, 2023 and its Rules.
      </p>
      <p>
        <strong>The short version:</strong> we collect only what the app needs, we don&apos;t sell or share data for advertising, there are no
        trackers or analytics, and you can download or delete everything at any time.
      </p>

      <h2>Please use sample data</h2>
      <p>
        This is a demo project, not a commercial service. Please do not enter real customers&apos; names, phone numbers or real money
        records. The demo shop uses made-up data only.
      </p>

      <h2>Who is who</h2>
      <ul>
        <li>
          <strong>Shopkeepers</strong> who create an account. For your account data, we decide how it is used, so we are the &ldquo;data
          fiduciary&rdquo;.
        </li>
        <li>
          <strong>Customers</strong> whose names and entries a shopkeeper adds. The shopkeeper decides what to record about their customers.
          We only store and process it so the shopkeeper can use the app.
        </li>
      </ul>

      <h2>What we collect and why</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Why we need it</th>
              <th scope="col">How long we keep it</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Email address and password (stored only as a one-way hash)</td>
              <td>To let you log in</td>
              <td rowSpan={5}>
                Until you delete your account, or automatically after {L.retention} days without logging in. Demo shops are deleted{' '}
                {L.demoHours} hours after they are created.
              </td>
            </tr>
            <tr>
              <td>Shop name, shop type, reminder language and tone</td>
              <td>To show your shop and write reminders the way you like</td>
            </tr>
            <tr>
              <td>Record of your agreement: which version of these terms you accepted, when, and that you confirmed you are 18 or older</td>
              <td>To show that you gave consent</td>
            </tr>
            <tr>
              <td>Customers&apos; names and (optional) mobile numbers that you add</td>
              <td>To keep the khata and open WhatsApp when you send a reminder</td>
            </tr>
            <tr>
              <td>Khata entries (amount, items, date, how it was added), reminder messages, and payment records (amount, status, payment reference)</td>
              <td>This is the khata itself</td>
            </tr>
            <tr>
              <td>Photos of khata pages</td>
              <td>To read the handwriting</td>
              <td>Not stored by us. The photo is held in memory for one request and then discarded.</td>
            </tr>
            <tr>
              <td>Login cookie</td>
              <td>To keep you logged in</td>
              <td>7 days, or until you log out. See the <Link to="/cookies">cookie policy</Link>.</td>
            </tr>
            <tr>
              <td>IDs of payment notifications from Razorpay</td>
              <td>So a payment is never counted twice</td>
              <td>30 days</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        We do <strong>not</strong> collect your name, address, date of birth, location, contacts, device identifiers or bank details. We don&apos;t
        use analytics, advertising or tracking tools of any kind.
      </p>

      <h2>Services we use</h2>
      <p>The app shares data with these services only as needed for the features you use:</p>
      <ul>
        <li>
          <strong>Database and website hosting</strong> (for example MongoDB Atlas and Render): store and serve the app. Their servers may be
          outside India. These providers may keep standard technical logs, such as IP addresses, for security under their own policies.
        </li>
        <li>
          <strong>Google Gemini</strong> {L.ai.enabled ? '(switched on)' : '(currently switched off)'}: reads khata photos, and helps read typed
          entries that our own reader could not understand. Before a typed entry is sent, names of your existing customers are replaced
          with placeholders like &ldquo;CUSTOMER_1&rdquo;. Reminder messages are written from placeholders only, so no customer details are sent.
          {L.ai.tier === 'free' && L.ai.enabled && (
            <>
              {' '}
              <strong>This demo uses Gemini&apos;s free tier.</strong> Under Google&apos;s terms, Google may use what is sent to improve its
              products and human reviewers may read it. This is why you must use sample data only.
            </>
          )}
        </li>
        <li>
          <strong>Razorpay</strong> {L.payments === 'razorpay' ? '(test mode)' : '(not used: payments are simulated)'}: when a customer pays
          through a payment link, they pay on Razorpay&apos;s page. We send Razorpay only the amount, the shop name and a reference number.
          We never see UPI PINs, card or bank details.
        </li>
        <li>
          <strong>WhatsApp</strong>: when you press &ldquo;Open in WhatsApp&rdquo;, your own WhatsApp opens with the message typed in. The
          message is sent by you, through WhatsApp, under WhatsApp&apos;s terms. We do not send anything by ourselves.
        </li>
        <li>
          <strong>Your browser&apos;s voice typing</strong> (optional): if you use the microphone button, your browser turns speech into text.
          In Google Chrome this is done by Google. We only receive the text, never audio. We ask before the first use.
        </li>
      </ul>
      <p>We do not sell personal data, and we do not share it with anyone else unless the law requires us to.</p>

      <h2>Your rights</h2>
      <ul>
        <li><strong>See your data:</strong> Settings → Download my data gives you everything we hold, as a file.</li>
        <li><strong>Correct it:</strong> edit your shop, customers and entries in the app at any time.</li>
        <li><strong>Delete it:</strong> Settings → Delete my account removes everything immediately.</li>
        <li><strong>Withdraw consent:</strong> deleting your account withdraws your consent. It is as easy as signing up.</li>
        <li><strong>Nominate someone</strong> to act for you if you die or become unable to: email us.</li>
        <li><strong>Complain:</strong> contact our grievance officer below. If you are not satisfied, you can approach the Data Protection Board of India.</li>
      </ul>
      <p>
        <strong>If you are a customer</strong> whose details a shop has added: please contact the shop first. You can also email us with the
        payment link you received, and we will help, including deleting your details.
      </p>

      <h2>Children</h2>
      <p>The app is only for people aged 18 or older. Do not add children&apos;s details.</p>

      <h2>How we protect data</h2>
      <ul>
        <li>Connections use HTTPS. Passwords are stored only as bcrypt hashes.</li>
        <li>The login cookie can&apos;t be read by JavaScript, and requests from other websites are blocked.</li>
        <li>Each shop can only see its own data. Payment links use long random codes and expire after 30 days.</li>
      </ul>
      <p>
        No system is perfectly secure. If a breach affects your data, we will tell you and the Data Protection Board of India as the law
        requires.
      </p>

      <h2>Backups</h2>
      <p>If our database host keeps backups, deleted data may remain in them until those backups are overwritten under the host&apos;s schedule.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we will show the new version in the app and ask for your agreement again where needed.</p>

      <h2>Contact and grievance officer</h2>
      <p>
        {L.officer}, {L.city}. Email: <Mail email={L.email} />. We aim to reply within 30 days.
      </p>
    </LegalPage>
  );
}

export function Terms() {
  const L = useLegal();
  return (
    <LegalPage title="Terms of use" updated={L.termsUpdated}>
      <p>
        These terms are an agreement between you and {L.name} (&ldquo;we&rdquo;), who runs Khata.io as a student portfolio project. By
        creating an account or opening the demo shop, you agree to them.
      </p>

      <h2>1. What this app is, and what it isn&apos;t</h2>
      <ul>
        <li>A demo tool to keep a record of credit (udhaar) that a shop gives its customers.</li>
        <li>It is <strong>not</strong> a bank, lender, payment company or wallet. It does not lend money, hold money or charge interest.</li>
        <li>It is not a commercial service and comes with no guarantee that it will always be available.</li>
      </ul>

      <h2>2. Who can use it</h2>
      <p>You must be 18 or older and in India. The app is not offered to people in the European Economic Area, the UK or Switzerland.</p>

      <h2>3. Use sample data only</h2>
      <p>
        Because this is a demo, please do not enter real customers&apos; details or real money records. If you do add anyone&apos;s details, you
        are responsible for having their permission and for keeping the information accurate.
      </p>

      <h2>4. Reminders must be fair</h2>
      <p>You agree not to use the app to threaten, shame, harass or mislead anyone. In particular, you will not:</p>
      <ul>
        <li>add charges, interest or penalties that the customer did not agree to;</li>
        <li>pretend to be a bank, the police, a court or the government;</li>
        <li>send reminders to people who have asked you to stop, or at unreasonable hours.</li>
      </ul>

      <h2>5. AI can make mistakes</h2>
      <p>
        Scanning and &ldquo;Bolo, likho&rdquo; can misread names or amounts. Nothing is saved until you confirm it, and you are responsible for
        checking every entry before you save it.
      </p>

      <h2>6. Payments</h2>
      <p>
        {L.payments === 'razorpay'
          ? 'Payment links use Razorpay in test mode, so no real money moves.'
          : 'Payments in this demo are simulated. No real money moves.'}{' '}
        If real payments are ever switched on, the payment is between the customer and the shop, made on Razorpay&apos;s page under
        Razorpay&apos;s terms. We never charge fees. See the <Link to="/refunds">refund policy</Link>.
      </p>

      <h2>7. Your account</h2>
      <p>
        Keep your password private. You can delete your account at any time in Settings. We may remove accounts that break these terms. Accounts
        inactive for {L.retention} days, and demo shops after {L.demoHours} hours, are deleted automatically.
      </p>

      <h2>8. Our content</h2>
      <p>
        The app&apos;s code, design and text are owned by {L.name}, except open-source parts that are used under their own licences. Your data
        stays yours.
      </p>

      <h2>9. No warranty and limits on liability</h2>
      <p>
        The app is provided &ldquo;as is&rdquo; for demonstration. As far as the law allows, we are not responsible for losses caused by mistakes
        in entries, AI readings, missed reminders or downtime. Nothing in these terms limits rights you have under the Consumer Protection Act,
        2019 or any other law that cannot be limited.
      </p>

      <h2>10. Law and disputes</h2>
      <p>
        These terms are governed by the laws of India. Courts in {L.city} have jurisdiction, subject to any rights you have to approach a
        consumer forum.
      </p>

      <h2>11. Changes and contact</h2>
      <p>
        If these terms change in a way that matters, we will ask you to agree again. Questions or complaints: {L.officer}, <Mail email={L.email} />.
      </p>
    </LegalPage>
  );
}

export function Cookies() {
  const L = useLegal();
  return (
    <LegalPage title="Cookie policy" updated={L.updated}>
      <p>
        Khata.io uses <strong>one cookie</strong>, and only to keep you logged in. It is strictly necessary for the app to work, so there is
        nothing to accept or reject. We use no advertising, analytics or tracking cookies, and no third-party cookies.
      </p>
      <h2>The cookie</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Purpose</th>
              <th scope="col">How long</th>
              <th scope="col">Set by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>uk_session</code></td>
              <td>Keeps you logged in. JavaScript cannot read it, and it is only sent to this website.</td>
              <td>7 days, or until you log out (demo: until the demo shop expires)</td>
              <td>Khata.io</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h2>Small notes stored in your browser</h2>
      <p>These are not cookies and are never sent to us:</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Purpose</th>
              <th scope="col">How long</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>uk_cookie_notice_seen</code></td>
              <td>Remembers that you closed the cookie notice</td>
              <td>Until you clear your browser data</td>
            </tr>
            <tr>
              <td><code>uk_theme</code></td>
              <td>Remembers light or dark mode, only if you choose one yourself (otherwise the site follows your device)</td>
              <td>Until you clear your browser data or pick &quot;Same as my device&quot;</td>
            </tr>
            <tr>
              <td><code>uk_voice_ok</code></td>
              <td>Remembers that you read the voice typing notice</td>
              <td>Until you close the tab</td>
            </tr>
            <tr>
              <td><code>uk_pending_payment</code></td>
              <td>On the payment page only: remembers a payment in progress while you are on Razorpay&apos;s page</td>
              <td>Until the tab is closed or the payment is confirmed</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h2>Other websites</h2>
      <p>
        If you go to Razorpay&apos;s payment page or WhatsApp, those services may set their own cookies under their own policies.
      </p>
      <h2>Your choices</h2>
      <p>
        You can block or delete cookies in your browser settings, but you will not be able to stay logged in without the session cookie.
        Questions: <Mail email={L.email} />.
      </p>
    </LegalPage>
  );
}

export function Refunds() {
  const L = useLegal();
  return (
    <LegalPage title="Refund policy" updated={L.termsUpdated}>
      <p>
        <strong>Khata.io is free.</strong> We do not charge shopkeepers or customers anything: no subscription, no fees, no hidden charges,
        and no &ldquo;convenience fee&rdquo; added to payments. So there is nothing for us to refund.
      </p>
      <h2>Payments to shops</h2>
      <ul>
        <li>
          {L.payments === 'razorpay'
            ? 'In this demo, payment links run in Razorpay test mode. No real money moves.'
            : 'In this demo, payments are simulated. No real money moves.'}
        </li>
        <li>
          If real payments were ever enabled, money paid through a link would go to the shop, not to us. Any refund, for example if you paid
          twice or paid the wrong amount, would be arranged by the shop through its payment provider.
        </li>
        <li>If a payment fails but money left your bank, it is usually reversed by your bank or UPI app automatically.</li>
      </ul>
      <h2>Need help?</h2>
      <p>
        If something looks wrong with an amount in a khata, contact the shop first. You can also email {L.officer} at <Mail email={L.email} />.
      </p>
    </LegalPage>
  );
}

export function Accessibility() {
  const L = useLegal();
  return (
    <LegalPage title="Accessibility" updated={L.updated}>
      <p>We want everyone to be able to use Khata.io. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1, level AA.</p>
      <h2>What we have done</h2>
      <ul>
        <li>Everything works with a keyboard, with a visible focus outline and a &ldquo;Skip to content&rdquo; link.</li>
        <li>Text and buttons meet AA colour-contrast levels.</li>
        <li>Money is never shown by colour alone. Words like &ldquo;baaki&rdquo;, &ldquo;jama&rdquo; and the + and − signs carry the meaning too.</li>
        <li>Forms have labels, and errors are announced to screen readers.</li>
        <li>Pop-ups keep focus inside and close with the Escape key.</li>
        <li>The chart on the Hisaab page has a table version for screen readers.</li>
        <li>Animations are turned off if your device asks for reduced motion.</li>
        <li>Pages work when zoomed to 200% and on small phone screens.</li>
      </ul>
      <h2>Known limits</h2>
      <ul>
        <li>Some names and amounts use a handwriting-style font. They are shown large to stay readable.</li>
        <li>Khata scanning needs a photo. You can always add entries by typing instead.</li>
        <li>Voice typing depends on your browser and is not available in every browser.</li>
      </ul>
      <h2>Tell us about a problem</h2>
      <p>
        If something is hard to use, email <Mail email={L.email} />. We aim to reply within 30 days.
      </p>
    </LegalPage>
  );
}
