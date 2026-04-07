'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import type { Session, Wine, GrappisteNotes, Tasting, SessionPlayer } from '@/types'

export default function RevealPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [wine, setWine] = useState<Wine | null>(null)
  const [notes, setNotes] = useState<GrappisteNotes | null>(null)
  const [tastings, setTastings] = useState<Tasting[]>([])
  const [players, setPlayers] = useState<SessionPlayer[]>([])
  const [myTasting, setMyTasting] = useState<Tasting | null>(null)
  const [activeTab, setActiveTab] = useState<'groupe' | 'aromes' | 'moi' | 'vin'>('groupe')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const sessionId = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      await supabase.rpc('calculate_session_scores', { p_session_id: sessionId })

      const { data: sess } = await supabase
        .from('sessions').select('*').eq('id', sessionId).single()
      setSession(sess)

      if (sess) {
        const { data: w } = await supabase
          .from('wines').select('*').eq('id', sess.wine_id).single()
        setWine(w)

        const { data: n } = await supabase
          .from('grappiste_notes').select('*').eq('wine_id', sess.wine_id).single()
        setNotes(n)

        const { data: t } = await supabase
          .from('tastings').select('*').eq('session_id', sessionId)
        setTastings(t ?? [])

        const myT = t?.find(x => x.user_id === user.id)
        setMyTasting(myT ?? null)

        const { data: pl } = await supabase
          .from('session_players').select('*').eq('session_id', sessionId)
          .order('points_session', { ascending: false })
        setPlayers(pl ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  function getAromeCounts() {
    const counts: Record<string, number> = {}
    tastings.forEach(t => {
      t.aromes.forEach(a => {
        counts[a] = (counts[a] || 0) + 1
      })
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Calcul des scores...</div>
    </div>
  )

  const accent = '#8d323b'
  const aromeCounts = getAromeCounts()
  const maxArome = aromeCounts[0]?.[1] ?? 1

  const prixAffiche = notes?.prix_exact
    ? `CHF ${notes.prix_exact.toFixed(2)}`
    : notes?.prix_chf
      ? `CHF ${notes.prix_chf}`
      : '—'

  function CompareRow({ label, mine, official, correct }: { label: string, mine: string | null, official: string | null, correct: boolean }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '0.5px solid #f0f0f0' }}>
        <div style={{ fontSize: '12px', color: '#888', minWidth: '70px' }}>{label}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>{mine ?? '—'}</div>
          {!correct && official && (
            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
              Réponse : <span style={{ color: accent, fontWeight: '500' }}>{official}</span>
            </div>
          )}
        </div>
        <div style={{ fontSize: '18px' }}>{mine ? (correct ? '✅' : '❌') : '—'}</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif', paddingBottom: '2rem' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px' }}>🍷</span>
          </div>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>
            Révélation — Bouteille #{session?.bottle_number}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Vin révélé */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Vin mystère révélé
          </div>
          {notes?.image_url ? (
            <img src={notes.image_url} alt={`${notes.cepage} ${notes.millesime}`}
              style={{ height: '140px', objectFit: 'contain', marginBottom: '12px', borderRadius: '8px' }} />
          ) : (
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🍾</div>
          )}
          <div style={{ fontSize: '20px', fontWeight: '500', color: '#1a1a1a', marginBottom: '2px' }}>
            {notes?.cepage} {notes?.millesime}
          </div>
          {notes?.cave && (
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '4px' }}>{notes.cave}</div>
          )}
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>{notes?.region}</div>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {notes?.region && <span style={{ background: '#f5ede8', color: '#712B13', fontSize: '12px', padding: '3px 12px', borderRadius: '12px', fontWeight: '500' }}>{notes.region}</span>}
            {notes?.cepage && <span style={{ background: '#edeaf8', color: '#3C3489', fontSize: '12px', padding: '3px 12px', borderRadius: '12px', fontWeight: '500' }}>{notes.cepage}</span>}
            {notes?.millesime && <span style={{ background: '#e8f0e8', color: '#27500A', fontSize: '12px', padding: '3px 12px', borderRadius: '12px', fontWeight: '500' }}>{notes.millesime}</span>}
            {notes?.prix_exact && <span style={{ background: '#f5ede8', color: '#712B13', fontSize: '12px', padding: '3px 12px', borderRadius: '12px', fontWeight: '500' }}>CHF {notes.prix_exact.toFixed(2)}</span>}
          </div>
        </div>

        {/* Mon score */}
        {myTasting && (
          <div style={{ background: accent, borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem', color: '#fff' }}>
            <div style={{ fontSize: '12px', opacity: .8, marginBottom: '4px' }}>Ton score</div>
            <div style={{ fontSize: '32px', fontWeight: '500' }}>{myTasting.total_points.toLocaleString()} pts</div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
              {[
                { l: 'Robe', v: myTasting.pts_robe },
                { l: 'Arômes', v: myTasting.pts_aromes },
                { l: 'Bouche', v: myTasting.pts_bouche },
                { l: 'Prix', v: myTasting.pts_prix },
                { l: 'Millésime', v: myTasting.pts_millesime },
                { l: 'Cépage', v: myTasting.pts_cepage },
                { l: 'Région', v: myTasting.pts_region },
              ].map(({ l, v }) => (
                <div key={l} style={{ fontSize: '12px', opacity: .9 }}>
                  <span style={{ opacity: .7 }}>{l} </span>{v}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', border: '0.5px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
          {(['groupe', 'aromes', 'moi', 'vin'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ flex: 1, padding: '9px', background: activeTab === t ? accent : 'transparent', color: activeTab === t ? '#fff' : '#888', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
              {t === 'groupe' ? 'Groupe' : t === 'aromes' ? 'Arômes' : t === 'moi' ? 'Moi' : 'Le vin'}
            </button>
          ))}
        </div>

        {/* TAB GROUPE */}
        {activeTab === 'groupe' && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.75rem' }}>Classement</div>
            {players.map((p, i) => {
              const t = tastings.find(x => x.user_id === p.user_id)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '0.5px solid #f0f0f0' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#888', minWidth: '16px' }}>{i + 1}</div>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '500', color: accent }}>
                    {p.pseudo[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>
                      {p.pseudo} {i === 0 ? '👑' : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>
                      {t?.cepage_guess} · {t?.region_guess}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: accent }}>
                    {p.points_session.toLocaleString()}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* TAB ARÔMES */}
        {activeTab === 'aromes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Mes arômes */}
            {myTasting && myTasting.aromes.length > 0 && (
              <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.75rem' }}>Mes arômes</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {myTasting.aromes.map(a => {
                    const isOfficial = notes?.aromes_officiels?.includes(a)
                    return (
                      <span key={a} style={{
                        fontSize: '12px', padding: '4px 12px', borderRadius: '12px',
                        background: isOfficial ? '#e8f0e8' : '#f5ede8',
                        color: isOfficial ? '#27500A' : '#8d323b',
                        fontWeight: '500',
                        border: isOfficial ? '0.5px solid #c8e6c9' : '0.5px solid #f5c6c6',
                      }}>
                        {a} {isOfficial ? '✓' : ''}
                      </span>
                    )
                  })}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                  ✓ = dans la liste officielle des grappistes
                </div>
              </div>
            )}

            {/* Arômes du groupe */}
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.75rem' }}>Arômes du groupe</div>
              {aromeCounts.map(([arome, count]) => {
                const isOfficial = notes?.aromes_officiels?.includes(arome)
                const isMine = myTasting?.aromes?.includes(arome)
                return (
                  <div key={arome} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', color: isMine ? accent : '#444', minWidth: '100px', fontWeight: isMine ? '500' : '400' }}>
                      {arome} {isMine ? '👤' : ''}
                    </div>
                    <div style={{ flex: 1, height: '5px', background: '#f0f0f0', borderRadius: '3px' }}>
                      <div style={{ height: '5px', borderRadius: '3px', background: isOfficial ? '#7a6a1a' : accent, width: `${Math.round(count / maxArome * 100)}%`, transition: 'width .6s' }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', minWidth: '28px' }}>{count}/{players.length}</div>
                    {isOfficial && <span style={{ fontSize: '10px', background: '#faeeda', color: '#633806', padding: '2px 6px', borderRadius: '6px' }}>✓</span>}
                  </div>
                )
              })}
              <div style={{ marginTop: '1rem', fontSize: '12px', color: '#888' }}>
                👤 = ton arôme · ✓ = liste officielle
              </div>
            </div>
          </div>
        )}

        {/* TAB MOI */}
        {activeTab === 'moi' && myTasting && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Dégustation */}
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.75rem' }}>Ta dégustation</div>

              <CompareRow
                label="Robe"
                mine={myTasting.robe}
                official={notes?.robe ?? null}
                correct={myTasting.robe === notes?.robe}
              />
              <CompareRow
                label="Bouche"
                mine={myTasting.bouche}
                official={notes?.bouche ?? null}
                correct={myTasting.bouche === notes?.bouche}
              />

              {/* Arômes */}
              <div style={{ padding: '10px 0', borderBottom: '0.5px solid #f0f0f0' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>Arômes</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {myTasting.aromes.map(a => {
                    const isOfficial = notes?.aromes_officiels?.includes(a)
                    return (
                      <span key={a} style={{
                        fontSize: '12px', padding: '4px 10px', borderRadius: '12px',
                        background: isOfficial ? '#e8f0e8' : '#f5f5f5',
                        color: isOfficial ? '#27500A' : '#666',
                        fontWeight: isOfficial ? '500' : '400',
                      }}>
                        {a} {isOfficial ? '✓' : ''}
                      </span>
                    )
                  })}
                </div>
                {notes?.aromes_officiels && (
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                    ✓ = dans la liste officielle
                  </div>
                )}
              </div>

              {myTasting.score_perso !== null && (
                <div style={{ padding: '10px 0', borderBottom: '0.5px solid #f0f0f0' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Ton appréciation</div>
                  <div style={{ fontSize: '20px', fontWeight: '500', color: accent }}>{myTasting.score_perso}/10</div>
                </div>
              )}

              {myTasting.notes_libres && (
                <div style={{ padding: '10px 0' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Notes libres</div>
                  <div style={{ fontSize: '13px', color: '#444', fontStyle: 'italic' }}>"{myTasting.notes_libres}"</div>
                </div>
              )}
            </div>

            {/* Devinettes */}
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.75rem' }}>Tes devinettes</div>

              <CompareRow
                label="Cépage"
                mine={myTasting.cepage_guess}
                official={notes?.cepage ?? null}
                correct={myTasting.cepage_guess === notes?.cepage}
              />
              <CompareRow
                label="Région"
                mine={myTasting.region_guess}
                official={notes?.region ?? null}
                correct={myTasting.region_guess === notes?.region}
              />
              <CompareRow
                label="Millésime"
                mine={myTasting.millesime_estime?.toString() ?? null}
                official={notes?.millesime?.toString() ?? null}
                correct={myTasting.millesime_estime === notes?.millesime}
              />
              <CompareRow
                label="Prix"
                mine={myTasting.prix_estime}
                official={notes?.prix_chf ?? null}
                correct={myTasting.prix_estime === notes?.prix_chf}
              />
            </div>
          </div>
        )}

        {/* TAB MOI — pas de dégustation */}
        {activeTab === 'moi' && !myTasting && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#888' }}>Tu n'as pas soumis de dégustation pour cette session.</div>
          </div>
        )}

        {/* TAB VIN */}
        {activeTab === 'vin' && notes && (
          <>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.75rem' }}>Note des grappistes</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '.75rem' }}>
                <div style={{ fontSize: '32px', fontWeight: '500', color: accent }}>{notes.note}</div>
                <div style={{ flex: 1, height: '6px', background: '#f0f0f0', borderRadius: '3px' }}>
                  <div style={{ height: '6px', borderRadius: '3px', background: accent, width: `${notes.note * 10}%` }} />
                </div>
                <div style={{ fontSize: '13px', color: '#888' }}>/ 10</div>
              </div>
              <p style={{ fontSize: '13px', color: '#444', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
                "{notes.description}"
              </p>
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.75rem' }}>Prix & commande</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: '500', color: '#1a1a1a' }}>{prixAffiche}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Bouteille 75cl</div>
                </div>
                <div style={{ fontSize: '12px', color: '#888', textAlign: 'right' }}>
                  Ton estimation :<br />
                  <span style={{ color: '#1a1a1a', fontWeight: '500' }}>{myTasting?.prix_estime ?? '—'}</span>
                </div>
              </div>
              {wine?.shopify_url && (
                <a href={wine.shopify_url} target="_blank" rel="noreferrer"
                  style={{ display: 'block', width: '100%', padding: '13px', background: accent, color: '#fff', borderRadius: '10px', fontSize: '14px', fontWeight: '500', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
                  Commander sur La Grappe →
                </a>
              )}
            </div>
          </>
        )}

        {/* Retour au dashboard */}
        <button onClick={() => router.push('/app/dashboard')}
          style={{ width: '100%', padding: '13px', border: '0.5px solid #e0e0e0', borderRadius: '12px', background: '#fff', color: '#888', fontSize: '14px', cursor: 'pointer', marginTop: '1rem' }}>
          Retour au dashboard
        </button>

      </div>
    </div>
  )
}