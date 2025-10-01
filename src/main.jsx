import { createRoot } from 'react-dom/client'
import './index.css'

// Ensure i18n is initialized before rendering
async function init() {
  const { i18nInitPromise } = await import('./i18n/config');
  await i18nInitPromise;
  
  const { default: App } = await import('./App');
  createRoot(document.getElementById("root")).render(<App />);
}

init();