import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import i18n from './i18n/config'

// Wait for i18n to be fully initialized before rendering
const renderApp = () => {
  createRoot(document.getElementById("root")).render(<App />);
};

if (i18n.isInitialized) {
  renderApp();
} else {
  i18n.on('initialized', renderApp);
}