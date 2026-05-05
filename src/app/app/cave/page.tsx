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
const SCORE_EMOJIS = ['😫','😞','😕','😐','😏','🙂','😊','😋','😁','🤩','😍']
const SCORE_LABELS = ['Imbuvable','Très mauvais','Mauvais','Bof','Correct','Moyen','Bien','Très bien','Excellent','Sublime','Légendaire !']
const DESIGN_LABELS = ['Moche','Pas très joli','Moyen','Joli','Magnifique']
const PRICE_LABELS = ['Bradé','Abordable','Juste prix','Cher','Trop cher']

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

function AppreciationBlock({ score, notesDeg, design, valeur, racheterait }: {
  score: number | null, notesDeg: string | null,
  design: number | null, valeur: number | null, racheterait: boolean | null
}) {
  const hasAny = score !== null || notesDeg || design || valeur || racheterait !== null
  if (!hasAny) return (
    <div style={{ fontSize: '12px', color: '#bbb', fontStyle: 'italic', marginBottom: '12px' }}>Aucune appréciation enregistrée</div>
  )
  return (
    <div style={{ marginBottom: '12px' }}>
      {score !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '32px', lineHeight: 1 }}>{SCORE_EMOJIS[score]}</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>{score}/10</div>
            <div style={{ fontSize: '11px', color: '#888' }}>{SCORE_LABELS[score]}</div>
          </div>
        </div>
      )}
      {notesDeg && (
        <div style={{ fontSize: '13px', color: '#666', fontStyle: 'italic', background: '#fff', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px' }}>
          "{notesDeg}"
        </div>
      )}
      {(design || valeur || racheterait !== null) && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {design && (
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: accent }}>{'★'.repeat(design)}{'☆'.repeat(5 - design)}</div>
              <div style={{ fontSize: '10px', color: '#888' }}>{DESIGN_LABELS[design - 1]}</div>
            </div>
          )}
          {valeur && (
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: accent }}>{PRICE_LABELS[valeur - 1]}</div>
              <div style={{ fontSize: '10px', color: '#888' }}>Prix</div>
            </div>
          )}
          {racheterait !== null && (
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: '16px' }}>{racheterait ? '✅' : '❌'}</div>
              <div style={{ fontSize: '10px', color: '#888' }}>Racheter</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type FilterType = 'all' | 'game' | 'rating'
type SortType = 'recent' | 'score'

