import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Firebase is initialized proactively via this import if the env vars are set
import '@/config/firebase'

createRoot(document.getElementById('root')!).render(
    <App />,
)
