import { createRoot } from 'react-dom/client'
import './index.css'
import { i18nInitPromise } from './i18n/config'

// Wait for i18n to initialize before rendering
i18nInitPromise.then(() => {
  import('./App').then((AppModule) => {
    createRoot(document.getElementById("root")).render(<AppModule.default />);
  });
});