'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile, Tasting } from '@/types'

const AVATAR_SEEDS = [
  'Warrior','Pirate','Ninja','Wizard','Viking',
  'Vampire','Cowboy','Samurai','Hunter','Knight',
  'Rogue','Mage','Bard','Ranger','Monk',
  'Druid','Berserker','Assassin','Sorcerer','Paladin',
]

function avatarUrl(seed: string) {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tastings, setTastings] = useState<Tasting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      setDisplayName(prof?.display_name ?? '')
      setSelectedAvatar(prof?.avatar ?? null)

      const { data: t } = await supabase
        .from('tastings')
        .select('*')
        .eq('user_id', user.id)
        .not('submitted_at', 'is', null)
      setTastings(t ?? [])

      setLoading(false)
    }
    load()
  }, [])

  async function saveName() {
    if (!profile || !displayName.trim()) return
    setSaving(true)
    await supabase.from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', profile.id)
    setProfile({ ...profile, display_name: displayName.trim() })
    setSaving(false)
    setSuccess(true)
    setEditingName(false)
    setTimeout(() => setSuccess(false), 2000)
  }

  async function saveAvatar(emoji: string) {
    if (!profile) return
    setSelectedAvatar(emoji)
    await supabase.from('profiles').update({ avatar: emoji }).eq('id', profile.id)
    setProfile({ ...profile, avatar: emoji })
    setEditingAvatar(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  const accent = '#8d323b'
  const totalPoints = tastings.reduce((sum, t) => sum + (t.total_points ?? 0), 0)
  const avgScore = tastings.filter(t => t.score_perso !== null).length
    ? Math.round(tastings.filter(t => t.score_perso !== null).reduce((sum, t) => sum + (t.score_perso ?? 0), 0) / tastings.filter(t => t.score_perso !== null).length * 10) / 10
    : null
  const cepageCorrect = tastings.filter(t => t.pts_cepage === 1000).length
  const regionCorrect = tastings.filter(t => t.pts_region === 1000).length
  const millesimeCorrect = tastings.filter(t => t.pts_millesime === 500).length
  const prixCorrect = tastings.filter(t => t.pts_prix === 500).length

  const initials = (profile?.display_name ?? profile?.email ?? '?')[0].toUpperCase()

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>Mon profil</span>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Avatar + nom */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>
          <div
            onClick={() => setEditingAvatar(true)}
            title="Changer l'avatar Wine Mode"
            style={{ width: '80px', height: '80px', borderRadius: '50%', background: selectedAvatar ? 'transparent' : accent, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: '28px', fontWeight: '500', color: '#fff', cursor: 'pointer', overflow: 'hidden', border: `2px solid ${selectedAvatar ? accent : 'transparent'}`, transition: 'border-color .2s' }}
          >
            {selectedAvatar
              ? <img src={avatarUrl(selectedAvatar)} width={80} height={80} alt={selectedAvatar} style={{ objectFit: 'cover' }} />
              : initials}
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '14px', cursor: 'pointer' }} onClick={() => setEditingAvatar(true)}>
            ✏️ Avatar Wine Mode{selectedAvatar ? ` · ${selectedAvatar}` : ''}
          </div>

          {editingAvatar && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: '#444', marginBottom: '12px', fontWeight: '500' }}>Choisis ton personnage</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', justifyItems: 'center' }}>
                {AVATAR_SEEDS.map(seed => (
                  <button key={seed} onClick={() => saveAvatar(seed)}
                    title={seed}
                    style={{
                      width: '56px', height: '56px', padding: 0,
                      borderRadius: '50%', overflow: 'hidden',
                      border: selectedAvatar === seed ? `3px solid ${accent}` : '3px solid transparent',
                      background: '#f5ede8',
                      cursor: 'pointer', transition: 'border-color .15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <img src={avatarUrl(seed)} width={56} height={56} alt={seed} loading="lazy" style={{ display: 'block' }} />
                  </button>
                ))}
              </div>
              <button onClick={() => setEditingAvatar(false)} style={{ marginTop: '12px', padding: '6px 16px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          )}

          {editingName ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="Ton prénom ou pseudo"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                style={{ padding: '8px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '15px', outline: 'none', textAlign: 'center', width: '180px' }} />
              <button onClick={saveName} disabled={saving}
                style={{ padding: '8px 14px', background: accent, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                {saving ? '...' : '✓'}
              </button>
              <button onClick={() => { setEditingName(false); setDisplayName(profile?.display_name ?? '') }}
                style={{ padding: '8px 14px', background: '#f5f5f5', color: '#888', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>
                {profile?.display_name ?? 'Pas de pseudo'}
              </div>
              <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
                {profile?.email}
              </div>
              <button onClick={() => setEditingName(true)}
                style={{ padding: '7px 16px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#444', fontSize: '13px', cursor: 'pointer' }}>
                ✏️ Modifier le pseudo
              </button>
            </div>
          )}

          {success && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: '#27500A' }}>✓ Pseudo mis à jour !</div>
          )}
        </div>

        {/* Stats globales */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>
            Mes stats
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '8px' }}>
            {[
              { label: 'Vins dégustés', value: tastings.length, emoji: '🍷' },
              { label: 'Points totaux', value: totalPoints.toLocaleString(), emoji: '⭐' },
              { label: 'Note moyenne', value: avgScore !== null ? `${avgScore}/10` : '—', emoji: '❤️' },
              { label: 'Moy. par dégustation', value: tastings.length ? Math.round(totalPoints / tastings.length).toLocaleString() : '—', emoji: '📊' },
            ].map(({ label, value, emoji }) => (
              <div key={label} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{emoji}</div>
                <div style={{ fontSize: '18px', fontWeight: '500', color: accent }}>{value}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Taux de réussite */}
        {tastings.length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '12px' }}>
              Taux de réussite
            </div>
            {[
              { label: 'Cépage', correct: cepageCorrect, emoji: '🍇' },
              { label: 'Région', correct: regionCorrect, emoji: '📍' },
              { label: 'Millésime', correct: millesimeCorrect, emoji: '📅' },
              { label: 'Prix', correct: prixCorrect, emoji: '💰' },
            ].map(({ label, correct, emoji }) => {
              const pct = tastings.length ? Math.round(correct / tastings.length * 100) : 0
              return (
                <div key={label} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px' }}>{emoji}</span>
                    <span style={{ fontSize: '13px', color: '#444', flex: 1 }}>{label}</span>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: pct >= 50 ? '#27500A' : accent }}>
                      {correct}/{tastings.length} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: '4px', background: '#f0f0f0', borderRadius: '2px' }}>
                    <div style={{ height: '4px', borderRadius: '2px', background: pct >= 50 ? '#3B6D11' : accent, width: `${pct}%`, transition: 'width .6s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Arômes favoris */}
        {tastings.length > 0 && (() => {
          const aromeCounts: Record<string, number> = {}
          tastings.forEach(t => {
            (t.aromes ?? []).forEach(a => {
              aromeCounts[a] = (aromeCounts[a] || 0) + 1
            })
          })
          const top = Object.entries(aromeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
          return top.length > 0 ? (
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>
                Mes arômes préférés
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {top.map(([arome, count]) => (
                  <span key={arome} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '12px', background: '#f5ede8', color: accent, fontWeight: '500' }}>
                    {arome} · {count}x
                  </span>
                ))}
              </div>
            </div>
          ) : null
        })()}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={() => router.push('/app/cave')}
            style={{ width: '100%', padding: '12px', border: '0.5px solid #e0e0e0', borderRadius: '10px', background: '#fff', color: '#444', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}>
            🍷 Ma cave →
          </button>
          <button onClick={handleLogout}
            style={{ width: '100%', padding: '12px', border: '0.5px solid #fca5a5', borderRadius: '10px', background: '#fff', color: '#dc2626', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}>
            Déconnexion →
          </button>
        </div>

      </div>
    </div>
  )
}