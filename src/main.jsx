import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TeamsProvider } from './lib/TeamsContext';
import { ErrorBoundary } from './ErrorBoundary';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <TeamsProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </TeamsProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
