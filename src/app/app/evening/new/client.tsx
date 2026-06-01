'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { CHARACTERS, avatarUrl, getCharacter } from '@/lib/gameCharacters'
import type { Profile, Wine, Project } from '@/types'

const accent = '#8d323b'

export default function NewEveningClient() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [wines, setWines] = useState<Wine[]>([])
  const [selectedWineIds, setSelectedWineIds] = useState<string[]>([])
  const [pseudo, setPseudo] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const projectId = params.get('project')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      if (prof?.display_name) setPseudo(prof.display_name)
      setSelectedAvatar(prof?.avatar ?? null)

      if (projectId) {
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single()
        setProject(proj)

        const { data: w } = await supabase.from('wines').select('*').eq('project_id', projectId).order('bottle_number')
        setWines(w ?? [])
        setSelectedWineIds((w ?? []).map((x: Wine) => x.id))
      }
      setLoading(false)
    }
    load()
  }, [])

  function toggleWine(wineId: string) {
    setSelectedWineIds(prev =>
      prev.includes(wineId) ? prev.filter(id => id !== wineId) : [...prev, wineId]
    )
  }

  async function createEvening() {
    if (!pseudo.trim() || selectedWineIds.length < 1 || !projectId || !profile) return
    setCreating(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const orderedWines = wines.filter(w => selectedWineIds.includes(w.id))
    const bottleOrder = orderedWines.map(w => w.id)
    const firstWine = orderedWines[0]

    const { data: evening, error: eveningErr } = await supabase
      .from('evenings')
      .insert({
        project_id: projectId,
        chef_id: user.id,
        mode: 'continuous',
        bottle_order: bottleOrder,
        status: 'lobby',
      })
      .select().single()

    if (eveningErr || !evening) { setCreating(false); return }

    const { data: session, error: sessErr } = await supabase
      .from('sessions')
      .insert({
        project_id: projectId,
        wine_id: firstWine.id,
        bottle_number: firstWine.bottle_number,
        evening_id: evening.id,
        order_in_evening: 1,
        status: 'lobby',
      })
      .select().single()

    if (sessErr || !session) { setCreating(false); return }

    await supabase.from('session_players').insert({
      session_id: session.id,
      user_id: user.id,
      pseudo: pseudo.trim(),
      avatar: selectedAvatar ?? null,
      is_chef: false,
      evening_id: evening.id,
    })

    await supabase.from('profiles')
      .update({ display_name: pseudo.trim(), ...(selectedAvatar ? { avatar: selectedAvatar } : {}) })
      .eq('id', user.id)

    router.push(`/app/evening/${evening.id}`)
    setCreating(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  const wineTypeColor = (type: string) => {
    if (type === 'rouge') return '#f5ede8'
    if (type === 'blanc') return '#f5f3e0'
    if (type === 'rose') return '#fdf0f0'
    return '#f0f0f0'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>
            ‹
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>Créer une soirée</div>
            <div style={{ fontSize: '11px', color: '#888' }}>{project?.name}</div>
          </div>
          <div style={{ background: '#edeaf8', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', color: '#6B4FAE', fontWeight: '500' }}>
            🎉 Soirée
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Sélection des vins */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>
            Quelles bouteilles ce soir ?
          </div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
            {selectedWineIds.length} bouteille{selectedWineIds.length > 1 ? 's' : ''} sélectionnée{selectedWineIds.length > 1 ? 's' : ''}
            {selectedWineIds.length > 1 ? ` — dans l'ordre du catalogue` : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {wines.map(wine => {
              const selected = selectedWineIds.includes(wine.id)
              const orderIndex = selectedWineIds.indexOf(wine.id)
              return (
                <div key={wine.id}
                  onClick={() => toggleWine(wine.id)}
                  style={{
                    background: selected ? wineTypeColor(wine.type) : '#fff',
                    border: selected ? `1.5px solid ${accent}` : '0.5px solid #e0e0e0',
                    borderRadius: '14px', padding: '1rem',
                    cursor: 'pointer', textAlign: 'center',
                    position: 'relative',
                    transition: 'border-color .15s',
                  }}>
                  {selected && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: accent, color: '#fff',
                      fontSize: '10px', fontWeight: '700',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {orderIndex + 1}
                    </div>
                  )}
                  <div style={{ fontSize: '22px', marginBottom: '6px' }}>{selected ? '🍾' : '○'}</div>
                  <div style={{ fontWeight: '600', fontSize: '20px', color: selected ? accent : '#bbb' }}>
                    {wine.bottle_number}
                  </div>
                  <div style={{ fontSize: '10px', color: selected ? '#888' : '#ccc', marginTop: '2px' }}>
                    {wine.type}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Avatar */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', display: 'block', marginBottom: '12px' }}>
            Ton personnage
          </label>
          {(() => {
            const char = selectedAvatar ? getCharacter(selectedAvatar) : null
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: editingAvatar ? '16px' : 0 }}>
                <div onClick={() => setEditingAvatar(v => !v)} style={{ position: 'relative', width: '52px', height: '52px', cursor: 'pointer', flexShrink: 0 }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: selectedAvatar ? 'transparent' : accent, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: `2px solid ${selectedAvatar ? accent : 'transparent'}` }}>
                    {selectedAvatar
                      ? <img src={avatarUrl(selectedAvatar, char?.skinColor)} width={52} height={52} alt={char?.label ?? selectedAvatar} style={{ objectFit: 'cover', display: 'block' }} />
                      : <span style={{ fontSize: '22px', color: '#fff' }}>🎭</span>}
                  </div>
                  {char && <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: '18px', lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>{char.emoji}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>{char ? char.label : 'Aucun personnage'}</div>
                  <button onClick={() => setEditingAvatar(v => !v)} style={{ marginTop: '4px', padding: '4px 12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#888', fontSize: '12px', cursor: 'pointer' }}>
                    {editingAvatar ? 'Fermer' : '✏️ Changer'}
                  </button>
                </div>
              </div>
            )
          })()}
          {editingAvatar && (
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', justifyItems: 'center' }}>
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
          )}
        </div>

        {/* Pseudo */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', display: 'block', marginBottom: '6px' }}>
            Ton pseudo
          </label>
          <input
            type="text"
            value={pseudo}
            onChange={e => setPseudo(e.target.value)}
            placeholder="Ex: Sophie M., Le Sommelier..."
            maxLength={30}
            style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {selectedWineIds.length < 2 && (
          <div style={{ background: '#fff8e1', border: '0.5px solid #ffe082', borderRadius: '12px', padding: '12px 16px', marginBottom: '1rem', fontSize: '13px', color: '#8a6900' }}>
            Sélectionne au moins 2 bouteilles pour une soirée continue
          </div>
        )}

        <button
          onClick={createEvening}
          disabled={!pseudo.trim() || selectedWineIds.length < 2 || creating}
          style={{
            width: '100%', padding: '14px',
            background: (!pseudo.trim() || selectedWineIds.length < 2 || creating) ? '#c0a0a0' : accent,
            color: '#fff', border: 'none', borderRadius: '12px',
            fontSize: '15px', fontWeight: '500',
            cursor: (!pseudo.trim() || selectedWineIds.length < 2 || creating) ? 'default' : 'pointer',
          }}>
          {creating ? 'Création...' : `Créer la soirée (${selectedWineIds.length} bouteilles) →`}
        </button>

      </div>
    </div>
  )
}
