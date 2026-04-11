'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

type Mode = 'login' | 'signup' | 'forgot'

export default function LoginClient() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [redirect, setRedirect] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const r = searchParams.get('redirect')
    if (r) setRedirect(r)
  }, [])

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    const callbackUrl = redirect
      ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`
      : `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirect
            ? `${window.location.origin}/auth/confirm?redirect=${encodeURIComponent(redirect)}`
            : `${window.location.origin}/app/dashboard`,
        }
      })
      if (error) setError(error.message)
      else setSuccess(redirect
        ? 'Compte créé ! Vérifie ton email pour confirmer et rejoindre directement la session.'
        : 'Compte créé ! Vérifie ton email pour confirmer.')

    } else if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Email ou mot de passe incorrect.')
      else router.push(redirect ?? '/app/dashboard')

    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) setError(error.message)
      else setSuccess('Email envoyé ! Vérifie ta boîte mail pour réinitialiser ton mot de passe.')
    }

    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#fdf8f5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: '#fff', border: '0.5px solid #e0e0e0',
            margin: '0 auto 1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img
              src="https://cdn.shopify.com/s/files/1/0383/1660/5571/files/La-grappe-logo-fond-blanc.png?v=1718613636"
              alt="La Grappe"
              style={{ width: '40px', height: '40px', objectFit: 'contain' }}
            />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '500', color: '#1a1a1a', margin: 0 }}>
            La Grappe
          </h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
            {redirect ? 'Connecte-toi pour rejoindre la session 🍷' : 'Dégustation à l\'aveugle'}
          </p>
        </div>

        {/* Bannière session si redirect */}
        {redirect && redirect.includes('/session/') && (
          <div style={{ background: '#edeaf8', border: '0.5px solid #afa9ec', borderRadius: '12px', padding: '12px 16px', marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#3C3489', fontWeight: '500' }}>
              🍾 Tu as été invité à une dégustation !
            </div>
            <div style={{ fontSize: '12px', color: '#534AB7', marginTop: '3px' }}>
              Connecte-toi ou crée un compte pour rejoindre
            </div>
          </div>
        )}

        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '2rem' }}>

          {mode !== 'forgot' && (
            <div style={{
              display: 'flex', border: '0.5px solid #e0e0e0',
              borderRadius: '8px', overflow: 'hidden', marginBottom: '1.5rem',
            }}>
              {(['login', 'signup'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null) }}
                  style={{
                    flex: 1, padding: '9px',
                    background: mode === m ? '#8d323b' : 'transparent',
                    color: mode === m ? '#fff' : '#888',
                    border: 'none', cursor: 'pointer',
                    fontSize: '13px', fontWeight: '500',
                  }}>
                  {m === 'login' ? 'Se connecter' : 'Créer un compte'}
                </button>
              ))}
            </div>
          )}

          {mode === 'forgot' && (
            <div style={{ marginBottom: '1.5rem' }}>
              <button onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '13px', padding: 0, marginBottom: '12px' }}>
                ← Retour
              </button>
              <div style={{ fontSize: '16px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>
                Mot de passe oublié ?
              </div>
              <div style={{ fontSize: '13px', color: '#888' }}>
                Entre ton email et on t'envoie un lien pour le réinitialiser.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444', display: 'block', marginBottom: '6px' }}>
                Email
              </label>
              <input type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {mode !== 'forgot' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#444', display: 'block', marginBottom: '6px' }}>
                  Mot de passe
                </label>
                <input type="password" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginBottom: '1.5rem', marginTop: '-4px' }}>
                <button type="button"
                  onClick={() => { setMode('forgot'); setError(null); setSuccess(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8d323b', fontSize: '12px', padding: 0 }}>
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            {mode !== 'login' && <div style={{ marginBottom: '1.5rem' }} />}

            {error && (
              <div style={{ background: '#fceae8', color: '#8d2020', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '1rem' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: '#e8f5e8', color: '#1a6b1a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '1rem' }}>
                {success}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px',
              background: loading ? '#c0a0a0' : '#8d323b',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: '500',
              cursor: loading ? 'default' : 'pointer',
            }}>
              {loading ? 'Chargement...' :
                mode === 'login' ? 'Se connecter' :
                mode === 'signup' ? 'Créer mon compte' :
                'Envoyer le lien'}
            </button>
          </form>

          {mode !== 'forgot' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '1.25rem 0' }}>
                <div style={{ flex: 1, height: '0.5px', background: '#e0e0e0' }} />
                <span style={{ fontSize: '12px', color: '#aaa' }}>ou</span>
                <div style={{ flex: 1, height: '0.5px', background: '#e0e0e0' }} />
              </div>
              <button onClick={handleGoogleLogin} disabled={loading} style={{
                width: '100%', padding: '11px',
                background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '8px',
                fontSize: '14px', fontWeight: '500', color: '#1a1a1a',
                cursor: loading ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              }}>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continuer avec Google
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#aaa', marginTop: '1.5rem' }}>
          Swiss Wine Challenge — La Grappe © 2025
        </p>
      </div>
    </div>
  )
}