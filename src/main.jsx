import { createRoot } from 'react-dom/client'
import './index.css'

// Wait for i18n initialization before rendering
import { initPromise } from './i18n/config'

initPromise.then(async () => {
  const { default: App } = await import('./App');
  createRoot(document.getElementById("root")).render(<App />);
}).catch(error => {
  console.error('Failed to initialize i18n:', error);
});