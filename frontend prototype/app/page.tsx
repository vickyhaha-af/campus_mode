'use client'

import dynamic from 'next/dynamic'
import '../src/index.css'

// Dynamically import the React SPA root to avoid SSR issues with BrowserRouter
const App = dynamic(() => import('../src/App'), { ssr: false })

export default function Page() {
  return <App />
}
