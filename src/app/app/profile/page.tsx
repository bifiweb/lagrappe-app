'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile, Tasting } from '@/types'
import { CHARACTERS, avatarUrl, getCharacter } from '@/lib/gameCharacters'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const accent = '#8d323b'

interface BadgeDef {
  id: string
  icon: string
  name: string
  desc: string
  category: 'jeu' | 'cave' | 'mixte'
}

const BADGE_DEFS: BadgeDef[] = [
  { id: 'first_game',       icon: '🍇', name: 'Premier verre',      desc: '1ère session jouée',                  category: 'jeu' },
  { id: 'regular',          icon: '🥂', name: 'Habitué',             desc: '5 sessions jouées',                   category: 'jeu' },
  { id: 'vigneron',         icon: '🏆', name: 'Vigneron',            desc: '15 sessions jouées',                  category: 'jeu' },
  { id: 'sommelier',        icon: '🎓', name: 'Sommelier',           desc: '30 sessions jouées',                  category: 'jeu' },
  { id: 'grand_cru',        icon: '🏅', name: 'Grand cru',           desc: '>800 pts en une session',             category: 'jeu' },
  { id: 'millesime_master', icon: '📅', name: 'Millésimé',           desc: 'Millésime exact trouvé 3×',           category: 'jeu' },
  { id: 'price_hunter',     icon: '💰', name: 'Chasseur de prix',    desc: 'Prix exact trouvé 3×',                category: 'jeu' },
  { id: 'nez_fin',          icon: '🎯', name: 'Nez fin',             desc: 'Arômes trouvés dans 70% des sessions', category: 'jeu' },
  { id: 'first_gem',        icon: '💎', name: 'Premier joyau',       desc: '1er vin noté dans la cave',           category: 'cave' },
  { id: 'collector',        icon: '🗃️', name: 'Collectionneur',      desc: '10 vins notés',                       category: 'cave' },
  { id: 'encyclopediste',   icon: '📚', name: 'Encyclopédiste',      desc: '25 vins notés',                       category: 'cave' },
  { id: 'coup_de_coeur',    icon: '❤️', name: 'Coup de cœur',        desc: 'Un vin noté 9 ou 10/10',             category: 'cave' },
  { id: 'sans_concession',  icon: '🙅', name: 'Sans concession',     desc: 'Un vin noté 0 ou 1/10',              category: 'cave' },
  { id: 'fidele',           icon: '🔄', name: 'Fidèle',              desc: '"Rachèterais" coché 5×',              category: 'cave' },
  { id: 'fin_palais',       icon: '⭐', name: 'Fin palais',          desc: 'Note moy. ≥ 7/10 (min. 5 notes)',    category: 'mixte' },
  { id: 'touche_a_tout',    icon: '🌈', name: 'Touche-à-tout',       desc: '5 cépages distincts',                 category: 'mixte' },
  { id: 'bouteille_or',     icon: '🍾', name: 'Bouteille d\'or',     desc: '50 dégustations au total',            category: 'mixte' },
  { id: 'expert',           icon: '🦅', name: 'Expert',              desc: 'Nez fin + Collectionneur + Fin palais', category: 'mixte' },
]

