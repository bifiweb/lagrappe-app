'use client'

import { useEffect, useState } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function PushBanner() {
  const { state, subscribe } = usePushNotifications()
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('push-banner-dismissed')) setDismissed(true)
    setReady(true)
  }, [])

  async function handleSubscribe() {
    await subscribe()
    dismiss()
  }

  function dismiss() {
    sessionStorage.setItem('push-banner-dismissed', '1')
    setDismissed(true)
  }

  if (!ready || dismissed || state === 'loading' || state === 'unsupported' || state === 'denied' || state === 'subscribed') return null

  return (
    <div style={{
      margin: '0 0 1rem',
      background: '#fff',
      border: '0.5px solid #e0d4cc',
      borderRadius: '12px',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <span style={{ fontSize: '22px' }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a', marginBottom: '2px' }}>
          Recevoir les annonces La Grappe
        </div>
        <div style={{ fontSize: '12px', color: '#888' }}>
          Nouveaux jeux, vins à noter, suggestions…
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button onClick={dismiss}
          style={{ padding: '6px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#888', fontSize: '12px', cursor: 'pointer' }}>
          Plus tard
        </button>
        <button onClick={handleSubscribe}
          style={{ padding: '6px 12px', border: 'none', borderRadius: '8px', background: '#8d323b', color: '#fff', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
          Activer
        </button>
      </div>
    </div>
  )
}
