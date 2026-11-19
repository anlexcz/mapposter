import {createRoot} from 'react-dom/client';
import App from './wizard/App.jsx';
import './wizard/styles.css';
import 'maplibre-gl/dist/maplibre-gl.css';
createRoot(document.getElementById('root')!).render(<App/>);
