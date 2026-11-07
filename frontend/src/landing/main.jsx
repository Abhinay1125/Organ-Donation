import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import './styles.css'

const path = window.location.pathname.replace(/\/+$/, '') || '/'

// The landing page is the root entry; the sign-in page is a separate
// static entry that shares this bundle.
const isLoginRoute = /\/(login|login\.html)$/.test(path)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{isLoginRoute ? <Login /> : <App />}</React.StrictMode>,
)
