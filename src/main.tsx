import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './wizard/App';
import './wizard/styles.css';
import 'maplibre-gl/dist/maplibre-gl.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
