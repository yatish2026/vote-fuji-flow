import { createRoot } from 'react-dom/client'
import './index.css'
import { initPromise } from './i18n/config'

// Wait for i18n to initialize before rendering the app
initPromise.then(() => {
  import('./App').then((AppModule) => {
    createRoot(document.getElementById("root")).render(<AppModule.default />);
  });
});