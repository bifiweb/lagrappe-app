'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Profile, Session, SessionPlayer, Wine, Project, CepageRating } from '@/types'

const MEDAL = ['🥇', '🥈', '🥉']
const RANK_COLORS = ['#C9A227', '#9E9E9E', '#CD7F32']

function computeBordaRanks(allRatings: CepageRating[], players: SessionPlayer[], wines: Wine[]) {
  const N = wines.length
  const bordaTotal: Record<string, number> = {}
  wines.forEach(w => { bordaTotal[w.id] = 0 })

  players.forEach(player => {
    const playerRatings = wines.map(w => {
      const r = allRatings.find(r => r.user_id === player.user_id && r.wine_id === w.id)
      return { wineId: w.id, score: r?.score ?? 0 }
    })

    // Trier par score desc pour déterminer les rangs
    const sorted = [...playerRatings].sort((a, b) => b.score - a.score)

    // Borda : rang 1 = N pts, rang 2 = N-1 pts, etc. (égalités = même rang)
    let rank = 0
    sorted.forEach((item, i) => {
      if (i === 0 || sorted[i - 1].score > item.score) rank = i + 1
      bordaTotal[item.wineId] += Math.max(0, N - rank + 1)
    })
  })

  return bordaTotal
}

function getPlayerRanking(ratings: CepageRating[], userId: string, wines: Wine[]) {
  return wines
    .map(w => {
      const r = ratings.find(r => r.user_id === userId && r.wine_id === w.id)
      return { wine: w, score: r?.score ?? 0 }
    })
    .sort((a, b) => b.score - a.score)
}

