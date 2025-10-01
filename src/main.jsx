import { createRoot } from 'react-dom/client'
import './index.css'

// Wait for i18n to fully initialize before rendering
import { initPromise } from './i18n/config'

initPromise.then(async () => {
  const { default: App } = await import('./App');
  createRoot(document.getElementById("root")).render(<App />);
});