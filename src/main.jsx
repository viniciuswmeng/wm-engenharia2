import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './tema-escuro.css'

// Aplica o tema salvo antes de desenhar a tela (evita piscar claro→escuro)
try { if (localStorage.getItem('wm-tema') === 'escuro') document.documentElement.dataset.tema = 'escuro'; } catch { /* sem storage */ }
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
