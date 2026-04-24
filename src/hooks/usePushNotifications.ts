'use client'

import { useState, useEffect } from 'react'
import { registerPushSubscription, unregisterPushSubscription, getCurrentSubscription } from '@/lib/pushClient'
import { createClient } from '@/lib/supabase/client'

export type PushState = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading')
  const supabase = createClient()

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    getCurrentSubscription().then((sub) => {
      setState(sub ? 'subscribed' : 'unsubscribed')
    })
  }, [])

  async function subscribe() {
    setState('loading')
    try {
      const sub = await registerPushSubscription()
      if (!sub) { setState('unsubscribed'); return }

      const json = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      setState('subscribed')
    } catch {
      setState('unsubscribed')
    }
  }

  async function unsubscribe() {
    setState('loading')
    const sub = await getCurrentSubscription()
    const endpoint = sub?.endpoint
    await unregisterPushSubscription()
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    })
    setState('unsubscribed')
  }

  return { state, subscribe, unsubscribe }
}
