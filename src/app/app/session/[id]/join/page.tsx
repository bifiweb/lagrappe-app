'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { CHARACTERS, avatarUrl, getCharacter } from '@/lib/gameCharacters'
import type { Session, Wine } from '@/types'

export default function JoinSessionPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [wine, setWine] = useState<Wine | null>(null)
  const [pseudo, setPseudo] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [alreadyJoined, setAlreadyJoined] = useState(false)
  const accent = '#8d323b'
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const sessionId = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/auth/login?redirect=/app/session/${sessionId}/join`)
        return
      }

      const { data: sess } = await supabase
        .from('sessions').select('*').eq('id', sessionId).single()
      setSession(sess)

      if (sess) {
        const { data: w } = await supabase
          .from('wines').select('*').eq('id', sess.wine_id).single()
        setWine(w)

        // Vérifier si déjà dans la session
        const { data: existing } = await supabase
          .from('session_players')
          .select('*')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .single()

        if (existing) {
          setAlreadyJoined(true)
          router.push(`/app/session/${sessionId}`)
          return
        }

        // Pré-remplir avec le display_name
        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', user.id).single()
        if (prof?.display_name) setPseudo(prof.display_name)
        setSelectedAvatar(prof?.avatar ?? null)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function joinSession() {
    if (!pseudo.trim()) return
    setJoining(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('session_players').insert({
      session_id: sessionId,
      user_id: user.id,
      pseudo: pseudo.trim(),
      avatar: selectedAvatar ?? null,
      is_chef: false,
    })

    await supabase.from('profiles')
      .update({ display_name: pseudo.trim(), ...(selectedAvatar ? { avatar: selectedAvatar } : {}) })
      .eq('id', user.id)

    router.push(`/app/session/${sessionId}`)
    setJoining(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#8d323b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px' }}>🍷</span>
          </div>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>Rejoindre la session</span>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: wine?.type === 'rouge' ? '#f5ede8' : '#f5f3e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 }}>
            🍾
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Tu es invité à déguster</div>
            <div style={{ fontWeight: '500', fontSize: '18px', color: '#8d323b' }}>Bouteille #{session?.bottle_number}</div>
            <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>
              {wine?.type === 'rouge' ? 'Vin rouge' : wine?.type === 'blanc' ? 'Vin blanc' : wine?.type}
            </div>
          </div>
        </div>

        {/* Avatar */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', display: 'block', marginBottom: '12px' }}>
            Ton personnage Wine Mode
          </label>
          {(() => {
            const char = selectedAvatar ? getCharacter(selectedAvatar) : null
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: editingAvatar ? '16px' : 0 }}>
                <div onClick={() => setEditingAvatar(v => !v)} style={{ position: 'relative', width: '60px', height: '60px', cursor: 'pointer', flexShrink: 0 }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: selectedAvatar ? 'transparent' : accent, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: `2px solid ${selectedAvatar ? accent : 'transparent'}` }}>
                    {selectedAvatar
                      ? <img src={avatarUrl(selectedAvatar, char?.skinColor)} width={60} height={60} alt={char?.label ?? selectedAvatar} style={{ objectFit: 'cover', display: 'block' }} />
                      : <span style={{ fontSize: '22px', color: '#fff' }}>🎭</span>}
                  </div>
                  {char && <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: '20px', lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>{char.emoji}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>
                    {char ? char.label : 'Aucun personnage'}
                  </div>
                  <button onClick={() => setEditingAvatar(v => !v)} style={{ marginTop: '4px', padding: '4px 12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#888', fontSize: '12px', cursor: 'pointer' }}>
                    {editingAvatar ? 'Fermer' : '✏️ Changer'}
                  </button>
                </div>
              </div>
            )
          })()}
          {editingAvatar && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', justifyItems: 'center' }}>
                {CHARACTERS.map(char => (
                  <button key={char.seed} onClick={() => { setSelectedAvatar(char.seed); setEditingAvatar(false) }}
                    title={char.label}
                    style={{ position: 'relative', width: '50px', height: '50px', padding: 0, borderRadius: '50%', overflow: 'visible', border: selectedAvatar === char.seed ? `3px solid ${accent}` : '3px solid transparent', background: 'transparent', cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#f5ede8' }}>
                      <img src={avatarUrl(char.seed, char.skinColor)} width={50} height={50} alt={char.label} loading="lazy" style={{ display: 'block' }} />
                    </div>
                    <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: '16px', lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>{char.emoji}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', display: 'block', marginBottom: '6px' }}>
            Ton pseudo
          </label>
          <p style={{ fontSize: '13px', color: '#888', margin: '0 0 12px' }}>
            C'est le nom qui apparaîtra dans le classement
          </p>
          <input
            type="text"
            value={pseudo}
            onChange={e => setPseudo(e.target.value)}
            placeholder="Ex: Sophie M., Le Sommelier..."
            maxLength={30}
            style={{
              width: '100%', padding: '10px 12px',
              border: '0.5px solid #e0e0e0', borderRadius: '8px',
              fontSize: '14px', color: '#1a1a1a',
              background: '#fff', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          onClick={joinSession}
          disabled={!pseudo.trim() || joining}
          style={{
            width: '100%', padding: '14px',
            background: !pseudo.trim() || joining ? '#c0a0a0' : '#8d323b',
            color: '#fff', border: 'none',
            borderRadius: '12px', fontSize: '15px',
            fontWeight: '500', cursor: !pseudo.trim() || joining ? 'default' : 'pointer',
          }}>
          {joining ? 'Connexion...' : 'Rejoindre la dégustation →'}
        </button>
      </div>
    </div>
  )
}