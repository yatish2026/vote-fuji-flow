import { createRoot } from 'react-dom/client'
import './index.css'

// Dynamically import App to ensure i18n initializes first
import('./App').then((AppModule) => {
  createRoot(document.getElementById("root")).render(<AppModule.default />);
});