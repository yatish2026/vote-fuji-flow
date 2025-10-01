import { createRoot } from 'react-dom/client'
import './index.css'

// Import and wait for i18n initialization before rendering
import('./i18n/config').then(() => {
  // Now import and render the app after i18n is ready
  import('./App').then((AppModule) => {
    createRoot(document.getElementById("root")).render(<AppModule.default />);
  });
});