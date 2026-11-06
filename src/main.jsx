import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { useStore } from './store.js';
import './styles.css';

window.__store = useStore; // handy for debugging / automated tests

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
