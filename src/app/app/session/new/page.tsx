import { Suspense } from 'react'
import NewSessionClient from './client'

export default function NewSessionPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
      </div>
    }>
      <NewSessionClient />
    </Suspense>
  )
}