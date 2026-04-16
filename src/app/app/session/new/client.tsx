'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { CHARACTERS, avatarUrl, getCharacter } from '@/lib/gameCharacters'
import type { Profile, Wine } from '@/types'

export default function NewSessionClient() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [wine, setWine] = useState<Wine | null>(null)
  const [pseudo, setPseudo] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const accent = '#8d323b'
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const wineId = params.get('wine')
  const projectId = params.get('project')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      if (prof?.display_name) setPseudo(prof.display_name)
      setSelectedAvatar(prof?.avatar ?? null)

      if (wineId) {
        const { data: w } = await supabase
          .from('wines').select('*').eq('id', wineId).single()
        setWine(w)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function createSession() {
    if (!pseudo.trim() || !wineId || !projectId || !profile) return
    setCreating(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        project_id: projectId,
        wine_id: wineId,
        bottle_number: wine?.bottle_number,
        status: 'lobby',
      })
      .select().single()

    if (error || !session) { setCreating(false); return }

    await supabase.from('session_players').insert({
      session_id: session.id,
      user_id: user.id,
      pseudo: pseudo.trim(),
      is_chef: true,
    })

    await supabase.from('profiles')
      .update({ display_name: pseudo.trim(), ...(selectedAvatar ? { avatar: selectedAvatar } : {}) })
      .eq('id', user.id)

    router.push(`/app/session/${session.id}`)
    setCreating(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>
            ‹
          </button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>
            Bouteille {wine?.bottle_number}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: wine?.type === 'rouge' ? '#f5ede8' : '#f5f3e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 }}>
            🍾
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Vin mystère
            </div>
            <div style={{ fontWeight: '500', fontSize: '18px', color: '#8d323b' }}>
              Bouteille #{wine?.bottle_number}
            </div>
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
            Ton pseudo pour cette session
          </label>
          <p style={{ fontSize: '13px', color: '#888', margin: '0 0 12px' }}>
            C'est le nom qui apparaîtra dans le classement
          </p>
          <input
            type="text"
            value={pseudo}
            onChange={e => setPseudo(e.target.value)}
            placeholder="Ex: Sophie M., Le Sommelier, Bacchus..."
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

        <div style={{ background: '#edeaf8', border: '0.5px solid #afa9ec', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#3C3489', marginBottom: '4px' }}>
            Tu joues seul ou à plusieurs ?
          </div>
          <div style={{ fontSize: '13px', color: '#534AB7', lineHeight: '1.5' }}>
            Lance la session et partage le lien à tes amis — ils pourront rejoindre et déguster en même temps que toi !
          </div>
        </div>

        <button
          onClick={createSession}
          disabled={!pseudo.trim() || creating}
          style={{
            width: '100%', padding: '14px',
            background: !pseudo.trim() || creating ? '#c0a0a0' : '#8d323b',
            color: '#fff', border: 'none',
            borderRadius: '12px', fontSize: '15px',
            fontWeight: '500', cursor: !pseudo.trim() || creating ? 'default' : 'pointer',
          }}>
          {creating ? 'Création...' : 'Lancer la session →'}
        </button>

      </div>
    </div>
  )
}