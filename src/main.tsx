import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import '@fontsource-variable/dm-sans';
import { store } from './app/store';
import { App } from './presentation/App';
import './presentation/styles.css';
import './presentation/responsive.css';
import './presentation/guide.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Provider store={store}><App /></Provider></React.StrictMode>);
