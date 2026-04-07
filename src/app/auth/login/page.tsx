import { Suspense } from 'react'
import LoginClient from './client'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5' }}>
        <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
      </div>
    }>
      <LoginClient />
    </Suspense>
  )
}