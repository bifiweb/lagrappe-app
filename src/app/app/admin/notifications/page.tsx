'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface SentNotification {
  id: string
  title: string
  body: string
  url: string | null
  sent_at: string
  recipients: number
}

export default function AdminNotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<SentNotification[]>([])
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/app/dashboard'); return }

      const [{ count }, { data: hist }] = await Promise.all([
        supabase.from('push_subscriptions').select('*', { count: 'exact', head: true }),
        supabase.from('push_notifications').select('*').order('sent_at', { ascending: false }).limit(20),
      ])
      setSubscriberCount(count ?? 0)
      setHistory(hist ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function send() {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url: url.trim() || '/' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setResult({ type: 'success', msg: `Envoyé à ${json.recipients} appareil(s)` })
      setTitle('')
      setBody('')
      setUrl('')
      // Refresh history
      const { data: hist } = await supabase
        .from('push_notifications').select('*').order('sent_at', { ascending: false }).limit(20)
      setHistory(hist ?? [])
    } catch (err: any) {
      setResult({ type: 'error', msg: err.message })
    } finally {
      setSending(false)
    }
  }

  const accent = '#8d323b'

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>🔔 Notifications push</span>
          <span style={{ fontSize: '13px', color: '#888' }}>
            {subscriberCount !== null ? `${subscriberCount} abonné(s)` : ''}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Formulaire d'envoi */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '14px' }}>
            Nouvelle annonce
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Titre *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Nouveau jeu La Grappe disponible !"
                maxLength={80}
                style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Message *</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Découvrez notre nouvelle sélection de vins suisses…"
                maxLength={200}
                rows={3}
                style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}
              />
              <div style={{ fontSize: '11px', color: '#aaa', textAlign: 'right', marginTop: '2px' }}>{body.length}/200</div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Lien au clic (optionnel)</label>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="/app/cave/pepites"
                style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {result && (
            <div style={{
              marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
              background: result.type === 'success' ? '#f0faf0' : '#fff5f5',
              color: result.type === 'success' ? '#27500A' : '#dc2626',
              border: `0.5px solid ${result.type === 'success' ? '#bbf0bb' : '#fca5a5'}`,
            }}>
              {result.type === 'success' ? '✓ ' : '✕ '}{result.msg}
            </div>
          )}

          <button
            onClick={send}
            disabled={sending || !title.trim() || !body.trim()}
            style={{
              marginTop: '14px', width: '100%', padding: '12px',
              background: sending || !title.trim() || !body.trim() ? '#e0e0e0' : accent,
              color: sending || !title.trim() || !body.trim() ? '#aaa' : '#fff',
              border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500',
              cursor: sending || !title.trim() || !body.trim() ? 'default' : 'pointer',
              transition: 'background .15s',
            }}>
            {sending ? 'Envoi en cours…' : `Envoyer à tous les abonnés`}
          </button>
        </div>

        {/* Historique */}
        {history.length > 0 && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>
              Historique
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.map(n => (
                <div key={n.id} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>{n.title}</div>
                    <div style={{ fontSize: '11px', color: '#aaa', flexShrink: 0, marginLeft: '8px' }}>
                      {n.recipients} envoi(s)
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>{n.body}</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>
                    {new Date(n.sent_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {n.url && n.url !== '/' && ` · ${n.url}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '14px' }}>
            Aucune notification envoyée pour l'instant
          </div>
        )}
      </div>
    </div>
  )
}
