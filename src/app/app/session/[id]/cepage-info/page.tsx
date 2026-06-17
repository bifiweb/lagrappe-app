'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { CEPAGE_INFO } from '@/lib/cepage-info'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Profile, Session, SessionPlayer, Project } from '@/types'

export default function CepageInfoPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [players, setPlayers] = useState<SessionPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)

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

      if (sess?.status === 'cepage_tasting') { router.push(`/app/session/${sessionId}/cepage-tasting`); return }
      if (sess?.status === 'cepage_results') { router.push(`/app/session/${sessionId}/cepage-results`); return }

      if (sess?.project_id) {
        const { data: proj } = await supabase.from('projects').select('*').eq('id', sess.project_id).single()
        setProject(proj)
      }

      const { data: pl } = await supabase.from('session_players').select('*').eq('session_id', sessionId)
      setPlayers(pl ?? [])

      setLoading(false)
    }
    load()
  }, [])

  // Polling : avancer quand le chef lance
  useEffect(() => {
    if (!sessionId) return
    const interval = setInterval(async () => {
      const { data: sess } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
      if (sess?.status === 'cepage_tasting') {
        clearInterval(interval)
        router.push(`/app/session/${sessionId}/cepage-tasting`)
      }
      if (sess?.status === 'cepage_results') {
        clearInterval(interval)
        router.push(`/app/session/${sessionId}/cepage-results`)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [sessionId])

  async function launchTasting() {
    setLaunching(true)
    await supabase.from('sessions').update({ status: 'cepage_tasting' }).eq('id', sessionId)
    router.push(`/app/session/${sessionId}/cepage-tasting`)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Chargement...</div>
    </div>
  )

  const cepageName = project?.cepage_name ?? 'Cépage'
  const cepageInfoUrl = project?.cepage_info_url
  const info = CEPAGE_INFO[cepageName]
  const isChef = players.find(p => p.user_id === profile?.id)?.is_chef ?? false

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f5', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#7a3a5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px' }}>🍇</span>
          </div>
          <span style={{ fontWeight: '500', fontSize: '16px', color: '#1a1a1a', flex: 1 }}>{cepageName}</span>
          <span style={{ fontSize: '11px', background: '#f5ede8', color: '#8d323b', padding: '3px 10px', borderRadius: '10px', fontWeight: '500' }}>Dégustation à l'aveugle</span>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Hero cépage */}
        <div style={{ background: 'linear-gradient(135deg, #f5ede8, #fdf0f5)', border: '0.5px solid #d0a090', borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '8px' }}>🍇</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#8d323b', marginBottom: '4px' }}>{cepageName}</div>
          {info && (
            <div style={{ fontSize: '13px', color: '#888', fontStyle: 'italic' }}>{info.robe}</div>
          )}
        </div>

        {/* Description du cépage */}
        {info && (
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '12px' }}>À quoi s'attendre ?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>👁️</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '2px' }}>Robe</div>
                  <div style={{ fontSize: '13px', color: '#444', lineHeight: 1.5 }}>{info.robe}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>👃</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '2px' }}>Nez</div>
                  <div style={{ fontSize: '13px', color: '#444', lineHeight: 1.5 }}>{info.nez}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>👄</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '2px' }}>Bouche</div>
                  <div style={{ fontSize: '13px', color: '#444', lineHeight: 1.5 }}>{info.bouche}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lien externe */}
        {cepageInfoUrl && (
          <div style={{ background: '#f5f5f5', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: '#666' }}>En savoir plus sur ce cépage</div>
            <a href={cepageInfoUrl} target="_blank" rel="noopener noreferrer"
              style={{ padding: '8px 16px', background: '#8d323b', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '500', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Ouvrir →
            </a>
          </div>
        )}

        {/* Joueurs */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '10px' }}>
            {players.length} joueur{players.length > 1 ? 's' : ''} connecté{players.length > 1 ? 's' : ''}
          </div>
          {players.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '0.5px solid #f0f0f0' }}>
              <PlayerAvatar avatar={p.avatar} pseudo={p.pseudo} size={32} />
              <div style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>{p.pseudo}</div>
              {p.is_chef && <span style={{ fontSize: '11px', background: '#f5ede8', color: '#8d323b', padding: '2px 8px', borderRadius: '6px' }}>Organisateur</span>}
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B6D11' }} />
            </div>
          ))}
        </div>

        {/* Action */}
        {isChef ? (
          <button onClick={launchTasting} disabled={launching}
            style={{ width: '100%', padding: '14px', background: launching ? '#c0a0a0' : '#8d323b', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: launching ? 'default' : 'pointer' }}>
            {launching ? 'Démarrage...' : 'Commencer la dégustation →'}
          </button>
        ) : (
          <div style={{ background: '#f5f5f5', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#444', fontWeight: '500' }}>⏳ En attente de l'organisateur·ice...</div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>La dégustation démarrera dans quelques instants</div>
          </div>
        )}

      </div>
    </div>
  )
}
