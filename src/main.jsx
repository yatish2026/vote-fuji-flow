import { createRoot } from 'react-dom/client'
import './index.css'

// Wait for i18n to fully initialize before rendering anything
(async () => {
  const { i18nInitPromise } = await import('./i18n/config');
  await i18nInitPromise;
  
  // Only after i18n is ready, import and render the app
  const { default: App } = await import('./App');
  const root = createRoot(document.getElementById("root"));
  root.render(<App />);
})();