import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Import i18n config to initialize it
import './i18n/config'

// Small delay to ensure i18n is ready
setTimeout(() => {
  createRoot(document.getElementById("root")).render(<App />);
}, 100);