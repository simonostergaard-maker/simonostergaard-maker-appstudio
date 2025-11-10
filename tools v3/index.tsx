import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import './src/styles/global.css';

// Set workerSrc for pdf.js
if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
