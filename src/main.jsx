import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TeamsProvider } from './lib/TeamsContext';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TeamsProvider>
      <App />
    </TeamsProvider>
  </React.StrictMode>
);
