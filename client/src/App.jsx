import { BrowserRouter, Route, Routes } from 'react-router';
import { AppProviders } from './lib/context.jsx';
import PublicLayout from './components/PublicLayout.jsx';
import AppLayout from './components/AppLayout.jsx';
import Landing from './pages/Landing.jsx';
import { AuthFlow } from './pages/Auth.jsx';
import Galla from './pages/Galla.jsx';
import Customers from './pages/Customers.jsx';
import Ledger from './pages/Ledger.jsx';
import Scan from './pages/Scan.jsx';
import Reminders from './pages/Reminders.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import Pay from './pages/Pay.jsx';
import NotFound from './pages/NotFound.jsx';
import { Privacy, Terms, Cookies, Refunds, Accessibility } from './pages/legal/Legal.jsx';

export function AppRoutes() {
  return (
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Landing />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />
            <Route path="cookies" element={<Cookies />} />
            <Route path="refunds" element={<Refunds />} />
            <Route path="accessibility" element={<Accessibility />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="app" element={<AppLayout />}>
            <Route index element={<Galla />} />
            <Route path="grahak" element={<Customers />} />
            <Route path="grahak/:id" element={<Ledger />} />
            <Route path="scan" element={<Scan />} />
            <Route path="yaad" element={<Reminders />} />
            <Route path="hisaab" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          {/* Same component on all three, so it stays mounted and can animate between cards */}
          <Route path="welcome" element={<AuthFlow mode="welcome" />} />
          <Route path="login" element={<AuthFlow mode="login" />} />
          <Route path="signup" element={<AuthFlow mode="signup" />} />
          <Route path="pay/:token" element={<Pay />} />
        </Routes>
  );
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  );
}
