/*
 * ============================================================
 * FILE    : main.jsx
 * LAYER   : Entry point
 * PURPOSE : Mounts the React 18 app into #root. Wraps the tree
 *           with BrowserRouter (routing) and AuthProvider (auth
 *           state). Order matters — AuthProvider must be inside
 *           BrowserRouter so context functions can call useNavigate
 *           if needed in future.
 * DEPENDS : react, react-dom, react-router-dom, ./App, ./index.css,
 *           ./context/auth_context
 * ============================================================
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/auth_context'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)