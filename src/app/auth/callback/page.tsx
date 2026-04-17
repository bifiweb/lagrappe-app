'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    async function handle() {
      const code = searchParams.get('code')
      const redirect = searchParams.get('redirect') ?? '/app/dashboard'

      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      }

      router.replace(redirect)
    }
    handle()
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: '#fdf8f5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '1rem' }}>🍷</div>
        <div style={{ fontSize: '15px', color: '#888' }}>Connexion en cours...</div>
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  )
}
