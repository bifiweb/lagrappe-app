'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'

interface SessionSummary {
  id: string
  bottle_number: number
  status: string
  created_at: string
  wine_name: string
  wine_cepage: string
  wine_region: string
  project_name: string
  players: {
    pseudo: string
    points: number
    score_perso: number | null
    cepage_correct: boolean
    region_correct: boolean
    prix_correct: boolean
    millesime_correct: boolean
    aromes: string[]
    notes_libres: string | null
  }[]
}

export default function AdminMainPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'revealed' | 'active'>('all')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/app/dashboard'); return }

      // Charger toutes les sessions
      const { data: rawSessions } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })

      if (!rawSessions?.length) { setLoading(false); return }

      // Charger les wines, notes, tastings, players
      const wineIds = [...new Set(rawSessions.map(s => s.wine_id))]
      const sessionIds = rawSessions.map(s => s.id)

      const [{ data: wines }, { data: notes }, { data: tastings }, { data: players }, { data: projects }] = await Promise.all([
        supabase.from('wines').select('*').in('id', wineIds),
        supabase.from('grappiste_notes').select('*').in('wine_id', wineIds),
        supabase.from('tastings').select('*').in('session_id', sessionIds),
        supabase.from('session_players').select('*').in('session_id', sessionIds),
        supabase.from('projects').select('*'),
      ])

      const summaries: SessionSummary[] = rawSessions.map(session => {
        const wine = wines?.find(w => w.id === session.wine_id)
        const note = notes?.find(n => n.wine_id === session.wine_id)
        const project = projects?.find(p => p.id === wine?.project_id)
        const sessionTastings = tastings?.filter(t => t.session_id === session.id) ?? []
        const sessionPlayers = players?.filter(p => p.session_id === session.id) ?? []

        const playersSummary = sessionPlayers.map(p => {
          const tasting = sessionTastings.find(t => t.user_id === p.user_id)
          return {
            pseudo: p.pseudo,
            points: p.points_session ?? 0,
            score_perso: tasting?.score_perso ?? null,
            cepage_correct: tasting?.cepage_guess === note?.cepage,
            region_correct: tasting?.region_guess === note?.region,
            prix_correct: tasting?.prix_estime === note?.prix_chf,
            millesime_correct: tasting?.millesime_estime === note?.millesime,
            aromes: tasting?.aromes ?? [],
            notes_libres: tasting?.notes_libres ?? null,
          }
        }).sort((a, b) => b.points - a.points)

        return {
          id: session.id,
          bottle_number: wine?.bottle_number ?? 0,
          status: session.status,
          created_at: session.created_at,
          wine_name: note ? `${note.cepage} ${note.millesime}` : `Bouteille #${wine?.bottle_number}`,
          wine_cepage: note?.cepage ?? '—',
          wine_region: note?.region ?? '—',
          project_name: project?.name ?? '—',
          players: playersSummary,
        }
      })

      setSessions(summaries)
      setLoading(false)
    }
    load()
  }, [])

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const filtered = sessions.filter(s => {
    if (filterStatus === 'revealed') return s.status === 'revealed'
    if (filterStatus === 'active') return s.status !== 'revealed'
    return true
  })

  const accent = '#8d323b'

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>‹</button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>Vue globale</span>
          <span style={{ fontSize: '11px', background: '#faeeda', color: '#633806', padding: '3px 10px', borderRadius: '10px', fontWeight: '500' }}>Admin</span>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Stats globales */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
          {[
            { label: 'Sessions total', value: sessions.length },
            { label: 'Sessions terminées', value: sessions.filter(s => s.status === 'revealed').length },
            { label: 'Joueurs uniques', value: new Set(sessions.flatMap(s => s.players.map(p => p.pseudo))).size },
            { label: 'Dégustations', value: sessions.reduce((sum, s) => sum + s.players.length, 0) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: '500', color: accent }}>{value}</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
          {([['all', 'Toutes'], ['revealed', 'Terminées'], ['active', 'En cours']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: filterStatus === val ? 'none' : '0.5px solid #e0e0e0', background: filterStatus === val ? accent : '#fff', color: filterStatus === val ? '#fff' : '#666', fontWeight: '500' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Liste des sessions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(session => {
            const isOpen = expanded === session.id
            const avgScore = session.players.length
              ? Math.round(session.players.reduce((s, p) => s + (p.score_perso ?? 0), 0) / session.players.filter(p => p.score_perso !== null).length * 10) / 10
              : null
            const topPlayer = session.players[0]

            return (
              <div key={session.id} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', overflow: 'hidden' }}>

                {/* Header session */}
                <div onClick={() => setExpanded(isOpen ? null : session.id)}
                  style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>{session.wine_name}</span>
                      <span style={{ fontSize: '10px', background: session.status === 'revealed' ? '#e8f0e8' : '#faeeda', color: session.status === 'revealed' ? '#27500A' : '#633806', padding: '2px 7px', borderRadius: '6px', fontWeight: '500' }}>
                        {session.status === 'revealed' ? '✓ Terminée' : '⏳ En cours'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      {session.project_name} · {formatDate(session.created_at)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {avgScore !== null && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '500', color: accent }}>{avgScore}/10</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>note moy.</div>
                      </div>
                    )}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: '500', color: '#1a1a1a' }}>{session.players.length}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>joueurs</div>
                    </div>
                    <div style={{ fontSize: '16px', color: '#ccc' }}>{isOpen ? '▲' : '▼'}</div>
                  </div>
                </div>

                {/* Détails session */}
                {isOpen && (
                  <div style={{ borderTop: '0.5px solid #f0f0f0', padding: '1rem 1.25rem', background: '#fdf8f5' }}>

                    {/* Infos vin */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', background: '#edeaf8', color: '#3C3489', padding: '3px 10px', borderRadius: '8px' }}>{session.wine_cepage}</span>
                      <span style={{ fontSize: '11px', background: '#f5ede8', color: accent, padding: '3px 10px', borderRadius: '8px' }}>{session.wine_region}</span>
                    </div>

                    {/* Classement joueurs */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>
                        Joueurs
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {session.players.map((player, i) => (
                          <div key={player.pseudo} style={{ background: '#fff', borderRadius: '10px', padding: '10px 12px', border: '0.5px solid #e0e0e0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <span style={{ fontSize: '12px', color: '#888', minWidth: '16px' }}>{i + 1}</span>
                              <span style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a', flex: 1 }}>
                                {player.pseudo} {i === 0 ? '👑' : ''}
                              </span>
                              {player.score_perso !== null && (
                                <span style={{ fontSize: '12px', color: '#888' }}>
                                  ❤️ {player.score_perso}/10
                                </span>
                              )}
                              <span style={{ fontSize: '13px', fontWeight: '500', color: accent }}>
                                {player.points.toLocaleString()} pts
                              </span>
                            </div>

                            {/* Badges résultats */}
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '6px', background: player.cepage_correct ? '#e8f0e8' : '#f5f5f5', color: player.cepage_correct ? '#27500A' : '#888' }}>
                                {player.cepage_correct ? '✓' : '✗'} Cépage
                              </span>
                              <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '6px', background: player.region_correct ? '#e8f0e8' : '#f5f5f5', color: player.region_correct ? '#27500A' : '#888' }}>
                                {player.region_correct ? '✓' : '✗'} Région
                              </span>
                              <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '6px', background: player.prix_correct ? '#e8f0e8' : '#f5f5f5', color: player.prix_correct ? '#27500A' : '#888' }}>
                                {player.prix_correct ? '✓' : '✗'} Prix
                              </span>
                              <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '6px', background: player.millesime_correct ? '#e8f0e8' : '#f5f5f5', color: player.millesime_correct ? '#27500A' : '#888' }}>
                                {player.millesime_correct ? '✓' : '✗'} Millésime
                              </span>
                            </div>

                            {/* Notes libres */}
                            {player.notes_libres && (
                              <div style={{ marginTop: '6px', fontSize: '12px', color: '#666', fontStyle: 'italic', borderTop: '0.5px solid #f0f0f0', paddingTop: '6px' }}>
                                "{player.notes_libres}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Lien vers le reveal */}
                    {session.status === 'revealed' && (
                      <button onClick={() => router.push(`/app/session/${session.id}/reveal`)}
                        style={{ width: '100%', padding: '9px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#444', fontSize: '13px', cursor: 'pointer' }}>
                        Voir le reveal complet →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '1rem' }}>📊</div>
            <div style={{ fontSize: '14px', color: '#888' }}>Aucune session trouvée</div>
          </div>
        )}

        {/* Navigation admin */}
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '8px' }}>
          <button onClick={() => router.push('/app/admin/projects')}
            style={{ padding: '8px 14px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', fontSize: '13px', color: '#444', cursor: 'pointer' }}>
            Gérer les projets →
          </button>
          <button onClick={() => router.push('/app/admin/wines')}
            style={{ padding: '8px 14px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: '#fff', fontSize: '13px', color: '#444', cursor: 'pointer' }}>
            Gérer les vins →
          </button>
        </div>

      </div>
    </div>
  )
}