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
    getCurrentSubscription()
      .then((sub) => setState(sub ? 'subscribed' : 'unsubscribed'))
      .catch(() => setState('unsubscribed'))
  }, [])

  async function subscribe() {
    setState('loading')
    try {
      const sub = await registerPushSubscription()
      if (!sub) { setState('unsubscribed'); return }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setState('unsubscribed'); return }

      const json = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      setState('subscribed')
    } catch {
      setState('unsubscribed')
    }
  }

  async function unsubscribe() {
    setState('loading')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const sub = await getCurrentSubscription()
      const endpoint = sub?.endpoint
      await unregisterPushSubscription()
      if (session) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ endpoint }),
        })
      }
    } finally {
      setState('unsubscribed')
    }
  }

  return { state, subscribe, unsubscribe }
}
