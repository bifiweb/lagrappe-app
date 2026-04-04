'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess('Compte créé ! Vérifie ton email pour confirmer.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Email ou mot de passe incorrect.')
      else router.push('/app/dashboard')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fdf8f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: '#8d323b', margin: '0 auto 1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '24px' }}>🍷</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '500', color: '#1a1a1a', margin: 0 }}>
            La Grappe
          </h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
            Dégustation à l'aveugle
          </p>
        </div>

        <div style={{
          background: '#fff',
          border: '0.5px solid #e0e0e0',
          borderRadius: '16px',
          padding: '2rem',
        }}>
          <div style={{
            display: 'flex',
            border: '0.5px solid #e0e0e0',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem',
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

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444', display: 'block', marginBottom: '6px' }}>
                Email
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '0.5px solid #e0e0e0', borderRadius: '8px',
                  fontSize: '14px', color: '#1a1a1a',
                  background: '#fff', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444', display: 'block', marginBottom: '6px' }}>
                Mot de passe
              </label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '0.5px solid #e0e0e0', borderRadius: '8px',
                  fontSize: '14px', color: '#1a1a1a',
                  background: '#fff', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: '#fceae8', color: '#8d2020',
                borderRadius: '8px', padding: '10px 12px',
                fontSize: '13px', marginBottom: '1rem',
              }}>{error}</div>
            )}
            {success && (
              <div style={{
                background: '#e8f5e8', color: '#1a6b1a',
                borderRadius: '8px', padding: '10px 12px',
                fontSize: '13px', marginBottom: '1rem',
              }}>{success}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px',
              background: loading ? '#c0a0a0' : '#8d323b',
              color: '#fff', border: 'none',
              borderRadius: '8px', fontSize: '14px',
              fontWeight: '500', cursor: loading ? 'default' : 'pointer',
            }}>
              {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#aaa', marginTop: '1.5rem' }}>
          Swiss Wine Challenge — La Grappe © 2025
        </p>
      </div>
    </div>
  )
}