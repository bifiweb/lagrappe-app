'use client'

import { useEffect, useState } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function PushBanner() {
  const { state, subscribe, unsubscribe } = usePushNotifications()
  const [ready, setReady] = useState(false)

  useEffect(() => { setReady(true) }, [])

  if (!ready || state === 'loading' || state === 'unsupported') return null

  const isOn = state === 'subscribed'
  const isDenied = state === 'denied'

  return (
    <div style={{
      margin: '0 0 1rem',
      background: '#fff',
      border: '0.5px solid #e0e0e0',
      borderRadius: '12px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <span style={{ fontSize: '20px' }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>
          Notifications La Grappe
        </div>
        <div style={{ fontSize: '12px', color: '#888', marginTop: '1px' }}>
          {isDenied ? 'Bloqué dans les paramètres du navigateur' : 'Annonces, nouveaux jeux, suggestions…'}
        </div>
      </div>
      {isDenied ? (
        <span style={{ fontSize: '12px', color: '#aaa' }}>Bloqué</span>
      ) : (
        <button
          onClick={() => isOn ? unsubscribe() : subscribe()}
          disabled={state === 'loading'}
          style={{
            position: 'relative', width: '44px', height: '26px', borderRadius: '13px',
            border: 'none', cursor: 'pointer', flexShrink: 0,
            background: isOn ? '#8d323b' : '#e0e0e0',
            transition: 'background .2s',
          }}>
          <span style={{
            position: 'absolute', top: '3px',
            left: isOn ? '21px' : '3px',
            width: '20px', height: '20px', borderRadius: '50%',
            background: '#fff', transition: 'left .2s',
            boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }} />
        </button>
      )}
    </div>
  )
}
