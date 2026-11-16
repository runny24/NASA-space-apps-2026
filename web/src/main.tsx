import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';
// Two small faces for the story, self-hosted (docs/SOURCES.md): no font is fetched from another server.
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/geist-mono/latin-500.css';
// After styles.css on purpose: the motion tokens and rules, then the story's own styles.
import './styles/motion.css';
import './styles/about.css';
import './story/story.css';
// The year as a curve, above the timeline and in the story (components/YearCurve.tsx); static.
import './styles/curve.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing <div id="root">');
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
