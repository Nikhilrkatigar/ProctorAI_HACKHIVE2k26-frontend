import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { checkPWAInstallation } from './utils/pwaRegister.jsx'

// Check for PWA install prompt
checkPWAInstallation()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
