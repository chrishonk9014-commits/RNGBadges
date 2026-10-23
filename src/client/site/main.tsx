import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/martian-mono/wdth.css';
import '@fontsource-variable/figtree';
import '../styles.css';
import './site.css';
import { warmUp } from './engine';
import { Site } from './Site';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Site />
  </StrictMode>,
);
warmUp();
