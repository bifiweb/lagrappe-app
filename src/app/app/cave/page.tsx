'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile, Tasting, Wine, GrappisteNotes, SessionPlayer } from '@/types'

interface CaveEntry {
  tasting: Tasting
  wine: Wine
  notes: GrappisteNotes | null
  players: SessionPlayer[]
  sessionId: string
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

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: tastings } = await supabase
        .from('tastings')
        .select('*')
        .eq('user_id', user.id)
        .not('submitted_at', 'is', null)
        .order('created_at', { ascending: false })

      if (!tastings?.length) { setLoading(false); return }

      const sessionIds = tastings.map(t => t.session_id)
      const { data: sessions } = await supabase
        .from('sessions').select('*').in('id', sessionIds)

      const wineIds = sessions?.map(s => s.wine_id) ?? []
      const { data: wines } = await supabase
        .from('wines').select('*').in('id', wineIds)

      const { data: allNotes } = await supabase
        .from('grappiste_notes').select('*').in('wine_id', wineIds)

      const { data: allPlayers } = await supabase
        .from('session_players').select('*').in('session_id', sessionIds)

      const result: CaveEntry[] = tastings.map(t => {
        const session = sessions?.find(s => s.id === t.session_id)
        const wine = wines?.find(w => w.id === session?.wine_id)
        const notes = allNotes?.find(n => n.wine_id === wine?.id) ?? null
        const players = allPlayers?.filter(p => p.session_id === t.session_id) ?? []
        return { tasting: t, wine: wine!, notes, players, sessionId: t.session_id }
      }).filter(e => e.wine)

      setEntries(result)
      setLoading(false)
    }
    load()
  }, [])

  const totalPts = entries.reduce((sum, e) => sum + (e.tasting.total_points ?? 0), 0)
  const avgScore = entries.length
    ? Math.round(entries.reduce((sum, e) => sum + (e.tasting.score_perso ?? 0), 0) / entries.length * 10) / 10
    : 0

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement de ta cave...</div>
    </div>
  )

  const accent = '#8d323b'

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>
            ‹
          </button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>Ma cave</span>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Stats */}
        {entries.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
            {[
              { label: 'Vins dégustés', value: entries.length },
              { label: 'Points totaux', value: totalPts.toLocaleString() },
              { label: 'Note moyenne', value: avgScore + '/10' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '.875rem', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a' }}>{value}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Liste des vins */}
        {entries.length === 0 ? (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '1rem' }}>🍾</div>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>
              Ta cave est vide !
            </div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.5rem' }}>
              Déguste ton premier vin pour commencer ton historique
            </div>
            <button onClick={() => router.push('/app/dashboard')}
              style={{ padding: '10px 20px', background: accent, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
              Commencer à déguster →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {entries.map(({ tasting, wine, notes, players, sessionId }) => {
              const isOpen = expanded === tasting.id

              return (
                <div key={tasting.id} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', overflow: 'hidden' }}>

                  {/* En-tête de la carte — toujours visible */}
                  <div
                    onClick={() => setExpanded(isOpen ? null : tasting.id)}
                    style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>

                    {/* Photo ou icône */}
                    {notes?.image_url ? (
                      <img src={notes.image_url} alt=""
                        style={{ width: '48px', height: '72px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '48px', height: '72px', borderRadius: '8px', background: wine.type === 'rouge' ? '#f5ede8' : '#f5f3e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
                        🍾
                      </div>
                    )}

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500', fontSize: '15px', color: '#1a1a1a', marginBottom: '2px' }}>
                        {notes ? `${notes.cepage} ${notes.millesime}` : `Bouteille #${wine.bottle_number}`}
                      </div>
                      {notes?.cave && (
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '2px' }}>{notes.cave}</div>
                      )}
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                        {notes?.region ?? wine.type}
                      </div>

                      {/* Joueurs */}
                      {players.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          {players.map(p => (
                            <span key={p.id} style={{ fontSize: '11px', background: '#f5f5f5', color: '#666', padding: '2px 8px', borderRadius: '8px' }}>
                              {p.pseudo}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          Note perso : <span style={{ fontWeight: '500', color: '#1a1a1a' }}>{tasting.score_perso ?? '—'}/10</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: accent }}>
                            {tasting.total_points.toLocaleString()} pts
                          </div>
                          <div style={{ fontSize: '16px', color: '#888' }}>{isOpen ? '▲' : '▼'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Détails — visible si ouvert */}
                  {isOpen && (
                    <div style={{ borderTop: '0.5px solid #f0f0f0', padding: '1rem 1.25rem', background: '#fdf8f5' }}>

                      {/* Scores détaillés */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>Détail des points</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {[
                            { l: 'Robe', v: tasting.pts_robe },
                            { l: 'Arômes', v: tasting.pts_aromes },
                            { l: 'Bouche', v: tasting.pts_bouche },
                            { l: 'Prix', v: tasting.pts_prix },
                            { l: 'Millésime', v: tasting.pts_millesime },
                            { l: 'Cépage', v: tasting.pts_cepage },
                            { l: 'Région', v: tasting.pts_region },
                          ].map(({ l, v }) => (
                            <div key={l} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '6px 10px', textAlign: 'center' }}>
                              <div style={{ fontSize: '13px', fontWeight: '500', color: accent }}>{v}</div>
                              <div style={{ fontSize: '10px', color: '#888' }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Dégustation */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>Ta dégustation</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {tasting.robe && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                              <span style={{ color: '#888' }}>Robe</span>
                              <span style={{ color: '#1a1a1a', fontWeight: '500' }}>{tasting.robe} {tasting.robe === notes?.robe ? '✅' : notes?.robe ? '❌' : ''}</span>
                            </div>
                          )}
                          {tasting.bouche && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                              <span style={{ color: '#888' }}>Bouche</span>
                              <span style={{ color: '#1a1a1a', fontWeight: '500' }}>{tasting.bouche} {tasting.bouche === notes?.bouche ? '✅' : notes?.bouche ? '❌' : ''}</span>
                            </div>
                          )}
                          {tasting.aromes?.length > 0 && (
                            <div style={{ fontSize: '13px' }}>
                              <span style={{ color: '#888' }}>Arômes : </span>
                              <span style={{ color: '#1a1a1a' }}>
                                {tasting.aromes.map(a => {
                                  const isOk = notes?.aromes_officiels?.includes(a)
                                  return `${a}${isOk ? ' ✓' : ''}`
                                }).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Devinettes */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>Tes devinettes</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {[
                            { l: 'Cépage', mine: tasting.cepage_guess, official: notes?.cepage },
                            { l: 'Région', mine: tasting.region_guess, official: notes?.region },
                            { l: 'Millésime', mine: tasting.millesime_estime?.toString(), official: notes?.millesime?.toString() },
                            { l: 'Prix', mine: tasting.prix_estime, official: notes?.prix_chf },
                          ].map(({ l, mine, official }) => mine ? (
                            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                              <span style={{ color: '#888' }}>{l}</span>
                              <span style={{ color: '#1a1a1a', fontWeight: '500' }}>
                                {mine} {mine === official ? '✅' : official ? '❌' : ''}
                              </span>
                            </div>
                          ) : null)}
                        </div>
                      </div>

                      {/* Notes libres */}
                      {tasting.notes_libres && (
                        <div style={{ marginBottom: '1rem', fontSize: '13px', color: '#666', fontStyle: 'italic', background: '#fff', borderRadius: '8px', padding: '10px 12px' }}>
                          "{tasting.notes_libres}"
                        </div>
                      )}

                      {/* Prix */}
                      {notes?.prix_exact && (
                        <div style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: '500', marginBottom: '10px' }}>
                          CHF {notes.prix_exact.toFixed(2)}
                          {notes.prix_chf && (
                            <span style={{ fontSize: '12px', color: '#888', fontWeight: '400', marginLeft: '6px' }}>
                              ({notes.prix_chf})
                            </span>
                          )}
                        </div>
                      )}


                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => router.push(`/app/session/${sessionId}/reveal`)}
                          style={{ flex: 1, padding: '10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#1a1a1a', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                          Voir le reveal →
                        </button>
                        {wine.shopify_url && (
                          <a href={wine.shopify_url} target="_blank" rel="noreferrer"
                            style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: accent, color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '500', textAlign: 'center', textDecoration: 'none' }}>
                            Racheter →
                          </a>
                        )}
                      </div>
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