'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import type { Profile, Project, Wine, SessionPlayer } from '@/types'

export default function ProjectPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [wines, setWines] = useState<Wine[]>([])
  const [revealedWineIds, setRevealedWineIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'solo' | 'soiree' | null>(null)
  const [launchingCepage, setLaunchingCepage] = useState(false)
  const [pseudo, setPseudo] = useState('')
  const [showPseudoInput, setShowPseudoInput] = useState(false)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/auth/login?redirect=${encodeURIComponent(`/app/project/${params.slug}`)}`); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: proj } = await supabase
        .from('projects').select('*').eq('slug', params.slug).single()
      setProject(proj)

      if (proj) {
        const { data: w } = await supabase
          .from('wines').select('*').eq('project_id', proj.id).order('bottle_number')
        setWines(w ?? [])

        // Étape 1 — sessions où CE joueur a participé
        const { data: myPlayers } = await supabase
          .from('session_players')
          .select('session_id')
          .eq('user_id', user.id)

        const mySessionIds = (myPlayers ?? []).map((p: { session_id: string }) => p.session_id)

        // Étape 2 — parmi ces sessions, lesquelles sont révélées
        if (mySessionIds.length > 0) {
          const { data: sessions } = await supabase
            .from('sessions')
            .select('wine_id')
            .eq('project_id', proj.id)
            .eq('status', 'revealed')
            .in('id', mySessionIds)

          const revealed = new Set<string>(
            (sessions ?? []).map((s: { wine_id: string }) => s.wine_id)
          )
          setRevealedWineIds(revealed)
        }
      }

      if (prof?.display_name) setPseudo(prof.display_name)

      setLoading(false)
    }
    load()
  }, [])

  async function launchCepageSession() {
    if (!pseudo.trim() || !project || !profile) return
    setLaunchingCepage(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({ project_id: project.id, wine_id: null, bottle_number: null, status: 'lobby' })
      .select().single()

    if (error || !session) { setLaunchingCepage(false); return }

    await supabase.from('session_players').insert({
      session_id: session.id,
      user_id: user.id,
      pseudo: pseudo.trim(),
      avatar: profile.avatar ?? null,
      is_chef: true,
    })

    await supabase.from('profiles').update({ display_name: pseudo.trim() }).eq('id', user.id)
    router.push(`/app/session/${session.id}`)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  const isCepage = (project as any)?.template === 'cepage'
  const cepageName = (project as any)?.cepage_name ?? 'Cépage'
  const cepageInfoUrl = (project as any)?.cepage_info_url

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <button onClick={() => router.push('/app/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>
            ‹
          </button>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a' }}>
            {project?.name}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Mode cépage — flow dédié */}
        {isCepage && (
          <div>
            <div style={{ background: 'linear-gradient(135deg, #f5ede8, #fdf0f5)', border: '0.5px solid #d0a090', borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>🍇</div>
              <div style={{ fontSize: '22px', fontWeight: '600', color: '#8d323b', marginBottom: '4px' }}>{cepageName}</div>
              <div style={{ fontSize: '13px', color: '#888' }}>Dégustation à l'aveugle</div>
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>Comment ça marche ?</div>
              <p style={{ fontSize: '13px', color: '#555', margin: '0 0 6px', lineHeight: 1.6 }}>Chaque joueur apporte une bouteille de {cepageName} à l'aveugle. Tous les vins sont dégustés, chacun note de 0 à 100. À la fin, le classement final est calculé par méthode Borda.</p>
              {cepageInfoUrl && (
                <a href={cepageInfoUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#8d323b', textDecoration: 'none', fontWeight: '500', marginTop: '4px' }}>
                  En savoir plus sur le {cepageName} →
                </a>
              )}
            </div>

            {!showPseudoInput ? (
              <button onClick={() => setShowPseudoInput(true)}
                style={{ width: '100%', padding: '14px', background: '#8d323b', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
                Créer une session de dégustation →
              </button>
            ) : (
              <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a', display: 'block', marginBottom: '8px' }}>Ton pseudo</label>
                <input value={pseudo} onChange={e => setPseudo(e.target.value)}
                  placeholder="Ex: Sophie M., Le Sommelier..."
                  maxLength={30}
                  style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />
                <button onClick={launchCepageSession} disabled={!pseudo.trim() || launchingCepage}
                  style={{ width: '100%', padding: '12px', background: !pseudo.trim() || launchingCepage ? '#c0a0a0' : '#8d323b', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: !pseudo.trim() || launchingCepage ? 'default' : 'pointer' }}>
                  {launchingCepage ? 'Création...' : 'Lancer la session →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Choix du mode (templates vin suisse / valais) */}
        {!isCepage && !mode && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#1a1a1a', margin: '0 0 6px' }}>
                Comment veux-tu déguster ?
              </h2>
              <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
                Choisis ton mode de dégustation
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '2rem' }}>
              <div onClick={() => setMode('solo')}
                style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#8d323b')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e0e0e0')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f5ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
                    🍷
                  </div>
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '15px', color: '#1a1a1a', marginBottom: '3px' }}>
                      Une bouteille
                    </div>
                    <div style={{ fontSize: '13px', color: '#888' }}>
                      Une bouteille à la fois, solo ou en groupe
                    </div>
                  </div>
                </div>
              </div>

              {wines.length >= 2 && (
                <div onClick={() => project && router.push(`/app/evening/new?project=${project.id}`)}
                  style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#8d323b')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#e0e0e0')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#edeaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
                      🎉
                    </div>
                    <div>
                      <div style={{ fontWeight: '500', fontSize: '15px', color: '#1a1a1a', marginBottom: '3px' }}>
                        Soirée continue
                      </div>
                      <div style={{ fontSize: '13px', color: '#888' }}>
                        Plusieurs vins le même soir, solo ou en groupe
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Sélection de la bouteille (mode solo) */}
        {mode === 'solo' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
              <button onClick={() => setMode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>
                ‹
              </button>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#1a1a1a', margin: '0 0 3px' }}>
                  Quelle bouteille ?
                </h2>
                <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
                  Choisis la bouteille que tu as ouverte
                </p>
              </div>
            </div>

            {wines.length === 0 ? (
              <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
                <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>
                  Aucun vin configuré pour ce projet.
                </p>
                {profile?.role === 'admin' && (
                  <button onClick={() => router.push('/app/admin/wines')}
                    style={{ marginTop: '1rem', padding: '10px 20px', background: '#8d323b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    Ajouter les vins →
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {wines.map(wine => {
                  const isRevealed = revealedWineIds.has(wine.id)
                  return (
                    <div key={wine.id}
                      onClick={() => router.push(`/app/session/new?wine=${wine.id}&project=${project?.id}`)}
                      style={{
                        background: isRevealed ? '#fff' : wine.type === 'rouge' ? '#f5ede8' : wine.type === 'blanc' ? '#f5f3e0' : wine.type === 'rose' ? '#fdf0f0' : '#fff',
                        border: isRevealed ? '0.5px solid #c8e6c9' : '0.5px solid #e0e0e0',
                        borderRadius: '16px', padding: '1.25rem',
                        cursor: 'pointer', textAlign: 'center',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#8d323b')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = isRevealed ? '#c8e6c9' : '#e0e0e0')}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                        {isRevealed ? '✓' : '🍾'}
                      </div>
                      <div style={{ fontWeight: '500', fontSize: '22px', color: '#8d323b', marginBottom: '4px' }}>
                        {wine.bottle_number}
                      </div>
                      <div style={{ fontSize: '11px', color: isRevealed ? '#4CAF50' : '#888' }}>
                        {isRevealed ? 'Dégusté ↺' : wine.type}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Mode soirée — à venir */}
        {mode === 'soiree' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
              <button onClick={() => setMode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '20px', padding: 0 }}>
                ‹
              </button>
              <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#1a1a1a', margin: 0 }}>
                Soirée continue
              </h2>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '1rem' }}>🚧</div>
              <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>
                Le mode soirée arrive bientôt !
              </p>
            </div>
          </>
        )}

      </div>
    </div>
  )
}