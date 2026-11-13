// Live demo build: the whole app in one page, with the API running in the browser.
import './mockApi.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/kalam/latin-400.css';
import '@fontsource/kalam/latin-700.css';
import '@fontsource/kalam/latin-ext-400.css';
import '@fontsource/kalam/latin-ext-700.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-ext-500.css';
import '../styles.css';
import { initTheme } from '../lib/theme.js';
import { AppRoutes } from '../App.jsx';
import { AppProviders } from '../lib/context.jsx';

initTheme();
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProviders>
  </StrictMode>
);
