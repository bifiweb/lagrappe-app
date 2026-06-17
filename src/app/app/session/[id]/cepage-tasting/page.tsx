'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { WINE_CONTENT, MAX_AROMES } from '@/types'
import type { Profile, Session, SessionPlayer, Wine, Project } from '@/types'

interface WineDetail {
  aromes: string[]
  tasting_note: string
  millesime: string
  region: string
  prix: string
}

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  rouge:    { bg: '#f5ede8', text: '#8d323b', label: 'Rouge' },
  blanc:    { bg: '#f5f3e0', text: '#7a6010', label: 'Blanc' },
  rose:     { bg: '#fdf0f0', text: '#c05070', label: 'Rosé' },
  petillant:{ bg: '#edf0ff', text: '#3050a0', label: 'Pétillant' },
}

export default function CepageTastingPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [players, setPlayers] = useState<SessionPlayer[]>([])
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Score 0-100 par vin (undefined = non noté)
  const [scores, setScores] = useState<Record<string, number>>({})
  // Détails par vin (expansible)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, WineDetail>>({})

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

      if (sess?.status === 'cepage_results') { router.push(`/app/session/${sessionId}/cepage-results`); return }

      if (sess?.project_id) {
        const { data: proj } = await supabase.from('projects').select('*').eq('id', sess.project_id).single()
        setProject(proj)

        const { data: w } = await supabase.from('wines').select('*').eq('project_id', sess.project_id).order('bottle_number')
        setWines(w ?? [])

        // Vérifier si le joueur a déjà soumis
        const { data: existing } = await supabase
          .from('cepage_ratings')
          .select('wine_id, score')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
        if (existing && existing.length > 0) {
          const sc: Record<string, number> = {}
          existing.forEach((r: any) => { sc[r.wine_id] = r.score })
          setScores(sc)
          setSubmitted(true)
        }
      }

      const { data: pl } = await supabase.from('session_players').select('*').eq('session_id', sessionId)
      setPlayers(pl ?? [])

      setLoading(false)
    }
    load()
  }, [])

  // Polling après soumission : attendre que tout le monde ait fini
  useEffect(() => {
    if (!submitted || !sessionId) return
    const interval = setInterval(async () => {
      const { data: sess } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
      if (sess?.status === 'cepage_results') {
        clearInterval(interval)
        router.push(`/app/session/${sessionId}/cepage-results`)
        return
      }
      // Vérifier si tous les joueurs ont soumis
      const { data: pl } = await supabase
        .from('session_players').select('tasting_done').eq('session_id', sessionId)
      const allDone = pl?.every(p => p.tasting_done) ?? false
      if (allDone && pl && pl.length > 0) {
        await supabase.from('sessions').update({ status: 'cepage_results' }).eq('id', sessionId)
        clearInterval(interval)
        router.push(`/app/session/${sessionId}/cepage-results`)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [submitted, sessionId])

  function setScore(wineId: string, value: number) {
    setScores(prev => ({ ...prev, [wineId]: value }))
  }

  function toggleExpand(wineId: string) {
    setExpanded(prev => prev === wineId ? null : wineId)
    if (!details[wineId]) {
      setDetails(prev => ({ ...prev, [wineId]: { aromes: [], tasting_note: '', millesime: '', region: '', prix: '' } }))
    }
  }

  function toggleArome(wineId: string, arome: string) {
    setDetails(prev => {
      const current = prev[wineId] ?? { aromes: [], tasting_note: '', millesime: '', region: '', prix: '' }
      const newAromes = current.aromes.includes(arome)
        ? current.aromes.filter(a => a !== arome)
        : current.aromes.length < MAX_AROMES ? [...current.aromes, arome] : current.aromes
      return { ...prev, [wineId]: { ...current, aromes: newAromes } }
    })
  }

  function setDetail(wineId: string, field: keyof WineDetail, value: string) {
    setDetails(prev => {
      const current = prev[wineId] ?? { aromes: [], tasting_note: '', millesime: '', region: '', prix: '' }
      return { ...prev, [wineId]: { ...current, [field]: value } }
    })
  }

  async function submitTasting() {
    if (!profile) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSubmitting(true)

    const records = wines.map(wine => ({
      session_id: sessionId,
      user_id: user.id,
      wine_id: wine.id,
      score: scores[wine.id] ?? 50,
      tasting_note: details[wine.id]?.tasting_note || null,
      aromes: details[wine.id]?.aromes ?? [],
      millesime: details[wine.id]?.millesime ? parseInt(details[wine.id].millesime) : null,
      region: details[wine.id]?.region || null,
      prix: details[wine.id]?.prix ? parseFloat(details[wine.id].prix) : null,
    }))

    await supabase.from('cepage_ratings').upsert(records, { onConflict: 'session_id,user_id,wine_id' })
    await supabase.from('session_players').update({ tasting_done: true }).eq('session_id', sessionId).eq('user_id', user.id)

    setSubmitting(false)
    setSubmitted(true)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  const cepageName = project?.cepage_name ?? 'Cépage'
  const wineType = wines[0]?.type ?? 'rouge'
  const aromesList = WINE_CONTENT[wineType]?.aromes ?? WINE_CONTENT.rouge.aromes
  const ratedCount = Object.keys(scores).length
  const allRated = wines.length > 0 && ratedCount >= wines.length
  const accent = '#8d323b'

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#7a3a5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px' }}>🍇</span>
          </div>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>{cepageName} — Notation</span>
          <span style={{ fontSize: '12px', color: '#888' }}>{ratedCount}/{wines.length}</span>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>✓</div>
            <div style={{ fontSize: '18px', fontWeight: '500', color: '#1a1a1a', marginBottom: '8px' }}>Dégustation soumise !</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '2rem' }}>En attente des autres joueurs...</div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: accent, opacity: 0.3 + i * 0.3 }} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Liste des vins */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
              {wines.map((wine, idx) => {
                const score = scores[wine.id]
                const hasScore = score !== undefined
                const isExpanded = expanded === wine.id
                const wineDetails = details[wine.id]
                const typeColor = TYPE_COLORS[wine.type] ?? TYPE_COLORS.rouge

                return (
                  <div key={wine.id} style={{ background: '#fff', border: `0.5px solid ${hasScore ? accent : '#e0e0e0'}`, borderRadius: '16px', overflow: 'hidden', transition: 'border-color .2s' }}>
                    {/* En-tête bouteille */}
                    <div style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: hasScore ? '12px' : 0 }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: typeColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '20px', fontWeight: '700', color: typeColor.text }}>{wine.bottle_number}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>Bouteille {wine.bottle_number}</div>
                          <div style={{ fontSize: '12px', color: '#888' }}>{typeColor.label}</div>
                        </div>
                        {hasScore && (
                          <div style={{ fontSize: '22px', fontWeight: '700', color: accent }}>{score}</div>
                        )}
                      </div>

                      {/* Slider score */}
                      <div style={{ marginBottom: hasScore ? '8px' : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#aaa' }}>0</span>
                          <input
                            type="range" min={0} max={100} step={1}
                            value={score ?? 50}
                            onChange={e => setScore(wine.id, parseInt(e.target.value))}
                            onPointerDown={() => { if (!hasScore) setScore(wine.id, 50) }}
                            style={{ flex: 1, accentColor: accent, height: '4px', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '11px', color: '#aaa' }}>100</span>
                        </div>
                        {!hasScore && (
                          <div style={{ textAlign: 'center', fontSize: '12px', color: '#bbb' }}>Glisse pour noter</div>
                        )}
                      </div>
                    </div>

                    {/* Bouton détails */}
                    <button
                      onClick={() => toggleExpand(wine.id)}
                      style={{ width: '100%', padding: '10px 1.25rem', background: '#fafafa', border: 'none', borderTop: '0.5px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '12px', color: '#888' }}>
                      <span>
                        {wineDetails?.aromes && wineDetails.aromes.length > 0
                          ? `${wineDetails.aromes.slice(0, 2).join(', ')}${wineDetails.aromes.length > 2 ? '...' : ''}`
                          : 'Détails optionnels (arômes, région, millésime...)'}
                      </span>
                      <span style={{ transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </button>

                    {/* Panel détails */}
                    {isExpanded && (
                      <div style={{ padding: '1rem 1.25rem', borderTop: '0.5px solid #f0f0f0', background: '#fafafa' }}>

                        {/* Arômes */}
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '8px' }}>
                            Arômes principaux <span style={{ fontWeight: '400', color: '#aaa' }}>(max {MAX_AROMES}, optionnel)</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {aromesList.map(arome => {
                              const selected = wineDetails?.aromes?.includes(arome) ?? false
                              const maxed = (wineDetails?.aromes?.length ?? 0) >= MAX_AROMES && !selected
                              return (
                                <button key={arome} onClick={() => toggleArome(wine.id, arome)}
                                  style={{ padding: '5px 11px', borderRadius: '20px', border: selected ? 'none' : '0.5px solid #e0e0e0', background: selected ? accent : maxed ? '#f5f5f5' : '#fff', color: selected ? '#fff' : maxed ? '#ccc' : '#666', fontSize: '12px', cursor: maxed ? 'default' : 'pointer' }}>
                                  {arome}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Note libre */}
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '6px' }}>Note libre (optionnel)</div>
                          <textarea
                            value={wineDetails?.tasting_note ?? ''}
                            onChange={e => setDetail(wine.id, 'tasting_note', e.target.value)}
                            placeholder="Mes impressions sur ce vin..."
                            rows={2}
                            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'system-ui', boxSizing: 'border-box' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>Millésime</div>
                            <input type="number" value={wineDetails?.millesime ?? ''} onChange={e => setDetail(wine.id, 'millesime', e.target.value)}
                              placeholder="2019" min={1900} max={2030}
                              style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>Région</div>
                            <input type="text" value={wineDetails?.region ?? ''} onChange={e => setDetail(wine.id, 'region', e.target.value)}
                              placeholder="Valais..."
                              style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>Prix CHF</div>
                            <input type="number" value={wineDetails?.prix ?? ''} onChange={e => setDetail(wine.id, 'prix', e.target.value)}
                              placeholder="35" min={0} step={0.5}
                              style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Bouton soumettre */}
            <div style={{ position: 'sticky', bottom: '1rem' }}>
              <button
                onClick={submitTasting}
                disabled={!allRated || submitting}
                style={{ width: '100%', padding: '16px', background: !allRated || submitting ? '#c0a0a0' : accent, color: '#fff', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '600', cursor: !allRated || submitting ? 'default' : 'pointer', boxShadow: '0 4px 12px rgba(141,50,59,0.25)' }}>
                {submitting ? 'Envoi...' : !allRated ? `Encore ${wines.length - ratedCount} vin${wines.length - ratedCount > 1 ? 's' : ''} à noter` : 'Soumettre ma dégustation →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