export default function CavePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [entries, setEntries] = useState<CaveEntry[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('recent')
  const router = useRouter()
  const supabase = createClient()

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

      // Vins du jeu
      const gameWineIds = sessions?.map(s => s.wine_id) ?? []

      // Vins du catalogue (pour les ratings manuels)
      const { data: catalogWines } = ratingWineIds.length
        ? await supabase.from('catalog_wines').select('*').in('id', ratingWineIds)
        : { data: [] }

      if (!gameWineIds.length && !ratingWineIds.length) { setLoading(false); return }

      const { data: wines } = gameWineIds.length
        ? await supabase.from('wines').select('*').in('id', gameWineIds)
        : { data: [] }
      const { data: allNotes } = gameWineIds.length
        ? await supabase.from('grappiste_notes').select('*').in('wine_id', gameWineIds)
        : { data: [] }
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
        const catalogWine = catalogWines?.find(w => w.id === r.wine_id)
        if (!catalogWine) return null
        return { type: 'rating', date: r.updated_at, rating: r, wine: catalogWine as any, notes: null }
      }).filter(Boolean) as RatingEntry[]

      // Fusionner et trier par date
      const all: CaveEntry[] = [...gameEntries, ...ratingEntries]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setEntries(all)
      setLoading(false)
  }

  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
    }
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

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
            <button onClick={() => router.push('/app/dashboard')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
            <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>Ma cave</span>
          </div>
          <div style={{ display: 'flex', borderTop: '0.5px solid #f0f0f0', marginBottom: '-1px' }}>
            <button style={{ flex: 1, padding: '10px 0', fontSize: '13px', fontWeight: '600', color: accent, background: 'none', border: 'none', borderBottom: `2px solid ${accent}`, cursor: 'default' }}>
              Mes dégustations
            </button>
            <button onClick={() => router.push('/app/cave/pepites')}
              style={{ flex: 1, padding: '10px 0', fontSize: '13px', fontWeight: '400', color: '#888', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer' }}>
              Cave à pépites
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Stats */}
        {entries.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
            {[
              { label: 'Dégustations', value: totalVins },
              { label: 'Points de jeu', value: totalPts.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '.875rem', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a' }}>{value}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filtres + tri */}
        {entries.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', border: '0.5px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', flex: 1 }}>
              {([['all', 'Tout'], ['game', '🎮 Jeu'], ['rating', '📖 Cave']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setFilter(v)}
                  style={{ flex: 1, padding: '8px 4px', background: filter === v ? accent : 'transparent', color: filter === v ? '#fff' : '#888', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', border: '0.5px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
              {([['recent', '🕐 Récent'], ['score', '⭐ Note']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setSort(v)}
                  style={{ padding: '8px 10px', background: sort === v ? accent : 'transparent', color: sort === v ? '#fff' : '#888', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

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
        ) : (() => {
          const visible = entries
            .filter(e => filter === 'all' || e.type === filter)
            .sort((a, b) => {
              if (sort === 'score') {
                const sa = a.type === 'game' ? ((a as GameEntry).tasting.score_perso ?? -1) : ((a as RatingEntry).rating.stars ?? -1)
                const sb = b.type === 'game' ? ((b as GameEntry).tasting.score_perso ?? -1) : ((b as RatingEntry).rating.stars ?? -1)
                return sb - sa
              }
              return new Date(b.date).getTime() - new Date(a.date).getTime()
            })
          if (visible.length === 0) return (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>Aucune dégustation pour ce filtre.</div>
          )
          return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {visible.map(entry => {
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

                    {(notes?.image_url ?? (wine as any)?.image_url) ? (
                      <img src={(notes?.image_url ?? (wine as any).image_url)!} alt=""
                        style={{ width: '48px', height: '72px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '48px', height: '72px', borderRadius: '8px', background: wine?.type === 'rouge' ? '#f5ede8' : '#f5f3e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>🍾</div>
                    )}

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '500', fontSize: '15px', color: '#1a1a1a' }}>
                          {notes ? `${notes.cepage} ${notes.millesime}` : isGame ? `Bouteille #${wine?.bottle_number}` : ((wine as any).name ?? wine?.type ?? '—')}
                        </span>
                        <span style={{ fontSize: '10px', background: isGame ? '#edeaf8' : '#e8f5e8', color: isGame ? '#3C3489' : '#27500A', padding: '2px 7px', borderRadius: '6px' }}>
                          {isGame ? '🎮 Jeu' : '📖 Cave'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{notes?.region ?? (wine as any)?.region ?? wine?.type}</div>
                      <div style={{ fontSize: '11px', color: '#bbb', marginBottom: '6px' }}>
                        {new Date(entry.date).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>

                      {isGame && gameEntry?.players && gameEntry.players.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          {gameEntry.players.map(p => (
                            <span key={p.id} style={{ fontSize: '11px', background: '#f5f5f5', color: '#666', padding: '2px 8px', borderRadius: '8px' }}>{p.pseudo}</span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <MiniStars score={isGame ? (gameEntry?.tasting.score_perso ?? null) : (ratingEntry?.rating.stars ?? null)} outOf10 />
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
                          {/* Appréciation */}
                          <AppreciationBlock
                            score={gameEntry.tasting.score_perso}
                            notesDeg={gameEntry.tasting.notes_degustation}
                            design={gameEntry.tasting.design_rating}
                            valeur={gameEntry.tasting.valeur_rating}
                            racheterait={gameEntry.tasting.racheterait}
                          />
                          <button onClick={() => router.push(`/app/session/${gameEntry.sessionId}/reveal?from=cave`)}
                            style={{ width: '100%', padding: '10px', border: `0.5px solid ${accent}`, borderRadius: '8px', background: '#fff', color: accent, fontSize: '13px', cursor: 'pointer', fontWeight: '500', marginBottom: '8px' }}>
                            Modifier ma note →
                          </button>
                          {gameEntry.wine?.shopify_url && (
                            <a href={gameEntry.wine.shopify_url} target="_blank" rel="noreferrer"
                              style={{ display: 'block', width: '100%', padding: '10px', background: accent, color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '500', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box', marginBottom: '12px' }}>
                              Acheter ce vin →
                            </a>
                          )}
                          {/* Bloc jeu */}
                          <div style={{ borderTop: '0.5px solid #e8e8e8', paddingTop: '12px' }}>
                            <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>Points du jeu</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
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
                            <button onClick={() => router.push(`/app/session/${gameEntry.sessionId}/reveal`)}
                              style={{ width: '100%', padding: '10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#1a1a1a', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                              Voir le reveal →
                            </button>
                          </div>
                        </>
                      ) : ratingEntry ? (
                        <>
                          <AppreciationBlock
                            score={ratingEntry.rating.stars}
                            notesDeg={ratingEntry.rating.notes_degustation}
                            design={ratingEntry.rating.design_rating}
                            valeur={ratingEntry.rating.valeur_rating}
                            racheterait={ratingEntry.rating.racheterait}
                          />
                          <button onClick={() => router.push('/app/cave/pepites')}
                            style={{ width: '100%', padding: '10px', border: `0.5px solid ${accent}`, borderRadius: '8px', background: '#fff', color: accent, fontSize: '13px', cursor: 'pointer', fontWeight: '500', marginBottom: ratingEntry.wine?.shopify_url ? '8px' : 0 }}>
                            Modifier ma note →
                          </button>
                          {ratingEntry.wine?.shopify_url && (
                            <a href={ratingEntry.wine.shopify_url} target="_blank" rel="noreferrer"
                              style={{ display: 'block', width: '100%', padding: '10px', background: accent, color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '500', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
                              Acheter ce vin →
                            </a>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )
        })()}
      </div>
    </div>
  )
}
