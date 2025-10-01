import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Wait for i18n to initialize before rendering
import('./i18n/config').then(() => {
  createRoot(document.getElementById("root")).render(<App />);
});