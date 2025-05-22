import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { Analytics } from '@vercel/analytics/react';

ReactDOM.render(
  <>
    <Analytics />
    <App />
  </>,
  document.getElementById('root')
);
