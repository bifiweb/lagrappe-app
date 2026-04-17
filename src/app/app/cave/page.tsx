'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile, Tasting, Wine, GrappisteNotes, SessionPlayer } from '@/types'

interface GameEntry {
  type: 'game'
  date: string
  tasting: Tasting
  wine: Wine
  notes: GrappisteNotes | null
  players: SessionPlayer[]
  sessionId: string
}

interface RatingEntry {
  type: 'rating'
  date: string
  rating: any
  wine: Wine
  notes: GrappisteNotes | null
}

type CaveEntry = GameEntry | RatingEntry

const accent = '#8d323b'

function MiniStars({ score, outOf10 = false }: { score: number | null, outOf10?: boolean }) {
  if (score === null) return <span style={{ fontSize: '12px', color: '#bbb' }}>Non noté</span>
  const stars = outOf10 ? score / 2 : score
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: '13px', color: stars >= i ? '#f0a000' : '#ddd' }}>★</span>
      ))}
      <span style={{ fontSize: '11px', color: '#888', marginLeft: '2px' }}>
        {outOf10 ? `${score}/10` : `${score}/5`}
      </span>
    </div>
  )
}

export default function CavePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [entries, setEntries] = useState<CaveEntry[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      // Source 1 : sessions du jeu
      const { data: tastings } = await supabase
        .from('tastings').select('*').eq('user_id', user.id)
        .not('submitted_at', 'is', null).order('created_at', { ascending: false })

      const sessionIds = tastings?.map(t => t.session_id) ?? []
      const { data: sessions } = sessionIds.length
        ? await supabase.from('sessions').select('*').in('id', sessionIds)
        : { data: [] }

      // Source 2 : ratings manuels (cave à pépites)
      const { data: ratings } = await supabase
        .from('cave_ratings').select('*').eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      const ratingWineIds = ratings?.map(r => r.wine_id) ?? []

      // Tous les wine_ids combinés
      const gameWineIds = sessions?.map(s => s.wine_id) ?? []
      const allWineIds = [...new Set([...gameWineIds, ...ratingWineIds])]

      if (!allWineIds.length) { setLoading(false); return }

      const { data: wines } = await supabase.from('wines').select('*').in('id', allWineIds)
      const { data: allNotes } = await supabase.from('grappiste_notes').select('*').in('wine_id', allWineIds)
      const { data: allPlayers } = sessionIds.length
        ? await supabase.from('session_players').select('*').in('session_id', sessionIds)
        : { data: [] }

      const gameEntries: GameEntry[] = (tastings ?? []).map(t => {
        const session = sessions?.find(s => s.id === t.session_id)
        const wine = wines?.find(w => w.id === session?.wine_id)
        const notes = allNotes?.find(n => n.wine_id === wine?.id) ?? null
        const players = allPlayers?.filter(p => p.session_id === t.session_id) ?? []
        return { type: 'game', date: t.created_at, tasting: t, wine: wine!, notes, players, sessionId: t.session_id }
      }).filter(e => e.wine) as GameEntry[]

      const ratingEntries: RatingEntry[] = (ratings ?? []).map(r => {
        const wine = wines?.find(w => w.id === r.wine_id)
        if (!wine) return null
        // ne pas doublon-ner un vin déjà dans le jeu
        const alreadyInGame = gameEntries.some(e => e.wine.id === wine.id)
        if (alreadyInGame) return null
        const notes = allNotes?.find(n => n.wine_id === wine.id) ?? null
        return { type: 'rating', date: r.updated_at, rating: r, wine, notes }
      }).filter(Boolean) as RatingEntry[]

      // Fusionner et trier par date
      const all: CaveEntry[] = [...gameEntries, ...ratingEntries]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setEntries(all)
      setLoading(false)
    }
    load()
  }, [])

  const totalPts = entries.filter(e => e.type === 'game').reduce((sum, e) => sum + ((e as GameEntry).tasting.total_points ?? 0), 0)
  const totalVins = entries.length

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement de ta cave...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>Ma cave</span>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Accès cave à pépites */}
        <div onClick={() => router.push('/app/cave/pepites')}
          style={{ background: 'linear-gradient(135deg, #8d323b 0%, #b84d5a 100%)', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '36px', lineHeight: 1 }}>💎</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '500', fontSize: '15px', color: '#fff', marginBottom: '3px' }}>La cave à pépites</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>Découvre & note tous les vins La Grappe</div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '20px' }}>›</div>
        </div>

        {/* Stats */}
        {entries.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
            {[
              { label: 'Vins dégustés', value: totalVins },
              { label: 'Points de jeu', value: totalPts.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '.875rem', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a' }}>{value}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: '13px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '12px' }}>
          Mes dégustations
        </div>

        {entries.length === 0 ? (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '1rem' }}>🍾</div>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>Ta cave est vide !</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.5rem' }}>
              Joue une session ou note un vin dans la cave à pépites
            </div>
            <button onClick={() => router.push('/app/dashboard')}
              style={{ padding: '10px 20px', background: accent, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
              Commencer →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {entries.map(entry => {
              const entryId = entry.type === 'game' ? (entry as GameEntry).tasting.id : (entry as RatingEntry).rating.id
              const isOpen = expanded === entryId
              const { wine, notes } = entry
              const isGame = entry.type === 'game'
              const gameEntry = isGame ? entry as GameEntry : null
              const ratingEntry = !isGame ? entry as RatingEntry : null

              return (
                <div key={entryId} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', overflow: 'hidden' }}>

                  <div onClick={() => setExpanded(isOpen ? null : entryId)}
                    style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>

                    {notes?.image_url ? (
                      <img src={notes.image_url} alt=""
                        style={{ width: '48px', height: '72px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '48px', height: '72px', borderRadius: '8px', background: wine?.type === 'rouge' ? '#f5ede8' : '#f5f3e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>🍾</div>
                    )}

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: '500', fontSize: '15px', color: '#1a1a1a' }}>
                          {notes ? `${notes.cepage} ${notes.millesime}` : `Bouteille #${wine?.bottle_number}`}
                        </span>
                        <span style={{ fontSize: '10px', background: isGame ? '#edeaf8' : '#e8f5e8', color: isGame ? '#3C3489' : '#27500A', padding: '2px 7px', borderRadius: '6px' }}>
                          {isGame ? '🎮 Jeu' : '📖 Cave'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>{notes?.region ?? wine?.type}</div>

                      {isGame && gameEntry?.players && gameEntry.players.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          {gameEntry.players.map(p => (
                            <span key={p.id} style={{ fontSize: '11px', background: '#f5f5f5', color: '#666', padding: '2px 8px', borderRadius: '8px' }}>{p.pseudo}</span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {isGame
                          ? <MiniStars score={gameEntry?.tasting.score_perso ?? null} outOf10 />
                          : <MiniStars score={ratingEntry?.rating.stars ?? null} />
                        }
                        {isGame && (
                          <div style={{ fontSize: '14px', fontWeight: '500', color: accent }}>
                            {gameEntry?.tasting.total_points.toLocaleString()} pts
                          </div>
                        )}
                        <div style={{ fontSize: '16px', color: '#888' }}>{isOpen ? '▲' : '▼'}</div>
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: '0.5px solid #f0f0f0', padding: '1rem 1.25rem', background: '#fdf8f5' }}>

                      {isGame && gameEntry ? (
                        <>
                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>Points du jeu</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {[
                                { l: 'Robe', v: gameEntry.tasting.pts_robe },
                                { l: 'Arômes', v: gameEntry.tasting.pts_aromes },
                                { l: 'Bouche', v: gameEntry.tasting.pts_bouche },
                                { l: 'Prix', v: gameEntry.tasting.pts_prix },
                                { l: 'Millésime', v: gameEntry.tasting.pts_millesime },
                                { l: 'Cépage', v: gameEntry.tasting.pts_cepage },
                                { l: 'Région', v: gameEntry.tasting.pts_region },
                              ].map(({ l, v }) => (
                                <div key={l} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '6px 10px', textAlign: 'center' }}>
                                  <div style={{ fontSize: '13px', fontWeight: '500', color: accent }}>{v}</div>
                                  <div style={{ fontSize: '10px', color: '#888' }}>{l}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                          {gameEntry.tasting.notes_libres && (
                            <div style={{ marginBottom: '1rem', fontSize: '13px', color: '#666', fontStyle: 'italic', background: '#fff', borderRadius: '8px', padding: '10px 12px' }}>
                              "{gameEntry.tasting.notes_libres}"
                            </div>
                          )}
                          <button onClick={() => router.push(`/app/session/${gameEntry.sessionId}/reveal`)}
                            style={{ width: '100%', padding: '10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#1a1a1a', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                            Voir le reveal →
                          </button>
                        </>
                      ) : ratingEntry ? (
                        <>
                          {ratingEntry.rating.notes_degustation && (
                            <div style={{ marginBottom: '1rem', fontSize: '13px', color: '#666', fontStyle: 'italic', background: '#fff', borderRadius: '8px', padding: '10px 12px' }}>
                              "{ratingEntry.rating.notes_degustation}"
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                            {ratingEntry.rating.design_rating && (
                              <div style={{ flex: 1, background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '13px', fontWeight: '500', color: accent }}>{ratingEntry.rating.design_rating}/5</div>
                                <div style={{ fontSize: '10px', color: '#888' }}>Design</div>
                              </div>
                            )}
                            {ratingEntry.rating.valeur_rating && (
                              <div style={{ flex: 1, background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '13px', fontWeight: '500', color: accent }}>{ratingEntry.rating.valeur_rating}/5</div>
                                <div style={{ fontSize: '10px', color: '#888' }}>Qualité/prix</div>
                              </div>
                            )}
                            {ratingEntry.rating.racheterait !== null && (
                              <div style={{ flex: 1, background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '16px' }}>{ratingEntry.rating.racheterait ? '✅' : '❌'}</div>
                                <div style={{ fontSize: '10px', color: '#888' }}>Racheter</div>
                              </div>
                            )}
                          </div>
                          {ratingEntry.rating.notes_libres && (
                            <div style={{ fontSize: '13px', color: '#666', fontStyle: 'italic', background: '#fff', borderRadius: '8px', padding: '10px 12px', marginBottom: '1rem' }}>
                              "{ratingEntry.rating.notes_libres}"
                            </div>
                          )}
                          <button onClick={() => router.push('/app/cave/pepites')}
                            style={{ width: '100%', padding: '10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: accent, fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                            Modifier ma note →
                          </button>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
