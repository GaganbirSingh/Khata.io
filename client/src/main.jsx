import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import './styles.css';
import { initTheme } from './lib/theme.js';
import App from './App.jsx';

initTheme();
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
