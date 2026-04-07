'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.')
      return
    }
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else {
      setSuccess(true)
      setTimeout(() => router.push('/app/dashboard'), 2000)
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
            Nouveau mot de passe
          </h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
            Choisis un nouveau mot de passe
          </p>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '2rem' }}>
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '1rem' }}>✅</div>
              <div style={{ fontSize: '15px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>
                Mot de passe mis à jour !
              </div>
              <div style={{ fontSize: '13px', color: '#888' }}>
                Redirection en cours...
              </div>
            </div>
          ) : (
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#444', display: 'block', marginBottom: '6px' }}>
                  Nouveau mot de passe
                </label>
                <input type="password" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#444', display: 'block', marginBottom: '6px' }}>
                  Confirmer le mot de passe
                </label>
                <input type="password" required value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {error && (
                <div style={{ background: '#fceae8', color: '#8d2020', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '1rem' }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '13px',
                background: loading ? '#c0a0a0' : '#8d323b',
                color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '14px', fontWeight: '500', cursor: loading ? 'default' : 'pointer',
              }}>
                {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#aaa', marginTop: '1.5rem' }}>
          Swiss Wine Challenge — La Grappe © 2025
        </p>
      </div>
    </div>
  )
}