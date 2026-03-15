import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root');

const root = createRoot(rootEl);
root.render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryInner>
      {children}
    </ErrorBoundaryInner>
  );
}

class ErrorBoundaryInner extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          background: '#0f172a',
          color: '#e2e8f0',
          minHeight: '100vh',
        }}>
          <h1 style={{ color: '#f87171' }}>Something went wrong</h1>
          <pre style={{ overflow: 'auto', fontSize: '0.875rem' }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