const BADGE_BORDER: Record<BadgeDef['category'], string> = {
  jeu:   '#c4a882',
  cave:  '#9ec4b8',
  mixte: '#b8a89e',
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tastings, setTastings] = useState<Tasting[]>([])
  const [caveRatings, setCaveRatings] = useState<any[]>([])
  const [cepages, setCepages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()
  const { state: pushState, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications()

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
        .from('tastings').select('*').eq('user_id', user.id)
        .not('submitted_at', 'is', null)
      setTastings(t ?? [])

      const { data: cr } = await supabase
        .from('cave_ratings').select('stars, racheterait, wine_id').eq('user_id', user.id)
      setCaveRatings(cr ?? [])

      if (cr && cr.length > 0) {
        const wineIds = cr.map((r: any) => r.wine_id)
        const { data: wines } = await supabase
          .from('catalog_wines').select('cepage').in('id', wineIds)
        const unique = [...new Set((wines ?? []).map((w: any) => w.cepage).filter(Boolean))]
        setCepages(unique as string[])
      }

      setLoading(false)
    }
    load()
  }, [])

  async function saveName() {
    if (!profile || !displayName.trim()) return
    setSaving(true)
    await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', profile.id)
    setProfile({ ...profile, display_name: displayName.trim() })
    setSaving(false)
    setSuccess(true)
    setEditingName(false)
    setTimeout(() => setSuccess(false), 2000)
  }

  async function saveAvatar(seed: string) {
    if (!profile) return
    setSelectedAvatar(seed)
    await supabase.from('profiles').update({ avatar: seed }).eq('id', profile.id)
    setProfile({ ...profile, avatar: seed })
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

  // --- Stats ---
  const totalPtsJeu = tastings.reduce((sum, t) => sum + (t.total_points ?? 0), 0)
  const sessionScores = tastings.filter(t => t.score_perso !== null).map(t => t.score_perso as number)
  const caveScores = caveRatings.filter(r => r.stars !== null).map((r: any) => r.stars as number)
  const allScores = [...sessionScores, ...caveScores]
  const avgAll = allScores.length
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length * 10) / 10
    : null
  const totalDegustations = tastings.length + caveRatings.length
  const moyParSession = tastings.length ? Math.round(totalPtsJeu / tastings.length) : null

  const cepageCorrect  = tastings.filter(t => t.pts_cepage === 1000).length
  const regionCorrect  = tastings.filter(t => t.pts_region === 1000).length
  const millesimeCorrect = tastings.filter(t => t.pts_millesime === 500).length
  const prixCorrect    = tastings.filter(t => t.pts_prix === 500).length
  const aromesAvecPts  = tastings.filter(t => (t.pts_aromes ?? 0) > 0).length
  const aromesRate     = tastings.length ? Math.round(aromesAvecPts / tastings.length * 100) : 0

  const aromeCounts: Record<string, number> = {}
  tastings.forEach(t => (t.aromes ?? []).forEach(a => { aromeCounts[a] = (aromeCounts[a] || 0) + 1 }))
  const topAromes = Object.entries(aromeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // --- Badges ---
  const nez_fin_ok   = tastings.length >= 3 && aromesRate >= 70
  const collector_ok = caveRatings.length >= 10
  const fin_palais_ok = allScores.length >= 5 && avgAll !== null && avgAll >= 7

  const unlockedIds = new Set<string>()
  if (tastings.length >= 1)  unlockedIds.add('first_game')
  if (tastings.length >= 5)  unlockedIds.add('regular')
  if (tastings.length >= 15) unlockedIds.add('vigneron')
  if (tastings.length >= 30) unlockedIds.add('sommelier')
  if (tastings.some(t => t.total_points > 800)) unlockedIds.add('grand_cru')
  if (tastings.filter(t => t.pts_millesime === 500).length >= 3) unlockedIds.add('millesime_master')
  if (tastings.filter(t => t.pts_prix === 500).length >= 3) unlockedIds.add('price_hunter')
  if (nez_fin_ok) unlockedIds.add('nez_fin')
  if (caveRatings.length >= 1)  unlockedIds.add('first_gem')
  if (collector_ok) unlockedIds.add('collector')
  if (caveRatings.length >= 25) unlockedIds.add('encyclopediste')
  if (caveRatings.some((r: any) => r.stars !== null && r.stars >= 9)) unlockedIds.add('coup_de_coeur')
  if (caveRatings.some((r: any) => r.stars !== null && r.stars <= 1)) unlockedIds.add('sans_concession')
  if (caveRatings.filter((r: any) => r.racheterait === true).length >= 5) unlockedIds.add('fidele')
  if (fin_palais_ok) unlockedIds.add('fin_palais')
  if (cepages.length >= 5) unlockedIds.add('touche_a_tout')
  if (totalDegustations >= 50) unlockedIds.add('bouteille_or')
  if (nez_fin_ok && collector_ok && fin_palais_ok) unlockedIds.add('expert')

  const sortedBadges = [...BADGE_DEFS].sort((a, b) =>
    (unlockedIds.has(a.id) ? 0 : 1) - (unlockedIds.has(b.id) ? 0 : 1)
  )

  const char = selectedAvatar ? getCharacter(selectedAvatar) : null
  const initials = (profile?.display_name ?? profile?.email ?? '?')[0].toUpperCase()

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

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

          <div onClick={() => setEditingAvatar(true)}
            style={{ position: 'relative', width: '88px', height: '88px', margin: '0 auto 6px', cursor: 'pointer' }}>
            <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontWeight: '600', color: '#fff', overflow: 'hidden', border: `2.5px solid ${selectedAvatar ? accent : '#e0e0e0'}` }}>
              {selectedAvatar
                ? <img src={avatarUrl(selectedAvatar)} width={88} height={88} alt={char?.label ?? ''} style={{ objectFit: 'cover', display: 'block' }} />
                : <span style={{ color: accent }}>{initials}</span>
              }
            </div>
          </div>

          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '2px' }}>
            {char ? char.label : '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#bbb', marginBottom: '14px', cursor: 'pointer' }} onClick={() => setEditingAvatar(true)}>
            ✏️ Changer d'avatar
          </div>

          {editingAvatar && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: '#444', marginBottom: '12px', fontWeight: '500' }}>Choisis ton avatar</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {CHARACTERS.map(c => (
                  <button key={c.seed} onClick={() => saveAvatar(c.seed)}
                    title={c.label}
                    style={{ padding: '4px', borderRadius: '10px', border: selectedAvatar === c.seed ? `2px solid ${accent}` : '2px solid transparent', background: selectedAvatar === c.seed ? '#fdf0ee' : 'transparent', cursor: 'pointer' }}>
                    <div style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', background: '#f5ede8' }}>
                      <img src={avatarUrl(c.seed)} width={56} height={56} alt={c.label} loading="lazy" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setEditingAvatar(false)}
                style={{ marginTop: '12px', padding: '6px 16px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          )}

          {editingName ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="Ton prénom ou pseudo" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                style={{ padding: '8px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '15px', outline: 'none', textAlign: 'center', width: '180px' }} />
              <button onClick={saveName} disabled={saving}
                style={{ padding: '8px 14px', background: accent, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                {saving ? '...' : '✓'}
              </button>
              <button onClick={() => { setEditingName(false); setDisplayName(profile?.display_name ?? '') }}
                style={{ padding: '8px 14px', background: '#f5f5f5', color: '#888', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>
                {profile?.display_name ?? 'Pas de pseudo'}
              </div>
              <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>{profile?.email}</div>
              <button onClick={() => setEditingName(true)}
                style={{ padding: '7px 16px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#444', fontSize: '13px', cursor: 'pointer' }}>
                ✏️ Modifier le pseudo
              </button>
            </div>
          )}

          {success && <div style={{ marginTop: '10px', fontSize: '13px', color: '#27500A' }}>✓ Pseudo mis à jour !</div>}
        </div>

        {/* Notifications */}
        {pushState !== 'unsupported' && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '12px' }}>Notifications</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#1a1a1a', fontWeight: '500' }}>Annonces La Grappe</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                  {pushState === 'denied' ? 'Bloqué dans les paramètres du navigateur' : 'Nouveaux jeux, vins à noter, suggestions…'}
                </div>
              </div>
              {pushState === 'denied' ? (
                <span style={{ fontSize: '12px', color: '#aaa' }}>Bloqué</span>
              ) : (
                <button onClick={() => pushState === 'subscribed' ? pushUnsubscribe() : pushSubscribe()}
                  disabled={pushState === 'loading'}
                  style={{ position: 'relative', width: '44px', height: '26px', borderRadius: '13px', border: 'none', cursor: pushState === 'loading' ? 'default' : 'pointer', background: pushState === 'subscribed' ? accent : '#e0e0e0', transition: 'background .2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: '3px', left: pushState === 'subscribed' ? '21px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>Mes chiffres</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
            {[
              { label: 'Vins dégustés', value: totalDegustations, emoji: '🍷' },
              { label: 'Cépages',       value: cepages.length || '—', emoji: '🍇' },
              { label: 'Note moy.',     value: avgAll !== null ? `${avgAll}/10` : '—', emoji: '⭐' },
            ].map(({ label, value, emoji }) => (
              <div key={label} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '12px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', marginBottom: '4px' }}>{emoji}</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: accent }}>{value}</div>
                <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[
              { label: 'Sessions jeu',  value: tastings.length, emoji: '🎮' },
              { label: 'Points totaux', value: totalPtsJeu.toLocaleString(), emoji: '🏆' },
              { label: 'Moy./session',  value: moyParSession?.toLocaleString() ?? '—', emoji: '📊' },
            ].map(({ label, value, emoji }) => (
              <div key={label} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '12px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', marginBottom: '4px' }}>{emoji}</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: accent }}>{value}</div>
                <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Taux de réussite */}
        {tastings.length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '12px' }}>Taux de réussite</div>
            {[
              { label: 'Cépage',    correct: cepageCorrect,   emoji: '🍇' },
              { label: 'Région',    correct: regionCorrect,   emoji: '📍' },
              { label: 'Millésime', correct: millesimeCorrect, emoji: '📅' },
              { label: 'Prix',      correct: prixCorrect,     emoji: '💰' },
              { label: 'Arômes',   correct: aromesAvecPts,   emoji: '👃' },
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
        {topAromes.length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>Mes arômes préférés</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {topAromes.map(([arome, count]) => (
                <span key={arome} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '12px', background: '#f5ede8', color: accent, fontWeight: '500' }}>
                  {arome} · {count}×
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Badges */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>
            Badges · {unlockedIds.size}/{BADGE_DEFS.length}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {sortedBadges.map(b => {
              const unlocked = unlockedIds.has(b.id)
              return (
                <div key={b.id} style={{
                  background: '#fff',
                  border: unlocked ? `1.5px solid ${BADGE_BORDER[b.category]}` : '0.5px solid #ebebeb',
                  borderRadius: '12px',
                  padding: '12px 8px',
                  textAlign: 'center',
                  opacity: unlocked ? 1 : 0.4,
                  transition: 'opacity .3s',
                }}>
                  <div style={{ fontSize: '28px', marginBottom: '5px' }}>{b.icon}</div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#1a1a1a', marginBottom: '3px', lineHeight: '1.2' }}>{b.name}</div>
                  <div style={{ fontSize: '9px', color: '#aaa', lineHeight: '1.3' }}>{b.desc}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <button onClick={handleLogout}
          style={{ width: '100%', padding: '12px', border: '0.5px solid #fca5a5', borderRadius: '10px', background: '#fff', color: '#dc2626', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}>
          Se déconnecter →
        </button>

      </div>
    </div>
  )
}