export default function CepageResultsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [players, setPlayers] = useState<SessionPlayer[]>([])
  const [wines, setWines] = useState<Wine[]>([])
  const [allRatings, setAllRatings] = useState<CepageRating[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'final' | 'players'>('final')

  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const sessionId = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: sess } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
      setSession(sess)

      if (sess?.project_id) {
        const { data: proj } = await supabase.from('projects').select('*').eq('id', sess.project_id).single()
        setProject(proj)

        const { data: w } = await supabase.from('wines').select('*, grappiste_notes(*)').eq('project_id', sess.project_id).order('bottle_number')
        setWines(w ?? [])
      }

      const { data: pl } = await supabase.from('session_players').select('*').eq('session_id', sessionId)
      setPlayers(pl ?? [])

      const { data: ratings } = await supabase.from('cepage_ratings').select('*').eq('session_id', sessionId)
      setAllRatings(ratings ?? [])

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Calcul des résultats...</div>
    </div>
  )

  const cepageName = project?.cepage_name ?? 'Cépage'
  const accent = '#8d323b'

  const bordaTotal = computeBordaRanks(allRatings, players, wines)
  const wineSortedByBorda = [...wines].sort((a, b) => (bordaTotal[b.id] ?? 0) - (bordaTotal[a.id] ?? 0))

  // Calcul du score moyen par vin
  const avgScores: Record<string, number> = {}
  wines.forEach(w => {
    const wineRatings = allRatings.filter(r => r.wine_id === w.id)
    avgScores[w.id] = wineRatings.length > 0
      ? Math.round(wineRatings.reduce((s, r) => s + r.score, 0) / wineRatings.length)
      : 0
  })

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#C9A227', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px' }}>🏆</span>
          </div>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>Résultats — {cepageName}</span>
          <span style={{ fontSize: '11px', background: '#faeeda', color: '#633806', padding: '3px 10px', borderRadius: '10px', fontWeight: '500' }}>Borda</span>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Podium top 3 */}
        {wineSortedByBorda.length >= 2 && (
          <div style={{ background: 'linear-gradient(135deg, #faeeda, #fdf8f5)', border: '0.5px solid #d0a090', borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '13px', color: '#888', marginBottom: '4px' }}>Classement final</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a1a' }}>
                {MEDAL[0]} Bouteille {wineSortedByBorda[0]?.bottle_number} gagne !
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {wineSortedByBorda.map((wine, idx) => {
                const borda = bordaTotal[wine.id] ?? 0
                const avg = avgScores[wine.id] ?? 0
                const isFirst = idx === 0
                return (
                  <div key={wine.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: isFirst ? '#fff' : 'transparent',
                    border: isFirst ? `1.5px solid ${RANK_COLORS[0] ?? '#e0e0e0'}` : 'none',
                    borderRadius: '12px', padding: isFirst ? '12px 14px' : '6px 2px',
                  }}>
                    <span style={{ fontSize: idx < 3 ? '22px' : '14px', fontWeight: '700', color: RANK_COLORS[idx] ?? '#888', width: '28px', textAlign: 'center', flexShrink: 0 }}>
                      {idx < 3 ? MEDAL[idx] : `${idx + 1}.`}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>Bouteille {wine.bottle_number}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>Moy. {avg}/100</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: accent }}>{borda}</div>
                      <div style={{ fontSize: '10px', color: '#aaa' }}>pts Borda</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Onglets */}
        <div style={{ display: 'flex', border: '0.5px solid #e0e0e0', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.25rem' }}>
          {(['final', 'players'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ flex: 1, padding: '10px', background: activeTab === tab ? accent : 'transparent', color: activeTab === tab ? '#fff' : '#888', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
              {tab === 'final' ? '📊 Classement final' : '👤 Par joueur'}
            </button>
          ))}
        </div>

        {/* Tab classement final — détail Borda */}
        {activeTab === 'final' && (
          <div>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Méthode Borda — chaque joueur classe les vins du meilleur au moins bon
              </div>
              {wineSortedByBorda.map((wine, idx) => {
                const borda = bordaTotal[wine.id] ?? 0
                const maxBorda = bordaTotal[wineSortedByBorda[0]?.id ?? ''] ?? 1
                const barWidth = Math.round((borda / maxBorda) * 100)
                return (
                  <div key={wine.id} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>{idx < 3 ? MEDAL[idx] : `${idx + 1}.`}</span>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>Bouteille {wine.bottle_number}</span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: accent }}>{borda} pts</span>
                    </div>
                    <div style={{ background: '#f5f5f5', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barWidth}%`, background: idx === 0 ? '#C9A227' : accent, borderRadius: '4px', transition: 'width .6s' }} />
                    </div>
                    {/* Scores par joueur pour ce vin */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {players.map(player => {
                        const r = allRatings.find(r => r.user_id === player.user_id && r.wine_id === wine.id)
                        return (
                          <span key={player.id} style={{ fontSize: '11px', background: '#f5f5f5', color: '#666', padding: '2px 8px', borderRadius: '10px' }}>
                            {player.pseudo} : {r?.score ?? '—'}/100
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tab par joueur */}
        {activeTab === 'players' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {players.map(player => {
              const ranking = getPlayerRanking(allRatings, player.user_id, wines)
              const isMe = player.user_id === profile?.id
              return (
                <div key={player.id} style={{ background: '#fff', border: isMe ? `1.5px solid ${accent}` : '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <PlayerAvatar avatar={player.avatar} pseudo={player.pseudo} size={36} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>{player.pseudo}</div>
                      {isMe && <div style={{ fontSize: '11px', color: accent }}>Moi</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {ranking.map((item, idx) => (
                      <div key={item.wine.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '13px', color: idx < 3 ? RANK_COLORS[idx] : '#aaa', fontWeight: '600', width: '22px', flexShrink: 0 }}>
                          {idx + 1}.
                        </span>
                        <span style={{ flex: 1, fontSize: '13px', color: '#444' }}>Bouteille {item.wine.bottle_number}</span>
                        <span style={{ fontSize: '15px', fontWeight: '700', color: accent }}>{item.score}<span style={{ fontSize: '11px', fontWeight: '400', color: '#aaa' }}>/100</span></span>
                      </div>
                    ))}
                  </div>

                  {/* Notes/arômes notables */}
                  {ranking.some(r => {
                    const rating = allRatings.find(rt => rt.user_id === player.user_id && rt.wine_id === r.wine.id)
                    return rating && (rating.aromes.length > 0 || rating.tasting_note)
                  }) && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid #f0f0f0' }}>
                      {ranking.map(item => {
                        const rating = allRatings.find(rt => rt.user_id === player.user_id && rt.wine_id === item.wine.id)
                        if (!rating || (rating.aromes.length === 0 && !rating.tasting_note)) return null
                        return (
                          <div key={item.wine.id} style={{ marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#888' }}>B{item.wine.bottle_number} </span>
                            {rating.aromes.length > 0 && (
                              <span style={{ fontSize: '11px', color: '#666' }}>{rating.aromes.join(', ')}. </span>
                            )}
                            {rating.tasting_note && (
                              <span style={{ fontSize: '11px', color: '#444', fontStyle: 'italic' }}>{rating.tasting_note}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Retour au dashboard */}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button onClick={() => router.push('/app/dashboard')}
            style={{ padding: '12px 28px', background: 'transparent', border: `0.5px solid ${accent}`, borderRadius: '10px', color: accent, fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}>
            ← Retour au dashboard
          </button>
        </div>

      </div>
    </div>
  )
}
